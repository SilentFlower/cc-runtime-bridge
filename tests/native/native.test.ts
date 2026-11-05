import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { connect } from 'node:net';
import type { Duplex } from 'node:stream';
import { readConfig, startServer, type RunningServer } from '../../src/control/server';
import type { HeaderPair } from '../../src/shared/contracts';
import { createEngine, type Engine } from '../../src/control/engine';

const isolated = process.env.CCRB_NATIVE_ISOLATED === '1';
const native = isolated ? describe : describe.skip;

native('官方 293 的无外网回环链路', () => {
  let root: string;
  let app: RunningServer;
  let upstream: Bun.Server<undefined>;
  let proxy: ReturnType<typeof createServer>;
  let base: string;
  let mode: 'normal' | 'tool' | 'http_error' | 'sse_error' | 'incomplete' | 'slow' = 'normal';
  const requests: { raw: string; body: Record<string, unknown>; headers: HeaderPair[] }[] = [];
  const sockets = new Set<Duplex>();
  const upstreamSecret = 'ccrb-upstream-secret-canary';
  let expectedResponse = '';
  let nativeEngine: Engine;
  let setupMs = 0;
  const timings: { previousPid: number | null; pid: number | null; completeMs: number }[] = [];

  beforeAll(async () => {
    if (Bun.spawnSync(['ip', 'link', 'set', 'lo', 'up']).exitCode !== 0) throw new Error('无法在独立网络空间启用回环接口');
    root = await mkdtemp(join(tmpdir(), 'ccrb-native-test-'));
    await mkdir(join(root, 'home')); await mkdir(join(root, 'config'));
    const certificate = Bun.spawnSync(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(root, 'key.pem'), '-out', join(root, 'cert.pem'), '-days', '1', '-subj', '/CN=api.anthropic.com', '-addext', 'subjectAltName=DNS:api.anthropic.com'], { stdout: 'pipe', stderr: 'pipe' });
    if (certificate.exitCode !== 0) throw new Error('回环证书生成失败');
    // 固定的合成设备身份仅用于离线夹具，不复制真实账号配置。
    await writeFile(join(root, 'config', '.claude.json'), JSON.stringify({ userID: 'a'.repeat(64) }));
    upstream = Bun.serve({
      hostname: '127.0.0.1', port: 0,
      tls: { key: Bun.file(join(root, 'key.pem')), cert: Bun.file(join(root, 'cert.pem')) },
      async fetch(request) {
        const url = new URL(request.url);
        if (url.pathname !== '/v1/messages') return Response.json({});
        const raw = await request.text();
        const body = JSON.parse(raw);
        requests.push({ raw, body, headers: [...request.headers.entries()] as HeaderPair[] });
        const message = { id: 'msg_native_fixture', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text: '真实原生发送的离线响应' }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 4 } };
        if (mode === 'slow') {
          let timer: ReturnType<typeof setInterval>;
          const stream = new ReadableStream<Uint8Array>({
            start(control) {
              control.enqueue(Buffer.from('event: message_start\ndata: {"type":"message_start"}\n\n'));
              timer = setInterval(() => control.enqueue(Buffer.from(': keepalive\n\n')), 20);
              timer.unref();
              request.signal.addEventListener('abort', () => clearInterval(timer), { once: true });
            },
            cancel() { clearInterval(timer); },
          });
          return new Response(stream, { headers: { 'content-type': 'text/event-stream' } });
        }
        if (mode === 'http_error') {
          expectedResponse = JSON.stringify({ type: 'error', error: { type: 'rate_limit_error', message: upstreamSecret } });
          return new Response(expectedResponse, { status: 429, headers: { 'content-type': 'application/json', 'x-upstream-extension': 'preserved' } });
        }
        if (body.stream !== true) {
          expectedResponse = JSON.stringify(message);
          return new Response(expectedResponse, { headers: { 'content-type': 'application/json', 'request-id': 'req_native_fixture', 'x-upstream-extension': 'preserved' } });
        }
        const events: Record<string, unknown>[] = [
          { type: 'message_start', message: { ...message, content: [], stop_reason: null } },
          { type: 'content_block_start', index: 0, content_block: mode === 'tool' ? { type: 'tool_use', id: 'toolu_returned', name: 'lookup_status', input: {} } : { type: 'text', text: '' } },
          { type: 'content_block_delta', index: 0, delta: mode === 'tool' ? { type: 'input_json_delta', partial_json: '{"project":"beta"}' } : { type: 'text_delta', text: '真实原生发送的离线响应' } },
          { type: 'content_block_stop', index: 0 },
        ];
        if (mode === 'sse_error') events.push({ type: 'error', error: { type: 'overloaded_error', message: 'fixture error' } });
        else if (mode !== 'incomplete') events.push({ type: 'message_delta', delta: { stop_reason: mode === 'tool' ? 'tool_use' : 'end_turn' }, usage: message.usage }, { type: 'message_stop' });
        expectedResponse = events.map(event => 'event: ' + event.type + '\ndata: ' + JSON.stringify(event) + '\n\n').join('');
        return new Response(expectedResponse, { headers: { 'content-type': 'text/event-stream', 'request-id': 'req_native_fixture', 'x-upstream-extension': 'preserved' } });
      },
    });
    proxy = createServer();
    proxy.on('connect', (request, socket, head) => {
      if (request.url !== 'api.anthropic.com:443') { socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
      sockets.add(socket); socket.on('close', () => sockets.delete(socket));
      const target = connect(upstream.port!, '127.0.0.1', () => {
        socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head.length) target.write(head);
        socket.pipe(target); target.pipe(socket);
      });
      sockets.add(target); target.on('close', () => sockets.delete(target));
      target.on('error', () => socket.destroy()); socket.on('error', () => target.destroy());
    });
    await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve));
    const address = proxy.address();
    if (!address || typeof address === 'string') throw new Error('代理没有有效端口');
    const config = readConfig({
      CCRB_PORT: '0', CCRB_DATA_DIR: join(root, 'data'),
      CCRB_CLAUDE_BINARY: process.env.CCRB_TEST_CLAUDE_BINARY ?? '/root/.nvm/versions/node/v22.23.4/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe',
      CCRB_CLAUDE_HOME: join(root, 'home'), CCRB_CLAUDE_CONFIG_DIR: join(root, 'config'),
      CCRB_NATIVE_API_KEY: upstreamSecret, CCRB_CA_FILE: join(root, 'cert.pem'), CCRB_PROXY_URL: 'http://127.0.0.1:' + address.port,
      CCRB_TIMEOUT_MS: '15000',
    });
    // 模拟凭据仅由原生端持有的配置路径，控制层不能依赖预先知道密钥来脱敏。
    const setupStarted = performance.now();
    nativeEngine = await createEngine(config.engine);
    app = await startServer({ ...config, engine: { ...config.engine, apiKey: undefined } }, nativeEngine);
    base = 'http://127.0.0.1:' + app.server.port;
    setupMs = performance.now() - setupStarted;
    expect(nativeEngine.workerPid).toBeNull();
  }, 30000);

  afterAll(async () => {
    if (app) await app.close();
    for (const socket of sockets) socket.destroy();
    if (proxy) await new Promise<void>(resolve => proxy.close(() => resolve()));
    if (upstream) await upstream.stop(true);
    if (root) await rm(root, { recursive: true, force: true });
    const report = process.env.CCRB_NATIVE_REPORT;
    if (report) {
      await mkdir(dirname(report), { recursive: true });
      await writeFile(report, JSON.stringify({ setupMs, binarySha256: nativeEngine.binarySha256, conditions: 'HTTP 控制面及日志启用、TLS CONNECT 合成上游；与裸协议基准不同，不直接相减计算开销', timings }, null, 2));
    }
  });

  async function send(body: Record<string, unknown>, context: Record<string, unknown> = {}, headers: HeaderPair[] = []): Promise<{ response: Response; raw: string; id: string }> {
    const started = performance.now(), previousPid = nativeEngine.workerPid;
    const response = await fetch(base + '/api/requests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body, context, headers }) });
    const raw = await response.text();
    timings.push({ previousPid, pid: nativeEngine.workerPid, completeMs: performance.now() - started });
    return { response, raw, id: response.headers.get('x-ccrb-request-id')! };
  }

  function assertCch(raw: string): void {
    const decoded = JSON.parse(raw);
    expect(JSON.stringify(decoded)).toBe(raw);
    const billing = (decoded.system as { text: string }[]).find(block => block.text?.startsWith('x-anthropic-billing-header:'));
    expect(billing).toBeDefined();
    expect(billing!.text).toContain('cc_entrypoint=cli;');
    const cch = /cch=([0-9a-f]{5})/.exec(billing!.text)?.[1];
    expect(cch).not.toBe('00000');
    billing!.text = billing!.text.replace(/cch=[0-9a-f]{5}/, 'cch=00000');
    delete decoded.max_tokens;
    const neutralize = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(neutralize);
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, key === 'model' && typeof child === 'string' ? '' : neutralize(child)]));
      return value;
    };
    const expected = (Bun.hash.xxHash64(JSON.stringify(neutralize(decoded)), 0x4D659218E32A3268n) & 0xfffffn).toString(16).padStart(5, '0');
    expect(cch).toBe(expected);
  }

  test('主请求由真实 293 构造并发送，扩展头、关联和 CCH 均一致', async () => {
    mode = 'normal'; const count = requests.length;
    const prompt = '11111111-1111-4111-8111-111111111111';
    const session = '22222222-2222-4222-8222-222222222222';
    const result = await send({ model: 'claude-sonnet-4-6', messages: [{ role: 'user', content: '原生主请求' }], system: '业务系统提示词', max_tokens: 64, stream: true }, { sessionId: session, promptId: prompt }, [['x-future-feature', 'preserved'], ['Authorization', 'Bearer caller-secret-canary'], ['x-client-request-id', 'forged-client-id']]);
    expect(result.response.status).toBe(200);
    expect(result.raw).toBe(expectedResponse);
    expect(requests.length - count).toBe(1);
    const request = requests.at(-1)!; const headers = new Headers(request.headers);
    expect(headers.get('x-future-feature')).toBe('preserved');
    expect(headers.get('x-api-key')).toBe(upstreamSecret);
    expect(headers.get('x-client-request-id')).not.toContain('forged');
    expect(headers.get('x-client-request-id')).not.toContain(',');
    expect(headers.get('x-claude-code-request-class')).toBe('main');
    expect(headers.get('x-claude-code-session-id')).toBe(session);
    expect(headers.get('x-claude-code-prompt-id')).toBe(prompt);
    expect(JSON.stringify(request.body.metadata)).toContain(session);
    expect(request.raw).toContain('cc_prompt_id=' + prompt + ';');
    expect(headers.get('user-agent')).toContain('2.1.293');
    expect(headers.get('user-agent')).toContain('(external, cli, client-app/cc-runtime-bridge)');
    expect(request.body.messages).toMatchObject([{ role: 'user', content: [{ type: 'text', text: '原生主请求' }] }]);
    assertCch(request.raw);
    await app.store.flush();
    const detail = await fetch(base + '/api/logs/' + result.id).then(r => r.json());
    expect(detail.request.state).toBe('success');
    expect(detail.request.binarySha256).toHaveLength(64);
    expect(JSON.stringify(detail)).not.toContain(upstreamSecret);
    expect(JSON.stringify(detail)).not.toContain('caller-secret-canary');
    const prepared = detail.captures.find((capture: { stage: string }) => capture.stage === 'cc_prepared').text;
    expect(prepared).toContain('cch=00000');
    expect(prepared.replace(/cch=00000/, /cch=([0-9a-f]{5})/.exec(request.raw)![0])).toBe(request.raw);
    expect(detail.captures.find((capture: { stage: string }) => capture.stage === 'wire_final').status).toBe('unavailable');
  });

  test('子代理保留父子头、prompt、billing 与工具历史，返回工具不在本地执行', async () => {
    mode = 'tool'; const count = requests.length;
    const result = await send({
      model: 'claude-sonnet-4-6', stream: true, max_tokens: 64,
      messages: [
        { role: 'user', content: '查询项目状态' },
        { role: 'assistant', content: [{ type: 'thinking', thinking: '准备调用工具', signature: 'synthetic-history-signature' }, { type: 'tool_use', id: 'toolu_history', name: 'lookup_status', input: { project: 'alpha' } }] },
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_history', content: 'ready' }] },
      ],
      tools: [{ name: 'lookup_status', description: '查询状态', input_schema: { type: 'object', properties: { project: { type: 'string' } } } }],
    }, {}, [
      ['x-claude-code-request-class', 'subagent'], ['x-claude-code-agent-id', 'child-fixture'],
      ['x-claude-code-parent-agent-id', 'parent-fixture'], ['x-claude-code-agent-type', 'Explore'],
      ['x-claude-code-session-id', '33333333-3333-4333-8333-333333333333'],
      ['x-claude-code-prompt-id', '44444444-4444-4444-8444-444444444444'],
    ]);
    expect(result.raw).not.toContain('unsupported_parameter');
    expect(result.response.status).toBe(200);
    expect(result.raw).toBe(expectedResponse);
    expect(result.raw).toContain('toolu_returned');
    expect(requests.length - count).toBe(1);
    const request = requests.at(-1)!; const headers = new Headers(request.headers);
    expect(headers.get('x-claude-code-request-class')).toBe('subagent');
    expect(headers.get('x-claude-code-agent-id')).toBe('child-fixture');
    expect(headers.get('x-claude-code-parent-agent-id')).toBe('parent-fixture');
    expect(headers.get('x-claude-code-agent-type')).toBe('Explore');
    expect(request.raw).toContain('cc_is_subagent=true');
    expect(JSON.stringify(request.body.metadata)).toContain('33333333-3333-4333-8333-333333333333');
    expect(request.raw).toContain('cc_prompt_id=44444444-4444-4444-8444-444444444444;');
    expect(request.raw).toContain('toolu_history');
    expect(request.raw).toContain('synthetic-history-signature');
    assertCch(request.raw);
  });

  test('非流式请求仍使用原生 SDK，JSON 响应不经 SSE 重组', async () => {
    mode = 'normal'; const count = requests.length;
    const result = await send({ model: 'claude-sonnet-4-6', messages: [{ role: 'user', content: '非流式验证' }], max_tokens: 64, stream: false });
    expect(result.response.status).toBe(200);
    expect(result.raw).toBe(expectedResponse);
    expect(result.response.headers.get('content-type')).toContain('application/json');
    expect(requests.length - count).toBe(1);
    expect(requests.at(-1)!.body.stream).toBe(false);
    assertCch(requests.at(-1)!.raw);
  });

  test.each([
    ['compaction', {}],
    ['compaction', { agentId: 'compact-child', parentAgentId: 'compact-parent', agentType: 'Explore' }],
    ['auxiliary', {}],
    ['side_reply', {}],
    ['workflow', { agentId: 'workflow-child', parentAgentId: 'workflow-parent', workflowRunId: 'run-fixture' }],
  ] as const)('原生 %s 上下文保持分类与 billing 一致 %#', async (requestClass, extra) => {
    mode = 'normal'; const count = requests.length;
    const result = await send({ model: 'claude-sonnet-4-6', messages: [{ role: 'user', content: '分类验证' }], stream: false }, { requestClass, ...extra });
    expect(result.response.status).toBe(200); expect(result.raw).toBe(expectedResponse);
    expect(requests.length - count).toBe(1);
    const request = requests.at(-1)!; const headers = new Headers(request.headers);
    expect(headers.get('x-claude-code-request-class')).toBe(requestClass);
    expect(request.raw.includes('cc_is_subagent=true')).toBe('agentId' in extra);
    if ('agentId' in extra) expect(headers.get('x-claude-code-agent-id')).toBe(extra.agentId);
    assertCch(request.raw);
  });

  test('显式 adaptive thinking、工具选择和 effort 由原生能力生成', async () => {
    mode = 'normal';
    const result = await send({
      model: 'claude-sonnet-4-6', messages: [{ role: 'user', content: '参数保留验证' }], stream: false, max_tokens: 2048,
      thinking: { type: 'adaptive' }, output_config: { effort: 'high' }, tool_choice: { type: 'auto' },
      tools: [{ name: 'lookup_status', input_schema: { type: 'object', properties: {} } }],
    });
    expect(result.response.status).toBe(200);
    expect(requests.at(-1)!.body).toMatchObject({ thinking: { type: 'adaptive' }, output_config: { effort: 'high' }, tool_choice: { type: 'auto' }, max_tokens: 2048 });
  });

  test('原生无法保留的显式 system 缓存参数在发送前拒绝', async () => {
    const count = requests.length;
    const result = await send({ model: 'claude-sonnet-4-6', messages: [{ role: 'user', content: '不支持参数验证' }], system: [{ type: 'text', text: 'cache', cache_control: { type: 'ephemeral' } }] });
    expect(result.response.status).toBe(422);
    expect(result.raw).toContain('unsupported_parameter');
    expect(requests.length).toBe(count);
  });

  test('上游 429 状态和正文返回，原生 SDK 不额外重试', async () => {
    mode = 'http_error'; const count = requests.length;
    const result = await send({ model: 'claude-sonnet-4-6', messages: [{ role: 'user', content: 'HTTP 错误验证' }], stream: true });
    expect(result.response.status).toBe(429);
    expect(result.raw).toBe(expectedResponse);
    expect(result.response.headers.get('x-upstream-extension')).toBe('preserved');
    expect(requests.length - count).toBe(1);
    await app.store.flush();
    const detail = await fetch(base + '/api/logs/' + result.id).then(r => r.json());
    expect(detail.request.state).toBe('http_error');
    expect(JSON.stringify(detail)).not.toContain(upstreamSecret);
  });

  test.each([['sse_error', 'stream_error'], ['incomplete', 'incomplete']] as const)('真实原生 %s 的日志终态正确', async (kind, state) => {
    mode = kind;
    const result = await send({ model: 'claude-sonnet-4-6', messages: [{ role: 'user', content: '流终态验证' }], stream: true });
    expect(result.raw).toBe(expectedResponse);
    await app.store.flush();
    expect((await fetch(base + '/api/logs/' + result.id).then(r => r.json())).request.state).toBe(state);
  });

  test('取消传播至原生流，下一请求继续运行且取消请求没有重试', async () => {
    mode = 'slow'; const count = requests.length;
    const cancel = new AbortController();
    const response = await fetch(base + '/api/requests', {
      method: 'POST', signal: cancel.signal, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ request_id: 'native-cancel', body: { model: 'claude-sonnet-4-6', messages: [{ role: 'user', content: '取消验证' }], stream: true } }),
    });
    const reader = response.body!.getReader(); void reader.closed.catch(() => {});
    const canceledPid = nativeEngine.workerPid;
    await reader.read(); cancel.abort(); await reader.cancel().catch(() => {});
    let state: string | undefined;
    for (let i = 0; i < 100; i++) {
      await Bun.sleep(25); await app.store.flush();
      state = (await app.store.detail('native-cancel'))?.request.state;
      if (state && !['queued', 'running'].includes(state)) break;
    }
    expect(state).toBe('canceled'); expect(requests.length - count).toBe(1);
    expect((await app.store.detail('native-cancel'))?.captures.find(item => item.stage === 'upstream_response')?.status).toBe('incomplete');
    mode = 'normal';
    const next = await send({ model: 'claude-sonnet-4-6', messages: [{ role: 'user', content: '取消后的下一请求' }], stream: false });
    expect(next.response.status).toBe(200); expect(next.raw).toBe(expectedResponse);
    expect(nativeEngine.workerPid).not.toBe(canceledPid);
    expect(requests.length - count).toBe(2);
  });

  test('相同 session 的多轮保持同一 PID，主子代理与 Unicode 正文不串入下一轮', async () => {
    mode = 'normal';
    const sessionId = '55555555-5555-4555-8555-555555555555';
    let pid: number | null = null;
    for (let i = 0; i < 6; i++) {
      const promptId = '66666666-6666-4666-8666-' + String(i).padStart(12, '0');
      const text = '第 ' + i + ' 轮：中文 العربية ภาษาไทย e\u0301 👨‍👩‍👧‍👦';
      const count = requests.length;
      const extra = i % 2 === 0 ? {} : { agentId: 'child-' + i, parentAgentId: 'parent-' + i, agentType: 'Explore' };
      const result = await send({ model: 'claude-sonnet-4-6', messages: [{ role: 'user', content: text }], stream: false }, { sessionId, promptId, ...extra });
      expect(result.response.status).toBe(200);
      expect(requests.length - count).toBe(1);
      pid ??= nativeEngine.workerPid;
      expect(nativeEngine.workerPid).toBe(pid);
      const request = requests.at(-1)!;
      const headers = new Headers(request.headers);
      expect(headers.get('x-claude-code-prompt-id')).toBe(promptId);
      expect(headers.get('x-claude-code-session-id')).toBe(sessionId);
      expect(headers.get('x-claude-code-agent-id')).toBe(i % 2 ? 'child-' + i : null);
      expect(request.raw).toContain('cc_prompt_id=' + promptId);
      expect(JSON.stringify(request.body.messages)).toContain(text);
      if (i) expect(request.raw).not.toContain('第 ' + (i - 1) + ' 轮');
      assertCch(request.raw);
      await app.store.flush();
      expect((await app.store.detail(result.id))?.request.binarySha256).toBe(nativeEngine.binarySha256);
    }
  });

  test('进程意外退出后下一作业重建，不重放已完成请求', async () => {
    const pid = nativeEngine.workerPid!;
    process.kill(pid, 'SIGKILL');
    for (let i = 0; i < 100 && nativeEngine.workerPid; i++) await Bun.sleep(10);
    const count = requests.length;
    const result = await send({ model: 'claude-sonnet-4-6', messages: [{ role: 'user', content: '崩溃后的下一轮' }], stream: false });
    expect(result.response.status).toBe(200);
    expect(nativeEngine.workerPid).not.toBe(pid);
    expect(requests.length - count).toBe(1);
  });

  test('流中进程被终止时保留已返回字节，收口后下一轮重建且不重放', async () => {
    mode = 'slow';
    const count = requests.length;
    const response = await fetch(base + '/api/requests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ request_id: 'native-stream-crash', body: { model: 'claude-sonnet-4-6', messages: [{ role: 'user', content: '流中故障验证' }], stream: true } }) });
    const reader = response.body!.getReader();
    const first = await reader.read();
    expect(Buffer.from(first.value!).toString()).toContain('message_start');
    const pid = nativeEngine.workerPid!;
    process.kill(pid, 'SIGKILL');
    while (!(await reader.read()).done) {}
    await app.store.flush();
    const detail = await app.store.detail('native-stream-crash');
    expect(detail?.request.state).toBe('error');
    expect(detail?.captures.find(item => item.stage === 'upstream_response')?.status).toBe('incomplete');
    expect(requests.length - count).toBe(1);
    mode = 'normal';
    const next = await send({ model: 'claude-sonnet-4-6', messages: [{ role: 'user', content: '流故障后的下一轮' }], stream: false });
    expect(next.response.status).toBe(200);
    expect(nativeEngine.workerPid).not.toBe(pid);
    expect(requests.length - count).toBe(2);
  });
});
