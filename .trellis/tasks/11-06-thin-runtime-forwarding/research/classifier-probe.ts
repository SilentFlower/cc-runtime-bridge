import { mkdtemp, readlink, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { startLocalPool } from '../../../../scripts/local-pool';
import { startPoolFixture } from '../../../../scripts/testing/pool-fixture';

// 研究只使用合成正文和合成凭据，必须在无外网命名空间执行。
if (await readlink('/proc/self/ns/net') === await readlink('/proc/1/ns/net') || Bun.spawnSync(['ip', 'link', 'set', 'lo', 'up']).exitCode !== 0) throw new Error('研究必须在隔离网络执行');
const binary = process.env.CCRB_TEST_ORIGINAL_BINARY;
if (!binary) throw new Error('必须显式提供固定原版');
const root = await mkdtemp(join(tmpdir(), 'ccrb-classifier-probe-'));
const fixture = startPoolFixture('synthetic-classifier-probe-key');
const app = await startLocalPool({ binary, pool: { baseUrl: fixture.baseUrl, apiKey: 'synthetic-classifier-probe-key', live: false, mode: 'manual', maxRequests: null, timeoutMs: 500 }, runId: 'classifier-probe', directory: join(root, 'run'), port: 0 });
const results: unknown[] = [];
try {
  for (const model of ['claude-opus-5-5', 'claude-sonnet-5', 'claude-sonnet-4-6', 'claude-sonnet-5']) {
    const before = fixture.calls.length;
    const body = { model, max_tokens: 64, thinking: { type: 'disabled' }, system: [{ type: 'text', text: 'x-anthropic-billing-header: cc_version=2.1.293.f4d; cc_entrypoint=cli;' }, { type: 'text', text: '合成安全分类请求：只回复允许或拒绝。' }], messages: [{ role: 'user', content: [{ type: 'text', text: '检查合成操作：读取临时目录。' }] }, { role: 'user', content: [{ type: 'text', text: '这是合成上下文。' }, { type: 'text', text: '不执行本地工具。' }] }], metadata: { user_id: JSON.stringify({ device_id: 'a'.repeat(64), account_uuid: '', session_id: '11111111-1111-4111-8111-111111111111' }) } };
    const response = await fetch('http://127.0.0.1:' + app.app.server.port + '/v1/messages', { method: 'POST', body: JSON.stringify(body) });
    const raw = await response.text();
    results.push({ model, status: response.status, poolRequests: fixture.calls.length - before, error: response.status >= 400 ? raw : null });
  }
  const result = { isolated: true, realUpstreamRequests: 0, results };
  await writeFile(resolve('.trellis/tasks/11-06-thin-runtime-forwarding/research/classifier-probe.json'), JSON.stringify(result, null, 2) + '\n');
  process.stdout.write(JSON.stringify(result) + '\n');
} finally {
  await app.close(); await fixture.close(); await rm(root, { recursive: true, force: true });
}
