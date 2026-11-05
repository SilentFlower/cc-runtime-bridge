import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import type { HeaderPair, JsonObject, PreparedInput, RuntimePayload } from '../../shared/contracts';
import { decodeRuntimeJob, runtimeEvent } from '../../shared/protocol';
import { BridgeError, errorText, isObject } from '../../shared/errors';
import { Redactor } from '../../control/redaction';
import { PROFILE_293 } from '../profile';

/** 固定 293 的内部消息实体最小接口。 */
interface NativeMessage {
  type: string;
  message: { role: string; content: unknown; model?: string };
  promptId?: string;
  turnOrigin?: string;
}
/** 来自已核对内嵌模块的消息工厂与查询入口。 */
interface NativeCore {
  Re(value: JsonObject): NativeMessage;
  Kc(value: JsonObject): NativeMessage;
  K_t(value: JsonObject): AsyncGenerator<unknown>;
}
/** 原生 SDK 构造及默认发送接口。 */
interface NativeApi {
  yN(value: JsonObject): Promise<{ beta: { messages: { create(body: JsonObject, options: JsonObject): { asResponse(): Promise<Response> } } } }>;
  Ree(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}
/** 官方配置读取初始化接口。 */
interface NativeContext { Nst(): Promise<void> }
/** 官方会话状态迁移接口。 */
interface NativeState { t_(id: string, transition: string): void }
/** 官方空权限上下文工厂。 */
interface NativePermissions { su(): unknown }

const requestId = process.env.CCRB_REQUEST_ID ?? '';
const abort = new AbortController();
const redactor = new Redactor();
const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
let started = false;

/** 保持 stdout 为有背压的单一协议通道。
 * @param payload 已知运行时事件。
 * @return 管道已接受该消息。
 */
async function emit(payload: RuntimePayload): Promise<void> {
  if (!process.stdout.write(JSON.stringify(runtimeEvent(requestId, payload)) + '\n')) await once(process.stdout, 'drain');
}

function unsupported(message: string): never {
  throw new BridgeError('unsupported_parameter', message, 422);
}

function systemTexts(value: PreparedInput['input']['body']['system']): string[] {
  const values = value === undefined ? [] : typeof value === 'string' ? [value] : value.map(block => {
    if (block.type !== 'text' || typeof block.text !== 'string' || Object.keys(block).some(key => !['type', 'text'].includes(key))) unsupported('首版 system 内容块只支持 type/text；显式缓存边界不能静默丢弃');
    return block.text as string;
  });
  if (values.some(text => /^\s*x-anthropic-billing-header:/.test(text))) unsupported('首版接收业务 system，不接收已经归因封口的 CC system 前缀');
  return values;
}

function ensureSubset(expected: unknown, actual: unknown, path: string): void {
  if (isObject(expected)) {
    if (!isObject(actual)) unsupported('原生 293 无法保留显式参数：' + path);
    for (const [key, value] of Object.entries(expected)) ensureSubset(value, actual[key], path + '.' + key);
  } else if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || expected.length !== actual.length) unsupported('原生 293 改变了显式参数：' + path);
    expected.forEach((value, index) => ensureSubset(value, actual[index], path + '[' + index + ']'));
  } else if (expected !== actual) unsupported('原生 293 改变了显式参数：' + path);
}

function normalizeContent(value: unknown): unknown {
  if (typeof value === 'string') return [{ type: 'text', text: value }];
  if (!Array.isArray(value)) return value;
  return value.map(block => isObject(block) && block.type === 'tool_result' && block.content !== undefined ? { ...block, content: normalizeContent(block.content) } : block);
}

function normalizeMessages(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  // 原生缓存策略会在字符串与文本块之间转换，比较语义表示，同时保留工具和签名的全部字段。
  return value.map(message => isObject(message) ? { ...message, content: normalizeContent(message.content) } : message);
}

/** 调用官方构造器取得实际参数，生成阶段不发送模型请求。
 * @param prepared 已验证的业务输入及上下文。
 * @param core 固定版本的消息与查询接口。
 * @param permissions 固定版本权限上下文。
 * @return 原版构造出的参数及 SDK 请求头。
 */
async function generate(prepared: PreparedInput, core: NativeCore, permissions: NativePermissions): Promise<{ body: JsonObject; headers: Headers; agent: JsonObject }> {
  const { body } = prepared.input;
  const context = prepared.context;
  const agent: JsonObject = context.agentKind === 'main' ? { agentType: 'main', agentId: context.agentId ?? context.sessionId } : {
    agentType: context.agentKind,
    agentId: context.agentId,
    parentAgentId: context.parentAgentId,
    parentPromptId: context.promptId,
    isMainSession: false,
    workflowRunId: context.workflowRunId,
  };
  const messages = body.messages.map(message => {
    if (message.role === 'assistant') {
      const value = core.Kc({ content: message.content });
      value.message.model = body.model;
      return value;
    }
    const value = core.Re({ content: message.content, promptId: context.promptId });
    value.turnOrigin = 'sdk';
    return value;
  });
  const thinking = body.thinking ?? { type: 'disabled' };
  if (!['disabled', 'enabled', 'adaptive'].includes(String(thinking.type))) unsupported('不支持的 thinking.type');
  if (thinking.type === 'enabled' && (!Number.isSafeInteger(thinking.budget_tokens) || Number(thinking.budget_tokens) < 1024)) unsupported('enabled thinking 需要不少于 1024 的 budget_tokens');
  const stop = new AbortController();
  let captured: { body: JsonObject; headers: Headers; agent: JsonObject } | undefined;
  const signal = AbortSignal.any([abort.signal, stop.signal]);
  const output = body.output_config ?? {};
  if (Object.keys(output).some(key => !['effort', 'format'].includes(key))) unsupported('首版 output_config 只支持 effort 和 format');
  try {
    for await (const ignored of core.K_t({
      messages,
      systemPrompt: systemTexts(body.system),
      thinkingConfig: {
        ...thinking,
        type: thinking.type === 'disabled' ? 'disabled' : 'enabled',
        ...(thinking.budget_tokens !== undefined ? { budgetTokens: thinking.budget_tokens } : {}),
      },
      tools: [],
      signal,
      options: {
        model: body.model,
        querySource: context.querySource,
        requestClass: context.requestClass,
        agentContext: agent,
        agentId: context.agentKind === 'main' ? undefined : context.agentId,
        getToolPermissionContext: async () => permissions.su(),
        isNonInteractiveSession: true,
        hasAppendSystemPrompt: false,
        agents: [],
        mcpTools: [],
        extraToolSchemas: body.tools ?? [],
        toolChoice: body.tool_choice,
        maxOutputTokensOverride: body.max_tokens,
        temperatureOverride: body.temperature,
        effortValue: output.effort,
        outputFormat: output.format,
        resumeIncompleteThinking: true,
        fetchOverride: async (_target: unknown, init: RequestInit) => {
          if (typeof init.body !== 'string') throw new Error('原生构造器没有提供 JSON 正文');
          const result: unknown = JSON.parse(init.body);
          if (!isObject(result)) throw new Error('原生正文不是 JSON 对象');
          captured = { body: result, headers: new Headers(init.headers), agent };
          // 只取官方组装结果，随后独立使用原生 SDK 返回原始 Response，避免代理循环解析和重试。
          stop.abort();
          throw new DOMException('原生参数已取得', 'AbortError');
        },
      },
    })) {
      void ignored;
      if (captured) break;
    }
  } catch (error) {
    if (!captured) throw error;
  }
  if (abort.signal.aborted) throw new DOMException('请求已取消', 'AbortError');
  if (!captured) throw new Error('原生 293 未能完成请求构造');
  ensureSubset(normalizeMessages(body.messages), normalizeMessages(captured.body.messages), 'messages');
  for (const key of ['max_tokens', 'temperature', 'tool_choice', 'tools', 'output_config'] as const) {
    if (body[key] !== undefined) ensureSubset(body[key], captured.body[key], key);
  }
  if (body.thinking !== undefined && !(body.thinking.type === 'disabled' && captured.body.thinking === undefined)) ensureSubset(body.thinking, captured.body.thinking, 'thinking');
  return captured;
}

/** 运行一次模型作业，只有最终原生 SDK 发送阶段访问上游。
 * @param prepared 已经完成入口验证的作业。
 * @return 作业和流已收口。
 */
async function run(prepared: PreparedInput): Promise<void> {
  redactor.register(prepared.input);
  redactor.register({ api_key: process.env.ANTHROPIC_API_KEY, token: process.env.CLAUDE_CODE_OAUTH_TOKEN });
  const core = await import(PROFILE_293.modules.core) as NativeCore;
  const api = await import(PROFILE_293.modules.api) as NativeApi;
  const context = await import(PROFILE_293.modules.context) as NativeContext;
  const state = await import(PROFILE_293.modules.state) as NativeState;
  const permissions = await import(PROFILE_293.modules.permissions) as NativePermissions;
  if (typeof core.K_t !== 'function' || typeof api.yN !== 'function' || typeof api.Ree !== 'function' || typeof context.Nst !== 'function' || typeof state.t_ !== 'function') throw new Error('固定版本的内部接口不匹配');
  await context.Nst();
  state.t_(prepared.context.sessionId, 'resume');
  const generated = await generate(prepared, core, permissions);
  const body = { ...generated.body, stream: prepared.input.body.stream === true };
  const headers = new Headers(generated.headers);
  for (const name of ['authorization', 'x-api-key', 'content-length', 'host']) headers.delete(name);
  for (const [name, value] of prepared.headers) {
    const lower = name.toLowerCase();
    if (lower === 'anthropic-beta') {
      const native = new Set((headers.get(name) ?? '').split(','));
      if (value.split(',').map(x => x.trim()).some(token => !native.has(token))) unsupported('当前原生参数无法表达请求携带的 anthropic-beta');
      continue;
    }
    if (lower === 'anthropic-version') {
      if (value !== headers.get(name)) unsupported('anthropic-version 与原生版本不一致');
      continue;
    }
    headers.append(name, value);
  }
  let resolveResponse!: (response: Response) => void;
  let rejectResponse!: (error: unknown) => void;
  const responseReady = new Promise<Response>((resolve, reject) => { resolveResponse = resolve; rejectResponse = reject; });
  let release!: () => void;
  const released = new Promise<void>(resolve => { release = resolve; });
  let calls = 0;
  const client = await api.yN({
    model: prepared.input.body.model,
    source: prepared.context.querySource,
    querySource: prepared.context.querySource,
    requestClass: prepared.context.requestClass,
    agentContext: generated.agent,
    promptId: prepared.context.promptId,
    maxRetries: 0,
    signal: abort.signal,
    fetchOverride: async (target: RequestInfo | URL, init: RequestInit) => {
      if (++calls !== 1) throw new Error('首版禁止隐式模型重试');
      if (typeof init.body !== 'string') throw new Error('原生 SDK 没有生成字符串正文');
      const outgoing = [...new Headers(init.headers).entries()] as HeaderPair[];
      redactor.register(outgoing);
      // 私有 IPC 保留原始头，让控制层也能识别仅原生配置持有的凭据；持久化统一在控制层脱敏。
      await emit({ type: 'cc_prepared', attempt: 1, body: redactor.text(init.body), headers: outgoing, body_bytes: Buffer.byteLength(init.body), body_sha256: createHash('sha256').update(init.body).digest('hex') });
      const response = await api.Ree(target, init);
      resolveResponse(response);
      // 原始响应由桥接器独占读取，SDK 不能提前消费错误正文或启动解析与重试。
      await released;
      throw new DOMException('原始响应已交还调用方', 'AbortError');
    },
  });
  const sending = client.beta.messages.create(body, { signal: abort.signal, headers }).asResponse().catch(error => { rejectResponse(error); });
  let status = 0;
  let finalState: 'success' | 'http_error' | 'canceled' = 'success';
  try {
    const response = await responseReady;
    status = response.status;
    const responseHeaders = [...response.headers.entries()] as HeaderPair[];
    await emit({ type: 'response_headers', attempt: 1, status, headers: responseHeaders });
    const reader = response.body?.getReader();
    if (reader) {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        await emit({ type: 'response_chunk', attempt: 1, data_b64: Buffer.from(next.value).toString('base64') });
      }
    }
    finalState = status >= 400 ? 'http_error' : abort.signal.aborted ? 'canceled' : 'success';
  } finally {
    release();
    await sending;
  }
  await emit({ type: 'completed', attempt: 1, state: finalState });
}

await emit({ type: 'ready', version: PROFILE_293.version });
await new Promise<void>(resolve => {
  input.on('line', (line: string) => {
    let value: unknown;
    try { value = JSON.parse(line); } catch { void emit({ type: 'error', error: '运行时输入不是 JSON' }).finally(resolve); return; }
    if (isObject(value) && value.type === 'request_cancel') { abort.abort(); return; }
    if (started) { void emit({ type: 'error', error: '一个工作进程只接受一个作业' }); return; }
    started = true;
    void (async () => {
      try {
        const job = decodeRuntimeJob(value);
        if (job.request_id !== requestId) throw new Error('作业归属不匹配');
        await run(job.prepared);
      } catch (error) {
        if (abort.signal.aborted) await emit({ type: 'completed', attempt: 1, state: 'canceled' });
        else await emit({ type: 'error', error: redactor.text(errorText(error)), ...(error instanceof BridgeError ? { code: error.code, status: error.status } : {}) });
      } finally {
        resolve();
      }
    })();
  });
  input.on('close', () => { if (!started) resolve(); });
});
// 预加载入口结束后必须退出，避免原程序继续解析 --version 并污染协议 stdout。
process.exit(0);
