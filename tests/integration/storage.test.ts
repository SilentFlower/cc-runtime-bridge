import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Database } from 'bun:sqlite';
import { LogStore } from '../../src/control/log-store';
import type { LogSnapshot, LogWriterConfig } from '../../src/control/log-schema';

const roots: string[] = [];
const stores: LogStore[] = [];
afterEach(async () => { for (const store of stores.splice(0)) await store.close(); for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });

function snapshot(id: string, ageDays = 0, text = '持久原文', state: 'success' | 'running' = 'success'): LogSnapshot {
  const createdAt = new Date(Date.now() - ageDays * 86400000).toISOString();
  return {
    request: { id, createdAt, finishedAt: state === 'running' ? null : createdAt, model: 'fixture', requestClass: 'main', sessionId: 'session-fixture', promptId: 'prompt-fixture', agentId: 'root-fixture', parentAgentId: null, state, httpStatus: 200, durationMs: 1, headersMs: 1, firstOutputMs: 1, mode: 'debug', engine: 'test/storage', binarySha256: null, error: null, captureError: null },
    context: { requestClass: 'main', sessionId: 'session-fixture', promptId: 'prompt-fixture', agentKind: 'main', agentId: 'root-fixture', querySource: 'sdk', source: 'bridge-default' },
    decisions: [],
    captures: [{ stage: 'ingress', attempt: 1, capturedAt: createdAt, source: 'test_fixture', representation: 'utf8', status: 'complete', observedBytes: Buffer.byteLength(text), storedBytes: Buffer.byteLength(text), sha256: null, text, headers: [], note: null }],
  };
}

async function open(config?: LogWriterConfig): Promise<{ store: LogStore; config: LogWriterConfig }> {
  if (!config) {
    const root = await mkdtemp(join(tmpdir(), 'ccrb-storage-test-')); roots.push(root);
    config = { dbPath: join(root, 'logs.sqlite'), bodyDir: join(root, 'bodies'), retainDays: 7, debugRetainDays: 3, maxBytes: 1024 * 1024 };
  }
  const store = new LogStore(config); await store.open(); stores.push(store);
  return { store, config };
}

test('正文先过期，摘要在各自保留期内仍然可查', async () => {
  const { store, config } = await open();
  store.record(snapshot('expired-all', 8)); store.record(snapshot('expired-body', 4)); store.record(snapshot('recent', 1));
  await store.flush();
  expect(await store.detail('expired-all')).toBeNull();
  const expired = await store.detail('expired-body');
  expect(expired?.captures[0]?.status).toBe('unavailable');
  expect(expired?.captures[0]?.text).toBeNull();
  expect(expired?.captures[0]?.note).toBe('原文已过保留期');
  expect((await store.detail('recent'))?.captures[0]?.text).toBe('持久原文');
  expect(await readdir(config.bodyDir)).toHaveLength(1);
});

test('容量按 UTF-8 载荷计算，超限回收最旧的已完成请求', async () => {
  const initial = await open(); const config = { ...initial.config, maxBytes: 7500 };
  await initial.store.close(); stores.splice(stores.indexOf(initial.store), 1);
  const { store } = await open(config);
  for (let i = 0; i < 6; i++) store.record(snapshot('quota-' + i, (6 - i) / 24, '正文'.repeat(300)));
  await store.flush();
  expect(store.error).toBeNull();
  const result = store.list();
  expect(result.total).toBeGreaterThan(0); expect(result.total).toBeLessThan(6);
  expect(await store.detail('quota-0')).toBeNull();
  expect((await store.detail('quota-5'))?.captures[0]?.text).toBe('正文'.repeat(300));
  const db = new Database(config.dbPath, { readonly: true });
  try {
    const usage = db.query<{ bytes: number }, []>('SELECT COALESCE((SELECT SUM(LENGTH(CAST(payload AS BLOB))+LENGTH(CAST(context_json AS BLOB))+LENGTH(CAST(decisions_json AS BLOB))) FROM requests),0)+COALESCE((SELECT SUM(LENGTH(CAST(payload AS BLOB))+json_extract(payload,"$.storedBytes")) FROM captures),0) AS bytes').get();
    expect(usage!.bytes).toBeLessThanOrEqual(config.maxBytes);
  } finally { db.close(); }
});

test('控制进程重启后保留详情，并把未确认的运行中记录标为未完成', async () => {
  const first = await open();
  first.store.record(snapshot('persisted')); first.store.record(snapshot('unfinished', 0, '请求前缀', 'running')); await first.store.flush();
  await first.store.close(); stores.splice(stores.indexOf(first.store), 1);
  const { store } = await open(first.config);
  expect((await store.detail('persisted'))?.captures[0]?.text).toBe('持久原文');
  const unfinished = await store.detail('unfinished');
  expect(unfinished?.request.state).toBe('incomplete');
  expect(unfinished?.request.captureError).toContain('没有保存完整终态');
  expect(unfinished?.context?.agentId).toBe('root-fixture');
});

test('正文文件损坏或丢失会明确标出采集失败', async () => {
  const { store, config } = await open();
  store.record(snapshot('missing-body')); await store.flush();
  const [file] = await readdir(config.bodyDir); await rm(join(config.bodyDir, file!));
  const detail = await store.detail('missing-body');
  expect(detail?.captures[0]?.status).toBe('failed');
  expect(detail?.captures[0]?.text).toBeNull();
});
