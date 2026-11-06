import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Engine } from '../../src/control/engine';
import type { PreparedInput, RuntimeEvent, RuntimePayload } from '../../src/shared/contracts';
import { runtimeEvent } from '../../src/shared/protocol';
import { readConfig, startServer, type RunningServer, type ServerStartupOptions } from '../../src/control/server';
import { createHash } from 'node:crypto';
import { Database } from 'bun:sqlite';
import { BridgeService } from '../../src/control/service';

const roots: string[] = [];
const apps: RunningServer[] = [];
afterEach(async () => { for (const app of apps.splice(0)) await app.close(); for (const dir of roots.splice(0)) await rm(dir, { recursive: true, force: true }); });

async function app(engine?: Engine, settings: Record<string, string> = {}, startup: ServerStartupOptions = {}): Promise<{ app: RunningServer; base: string; root: string }> {
  const root = await mkdtemp(join(tmpdir(), 'ccrb-control-test-')); roots.push(root);
  const cfg = readConfig({ CCRB_MODE: 'demo', CCRB_PORT: '0', CCRB_DATA_DIR: root, ...settings });
  const running = await startServer(cfg, engine, startup); apps.push(running);
  return { app: running, base: 'http://127.0.0.1:' + running.server.port, root };
}

function post(base: string, value: unknown): Promise<Response> {
  return fetch(base + '/api/requests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });
}

const request = { model: 'claude-sonnet-4-6', messages: [{ role: 'user', content: '本地集成测试' }], stream: true };

describe('控制、持久日志与查询', () => {
  test.each(['debug','summary','off'] as const)('独立最终采集遵守 %s，秘密先注册且原始哈希不变', async mode => {
    const secret = 'final-capture-pool-canary', raw = JSON.stringify({ echo: secret, text: '采集正文'.repeat(800) });
    let reads = 0;
    const { app: running, base } = await app(undefined, { CCRB_LOG_MODE: mode, CCRB_CAPTURE_BYTES: '1024' }, { secrets: { pool_api_key: secret }, finalCapture: () => { reads++; return { body: raw, headers: [['x-api-key',secret]], capturedAt: new Date().toISOString(), httpVersion: '1.1', verified: true, note: '隔离合成样本' }; } });
    const response = await post(base, { request_id: 'final-' + mode, body: request }); await response.text(); await running.store.flush();
    expect(response.status).toBe(200); expect(reads).toBe(1);
    expect((await (await fetch(base + '/api/health')).json()).nativeFinalCapture).toBe(true);
    const value = await running.store.detail('final-' + mode);
    if (mode === 'off') expect(value).toBeNull();
    else {
      const captured = value!.captures.find(item => item.stage === 'wire_final')!;
      expect(captured.sha256).toBe(createHash('sha256').update(raw).digest('hex')); expect(JSON.stringify(value)).not.toContain(secret);
      expect(captured.text).toBe(mode === 'summary' ? null : captured.text);
      expect(captured.status).toBe(mode === 'debug' ? 'truncated' : 'complete');
      if (mode === 'debug') expect(captured.text).toContain('[REDACTED]');
    }
  });

  test('最终采集失败和缺失不改变响应终态，不用中间值补写', async () => {
    for (const fail of [false, true]) {
      const { app: running, base } = await app(undefined, {}, { finalCapture: () => { if (fail) throw new Error('private-error-canary'); return null; } });
      const response = await post(base, { request_id: 'capture-failure-' + fail, body: request }); await response.text(); await running.store.flush();
      const value = (await running.store.detail('capture-failure-' + fail))!;
      expect(value.request.state).toBe('success'); expect(value.captures.find(item => item.stage === 'wire_final')!.status).toBe(fail ? 'failed' : 'unavailable');
      expect(JSON.stringify(value)).not.toContain('private-error-canary');
    }
  });

  test('完整链路保留扩展头决策、原文和独立哈希，查询不再执行模型', async () => {
    const { app: running, base, root } = await app();
    const response = await post(base, { request_id: 'control-request', body: request, headers: [['x-future-header', 'kept'], ['Authorization', 'Bearer client-secret-canary']] });
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(text).toContain('message_stop');
    await running.store.flush();
    const detail = await fetch(base + '/api/logs/control-request').then(r => r.json());
    expect(detail.request.state).toBe('success');
    expect(detail.decisions).toContainEqual({ name: 'x-future-header', action: 'keep', reason: '合法端到端扩展，默认保留' });
    expect(detail.captures.find((c: { stage: string }) => c.stage === 'wire_final').status).toBe('unavailable');
    expect(detail.captures.find((c: { stage: string }) => c.stage === 'upstream_response').sha256).toBe(createHash('sha256').update(text).digest('hex'));
    expect(JSON.stringify(detail)).not.toContain('client-secret-canary');
    for (const name of await readdir(join(root, 'bodies'))) expect(await readFile(join(root, 'bodies', name), 'utf8')).not.toContain('client-secret-canary');
    expect((await fetch(base + '/api/logs').then(r => r.json())).total).toBe(1);
    expect((await fetch(base + '/api/logs?model=' + encodeURIComponent("' OR 1=1 --")).then(r => r.json())).total).toBe(0);
    const duplicate = await post(base, { request_id: 'control-request', body: request });
    expect(duplicate.status).toBe(409);
    await duplicate.text();
  });

  test('非法来源保留拒绝记录，不伪造 main 上下文', async () => {
    const { app: running, base } = await app();
    const result = await post(base, { body: request, headers: [['x-claude-code-request-class', 'main'], ['x-claude-code-agent-id', 'child']] });
    expect(result.status).toBe(400); await result.text(); await running.store.flush();
    const rows = (await fetch(base + '/api/logs').then(r => r.json())).rows;
    expect(rows[0].state).toBe('error'); expect(rows[0].requestClass).toBe('unknown');
    const detail = await fetch(base + '/api/logs/' + rows[0].id).then(r => r.json());
    expect(detail.context).toBeNull();
  });

  test('入站原文保存 HTTP 的原始空白与转义，哈希不使用 JSON 重序列化', async () => {
    const { app: running, base } = await app();
    const raw = '{\n  "request_id" : "raw-ingress", "body" : ' + JSON.stringify(request) + '\n}\n';
    const response = await fetch(base + '/api/requests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw });
    await response.text(); await running.store.flush();
    const capture = (await running.store.detail('raw-ingress'))!.captures.find(item => item.stage === 'ingress')!;
    expect(capture.text).toBe(raw);
    expect(capture.sha256).toBe(createHash('sha256').update(raw).digest('hex'));
  });

  test.each(['summary', 'off'])('模式 %s 不保存正文', async mode => {
    const { app: running, base } = await app(undefined, { CCRB_LOG_MODE: mode });
    const response = await post(base, { request_id: 'mode-test', body: request });
    await response.text(); await running.store.flush();
    const detailResponse = await fetch(base + '/api/logs/mode-test');
    if (mode === 'off') expect(detailResponse.status).toBe(404);
    else {
      const detail = await detailResponse.json();
      expect(detail.captures.every((c: { text: unknown }) => c.text === null)).toBe(true);
      expect(detail.request.state).toBe('success');
    }
  });

  test('日志截断与上游完整完成是不同状态', async () => {
    const { app: running, base } = await app(undefined, { CCRB_CAPTURE_BYTES: '1024' });
    const response = await post(base, { request_id: 'truncated-test', body: { ...request, messages: [{ role: 'user', content: '长原文'.repeat(2000) }] } });
    await response.text(); await running.store.flush();
    const detail = await fetch(base + '/api/logs/truncated-test').then(r => r.json());
    expect(detail.request.state).toBe('success');
    expect(detail.captures.find((c: { stage: string }) => c.stage === 'ingress').status).toBe('truncated');
  });

  test('页面和只读 API 拒绝跨来源访问', async () => {
    const { base } = await app();
    const response = await fetch(base + '/api/logs', { headers: { origin: 'https://untrusted.invalid' } });
    expect(response.status).toBe(403);
    const html = await fetch(base + '/');
    expect(html.headers.get('content-security-policy')).toContain("script-src 'self'");
  });
});

/** 可控的响应终态夹具，不访问任何模型。 */
class FixtureEngine implements Engine {
  readonly name = 'test/fixture';
  readonly binarySha256 = null;
  readonly workerPid = null;
  calls = 0;
  /** 合成夹具没有持久进程。
   * @return 无需释放资源。
   */
  async close(): Promise<void> {}
  /** 设置响应行为。
   * @param kind 失败、缺失终态或持续流。
   */
  constructor(private readonly kind: 'error' | 'incomplete' | 'slow') {}
  /** 产生一次可观测响应。
   * @param prepared 已验证请求。
   * @param signal 调用方取消。
   * @param emit 事件接收器。
   * @return 夹具结束。
   */
  async run(prepared: PreparedInput, signal: AbortSignal, emit: (event: RuntimeEvent) => Promise<void>): Promise<void> {
    this.calls++;
    const send = (payload: RuntimePayload): Promise<void> => emit(runtimeEvent(prepared.input.request_id, payload));
    await send({ type: 'response_headers', attempt: 1, status: 200, headers: [['content-type', 'text/event-stream']] });
    if (this.kind === 'slow') {
      while (!signal.aborted) { await send({ type: 'response_chunk', attempt: 1, data_b64: Buffer.from(': keepalive\n\n').toString('base64') }); await Bun.sleep(20); }
      await send({ type: 'completed', attempt: 1, state: 'canceled' });
      return;
    }
    const raw = this.kind === 'error' ? 'event: error\ndata: {"type":"error","error":{"message":"upstream failed"}}\n\n' : 'event: ping\ndata: {"type":"ping"}\n\n';
    await send({ type: 'response_chunk', attempt: 1, data_b64: Buffer.from(raw).toString('base64') });
    await send({ type: 'completed', attempt: 1, state: 'success' });
  }
}

test.each([['error', 'stream_error'], ['incomplete', 'incomplete']] as const)('HTTP 200 %s 按真实终态记录', async (kind, state) => {
  const fixture = new FixtureEngine(kind);
  const { app: running, base } = await app(fixture);
  const response = await post(base, { request_id: 'fixture-test', body: request });
  const raw = await response.text(); expect(response.status).toBe(200);
  expect(raw).toContain(kind === 'error' ? '"type":"error"' : '"type":"ping"');
  await running.store.flush();
  expect((await fetch(base + '/api/logs/fixture-test').then(r => r.json())).request.state).toBe(state);
  expect(fixture.calls).toBe(1);
});

test('客户端取消能收口正在返回的流，不重放请求', async () => {
  const fixture = new FixtureEngine('slow');
  const { app: running, base } = await app(fixture);
  const abort = new AbortController();
  const response = await fetch(base + '/api/requests', { method: 'POST', signal: abort.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ request_id: 'cancel-test', body: request }) });
  const reader = response.body!.getReader();
  void reader.closed.catch(() => {});
  await reader.read(); abort.abort();
  await reader.cancel().catch(() => {});
  await Bun.sleep(100); await running.store.flush();
  const detail = await fetch(base + '/api/logs/cancel-test').then(r => r.json());
  expect(detail.request.state).toBe('canceled');
  expect(fixture.calls).toBe(1);
});

test('正文写入故障不会阻塞或重放当前响应，健康状态显示采集缺口', async () => {
  const fixture = new FixtureEngine('error');
  const { app: running, base, root } = await app(fixture);
  await rm(join(root, 'bodies'), { recursive: true }); await writeFile(join(root, 'bodies'), '模拟不可写目录');
  const response = await post(base, { request_id: 'write-failure', body: request });
  expect(response.status).toBe(200); expect(await response.text()).toContain('upstream failed');
  await running.store.flush();
  expect((await fetch(base + '/api/health').then(r => r.json())).captureError).toBe('日志写入失败');
  expect(fixture.calls).toBe(1);
});

test('SQLite 写线程等待锁时，主响应继续返回且不重放请求', async () => {
  const fixture = new FixtureEngine('error');
  const { app: running, base, root } = await app(fixture);
  const lock = new Database(join(root, 'logs.sqlite'));
  lock.exec('BEGIN IMMEDIATE');
  try {
    const begin = performance.now();
    const response = await post(base, { request_id: 'slow-writer', body: request });
    expect(await response.text()).toContain('upstream failed');
    expect(performance.now() - begin).toBeLessThan(1500);
    expect(fixture.calls).toBe(1);
  } finally { lock.exec('ROLLBACK'); lock.close(); }
  await running.store.flush();
  expect((await running.store.detail('slow-writer'))?.request.state).toBe('stream_error');
});

test('慢消费者在超时后解除背压，关闭服务不会卡死', async () => {
  const fixture = new FixtureEngine('slow');
  const { app: running } = await app();
  const service = new BridgeService(fixture, running.store, { mode: 'debug', maxBodyBytes: 1024, timeoutMs: 100 });
  // 暂不读取正文，让首个 writer.write 真正停在背压点。
  const response = await service.submit({ request_id: 'slow-consumer', body: request });
  await Bun.sleep(150);
  await service.close();
  await response.text().catch(() => '已中断');
  await running.store.flush();
  expect((await running.store.detail('slow-consumer'))?.request.state).toBe('error');
  expect(fixture.calls).toBe(1);
});

test('默认无总预算，20 个提交继续串行执行且不产生队列准入错误', async () => {
  expect(readConfig({}).engine.timeoutMs).toBe(0);
  const fixture = new FixtureEngine('incomplete'), entered: string[] = [];
  const original = fixture.run.bind(fixture);
  let release!: () => void, first!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { first = resolve; });
  fixture.run = async (prepared, signal, emit) => { entered.push(prepared.input.request_id); first(); await gate; await original(prepared, signal, emit); };
  const { app: running } = await app();
  const service = new BridgeService(fixture, running.store, { mode: 'off', maxBodyBytes: 1024, timeoutMs: 0 });
  try {
    const responses = Array.from({ length: 20 }, (_, index) => service.submit({ request_id: 'queued-' + index, body: request }).then(async response => { await response.text(); return response.status; }));
    await started; await Bun.sleep(20);
    expect(entered).toEqual(['queued-0']); release();
    expect(await Promise.all(responses)).toEqual(Array(20).fill(200));
    expect(entered).toEqual(Array.from({ length: 20 }, (_, index) => 'queued-' + index)); expect(fixture.calls).toBe(20);
  } finally { release(); await service.close(); }
});
