import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import type { PreparedInput, RuntimeEvent, RuntimeJob, RuntimePayload } from '../shared/contracts';
import { decodeRuntimeEvent, runtimeEvent } from '../shared/protocol';
import { BridgeError, errorText } from '../shared/errors';
import { PROFILE_293, verifyBinary } from '../runtime/profile';

/** 运行时启动配置，均来自控制配置，不从调用方请求头读取。 */
export interface EngineConfig {
  mode: 'native' | 'demo';
  binaryPath?: string;
  home?: string;
  configDir?: string;
  apiKey?: string;
  oauthToken?: string;
  proxyUrl?: string;
  caFile?: string;
  preloadPath: string;
  cwd: string;
  timeoutMs: number;
}

/** 统一运行时接口，演示与真实原生来源始终分别标记。 */
export interface Engine {
  readonly name: string;
  readonly binarySha256: string | null;
  /** 执行单轮请求并等待事件消费者。
   * @param prepared 已验证请求。
   * @param signal 取消信号。
   * @param emit 有背压的事件接收器。
   * @return 作业已结束。
   */
  run(prepared: PreparedInput, signal: AbortSignal, emit: (event: RuntimeEvent) => Promise<void>): Promise<void>;
}

/** 固定官方二进制的单作业进程引擎。 */
export class NativeEngine implements Engine {
  readonly name = 'claude-code/2.1.293';
  readonly binarySha256 = PROFILE_293.sha256;
  private running = false;

  /** 保存显式的账号运行环境。
   * @param config 控制配置。
   */
  constructor(private readonly config: EngineConfig) {}

  /** 在启动时只读校验程序和构建产物。
   * @return 校验完成，不发账号或模型请求。
   */
  async verify(): Promise<void> {
    if (!this.config.binaryPath || !this.config.home || !this.config.configDir) throw new BridgeError('native_configuration', '原生模式需要 CCRB_CLAUDE_BINARY、CCRB_CLAUDE_HOME 和 CCRB_CLAUDE_CONFIG_DIR', 503);
    await verifyBinary(this.config.binaryPath);
    await readFile(this.config.preloadPath);
  }

  /** 启动一个隔离的原生作业，结束后不保留全局会话状态。
   * @param prepared 已完成入口验证的输入。
   * @param signal 调用方取消。
   * @param emit 有背压的事件接收器。
   * @return 原生进程和协议均已结束。
   */
  async run(prepared: PreparedInput, signal: AbortSignal, emit: (event: RuntimeEvent) => Promise<void>): Promise<void> {
    if (this.running) throw new BridgeError('runtime_busy', '单账号运行时正在处理其他请求', 429);
    this.running = true;
    const config = this.config;
    let child: ReturnType<typeof Bun.spawn> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let forceKill: ReturnType<typeof setTimeout> | undefined;
    const cancel = (): void => {
      if (!child) return;
      try { child.stdin && typeof child.stdin !== 'number' && 'write' in child.stdin && child.stdin.write(JSON.stringify({ type: 'request_cancel' }) + '\n'); } catch {}
      forceKill = setTimeout(() => child?.kill('SIGKILL'), 1500);
    };
    try {
      if (signal.aborted) throw new DOMException('请求已取消', 'AbortError');
      // 每次作业校验二进制，避免官方自动更新后仍按旧内部符号执行。
      await verifyBinary(config.binaryPath!);
      const env: Record<string, string> = {
        HOME: config.home!,
        CLAUDE_CONFIG_DIR: config.configDir!,
        PATH: process.env.PATH ?? '/usr/bin:/bin',
        LANG: 'C.UTF-8',
        BUN_OPTIONS: '--preload ' + resolve(config.preloadPath),
        CCRB_REQUEST_ID: prepared.input.request_id,
        CLAUDE_CODE_ENTRYPOINT: 'sdk-cli',
        CLAUDE_AGENT_SDK_CLIENT_APP: 'cc-runtime-bridge',
        CLAUDE_CODE_GATEWAY_HINT_HEADERS: '1',
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
        DISABLE_AUTOUPDATER: '1',
        DISABLE_TELEMETRY: '1',
        DISABLE_ERROR_REPORTING: '1',
      };
      if (config.apiKey) env.ANTHROPIC_API_KEY = config.apiKey;
      if (config.oauthToken) env.CLAUDE_CODE_OAUTH_TOKEN = config.oauthToken;
      if (config.proxyUrl) env.HTTPS_PROXY = config.proxyUrl;
      if (config.caFile) env.NODE_EXTRA_CA_CERTS = config.caFile;
      const processHandle = Bun.spawn([config.binaryPath!, '--version'], { cwd: config.cwd, env, stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' });
      child = processHandle;
      signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) cancel();
      timer = setTimeout(cancel, config.timeoutMs);
      const job: RuntimeJob = { type: 'request_start', schema_version: 1, request_id: prepared.input.request_id, prepared };
      processHandle.stdin.write(JSON.stringify(job) + '\n');
      // 诊断始终排空，但不把包含本机路径或未知内容的 stderr 原样写进日志。
      const diagnostics = (async () => {
        const diagnosticReader = processHandle.stderr.getReader();
        while (!(await diagnosticReader.read()).done) {}
      })();
      const reader = processHandle.stdout.getReader();
      const decoder = new TextDecoder();
      let pending = '';
      let terminal = false;
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        pending += decoder.decode(next.value, { stream: true });
        if (pending.length > 24 * 1024 * 1024) throw new BridgeError('runtime_protocol', '运行时事件超过接收上限', 502);
        let index: number;
        while ((index = pending.indexOf('\n')) >= 0) {
          const line = pending.slice(0, index);
          pending = pending.slice(index + 1);
          if (!line) continue;
          const event = decodeRuntimeEvent(line, prepared.input.request_id);
          if (event.type === 'ready' && event.version !== PROFILE_293.version) throw new BridgeError('runtime_version', '运行时版本不匹配', 502);
          if (event.type === 'completed' || event.type === 'error') terminal = true;
          await emit(event);
        }
      }
      await diagnostics;
      const exit = await processHandle.exited;
      if (pending.trim() || !terminal || exit !== 0) throw new BridgeError('runtime_exit', signal.aborted ? '请求已取消' : '运行时在完整终态前退出', 502);
    } finally {
      if (timer) clearTimeout(timer);
      if (forceKill) clearTimeout(forceKill);
      signal.removeEventListener('abort', cancel);
      if (child) { child.kill('SIGKILL'); await child.exited; }
      this.running = false;
    }
  }
}

/** 明确标记为演示的合成引擎，供页面预览与故障夹具使用。 */
export class DemoEngine implements Engine {
  readonly name = 'demo/fixture';
  readonly binarySha256 = null;

  /** 产生可审计的合成响应，不启动官方程序。
   * @param prepared 已验证输入。
   * @param signal 取消信号。
   * @param emit 事件接收器。
   * @return 演示响应结束。
   */
  async run(prepared: PreparedInput, signal: AbortSignal, emit: (event: RuntimeEvent) => Promise<void>): Promise<void> {
    const send = (payload: RuntimePayload): Promise<void> => emit(runtimeEvent(prepared.input.request_id, payload));
    const body = prepared.input.body;
    const headers: [string, string][] = [['content-type', 'application/json'], ['x-claude-code-request-class', prepared.context.requestClass], ...prepared.headers];
    const preparedBody = JSON.stringify({ ...body, metadata: { source: '演示夹具，非官方生成' } });
    await send({ type: 'cc_prepared', attempt: 1, headers, body: preparedBody, body_bytes: Buffer.byteLength(preparedBody), body_sha256: createHash('sha256').update(preparedBody).digest('hex') });
    if (signal.aborted) { await send({ type: 'completed', attempt: 1, state: 'canceled' }); return; }
    const message = { id: 'msg_demo_' + prepared.input.request_id, type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text: '这是本地演示响应，未调用上游模型。' }], stop_reason: 'end_turn', usage: { input_tokens: 0, output_tokens: 0 } };
    const streaming = body.stream === true;
    await send({ type: 'response_headers', attempt: 1, status: 200, headers: [['content-type', streaming ? 'text/event-stream' : 'application/json'], ['request-id', 'req_demo_' + prepared.input.request_id]] });
    if (streaming) {
      const events = [
        { type: 'message_start', message: { ...message, content: [] } },
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: message.content[0]!.text } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: message.usage },
        { type: 'message_stop' },
      ];
      for (const event of events) {
        if (signal.aborted) { await send({ type: 'completed', attempt: 1, state: 'canceled' }); return; }
        await send({ type: 'response_chunk', attempt: 1, data_b64: Buffer.from('event: ' + event.type + '\ndata: ' + JSON.stringify(event) + '\n\n').toString('base64') });
        await Bun.sleep(8);
      }
    } else await send({ type: 'response_chunk', attempt: 1, data_b64: Buffer.from(JSON.stringify(message)).toString('base64') });
    await send({ type: 'completed', attempt: 1, state: 'success' });
  }
}

/** 创建并校验显式选定的引擎，原生失败不会暗中回退演示。
 * @param config 控制配置。
 * @return 可执行引擎。
 */
export async function createEngine(config: EngineConfig): Promise<Engine> {
  if (config.mode === 'demo') return new DemoEngine();
  const engine = new NativeEngine(config);
  try { await engine.verify(); } catch (error) { throw new BridgeError('native_configuration', errorText(error), 503); }
  return engine;
}
