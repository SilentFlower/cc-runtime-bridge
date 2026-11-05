import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseInput } from '../../../../../src/shared/input';
import { prepareInput } from '../../../../../src/control/header-policy';

// 此研究入口先独立打包，再在私有挂载空间隐藏原版、项目源码、构建脚本及全部旧临时文件。
const [binary, report, official, project] = process.argv.slice(2) as [string, string, string, string];
const hidden = { official: !await Bun.file(official).exists(), worker_source: !await Bun.file(join(project, 'src/runtime/293/worker.ts')).exists(), build_driver: !await Bun.file(join(project, 'scripts/build-runtime.ts')).exists(), extracted_source: !await Bun.file('/tmp/ccrb-compact-feasibility-tsy0tloy/modules/chunk-g263vvvn.js').exists() };
if (Object.values(hidden).some(value => !value)) throw new Error('独立部署探针未隐藏指定输入');
const root = await mkdtemp(join(tmpdir(), 'ccrb-deployment-'));
await mkdir(join(root, 'config'));
await writeFile(join(root, 'config/.claude.json'), JSON.stringify({ userID: 'a'.repeat(64) }));
let requests = 0;
const expected = JSON.stringify({ id: 'msg_deployment', type: 'message', role: 'assistant', model: 'claude-sonnet-4-6', content: [{ type: 'text', text: '单文件离线运行' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
const upstream = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) {
  if (!new URL(request.url).pathname.startsWith('/v1/messages')) return Response.json({});
  await request.text(); requests++;
  return new Response(expected, { headers: { 'content-type': 'application/json' } });
} });
const workerId = randomUUID();
const child = Bun.spawn([binary], { cwd: root, env: { HOME: root, CLAUDE_CONFIG_DIR: join(root, 'config'), PATH: '/usr/bin:/bin', LANG: 'C.UTF-8', ANTHROPIC_API_KEY: 'synthetic-deployment-key', ANTHROPIC_BASE_URL: 'http://127.0.0.1:' + upstream.port, NO_PROXY: '127.0.0.1,localhost', CCRB_WORKER_ID: workerId, CLAUDE_CODE_ENTRYPOINT: 'sdk-cli', CLAUDE_AGENT_SDK_CLIENT_APP: 'cc-runtime-bridge', CLAUDE_CODE_GATEWAY_HINT_HEADERS: '1', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1', DISABLE_AUTOUPDATER: '1', DISABLE_TELEMETRY: '1', DISABLE_ERROR_REPORTING: '1' }, stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' });
const diagnostics = (async () => { const reader = child.stderr.getReader(); while (!(await reader.read()).done) {} })();
const timer = setTimeout(() => child.kill('SIGKILL'), 20000);
let ready = false, completed = false, idle = false;
const chunks: Buffer[] = [];
let imageSha256 = '';
try {
  const reader = child.stdout.getReader(); const decoder = new TextDecoder(); let pending = '';
  while (true) {
    const next = await reader.read(); if (next.done) break;
    pending += decoder.decode(next.value, { stream: true }); let index: number;
    while ((index = pending.indexOf('\n')) >= 0) {
      const frame = JSON.parse(pending.slice(0, index)); pending = pending.slice(index + 1);
      if (frame.worker_id !== workerId) throw new Error('独立部署协议归属不匹配');
      if (frame.type === 'worker_ready') {
        if (ready) throw new Error('独立部署重复握手'); ready = true;
        const hash = createHash('sha256');
        for await (const bytes of createReadStream('/proc/' + child.pid + '/exe')) hash.update(bytes);
        imageSha256 = hash.digest('hex');
        const prepared = prepareInput(parseInput({ request_id: 'deployment-job', body: { model: 'claude-sonnet-4-6', messages: [{ role: 'user', content: '中文 العربية ภาษาไทย' }], stream: false } }));
        child.stdin.write(JSON.stringify({ type: 'request_start', schema_version: 2, worker_id: workerId, request_id: 'deployment-job', prepared }) + '\n');
      } else if (frame.type === 'request_event') {
        if (frame.payload.type === 'response_chunk') chunks.push(Buffer.from(frame.payload.data_b64, 'base64'));
        if (frame.payload.type === 'error') throw new Error('独立部署作业失败');
        if (frame.payload.type === 'completed') { if (completed || frame.payload.state !== 'success') throw new Error('独立部署终态异常'); completed = true; }
      } else if (frame.type === 'worker_idle') {
        idle = true;
        child.stdin.write(JSON.stringify({ type: 'worker_shutdown', schema_version: 2, worker_id: workerId }) + '\n');
      }
    }
  }
  const exit = await child.exited;
  if (!ready || !completed || !idle || pending || exit !== 0 || requests !== 1 || Buffer.concat(chunks).toString() !== expected) throw new Error('单文件独立部署验证未完成');
  await writeFile(report, JSON.stringify({ success: true, hidden, requests, exit, binary_sha256: createHash('sha256').update(await readFile(binary)).digest('hex'), image_sha256: imageSha256, deployment_files: [{ path: binary, bytes: (await Bun.file(binary).stat()).size }], extra_disk_expansion: false, conditions: '私有挂载与网络命名空间，原版、源码、构建脚本和旧 /tmp 均不可见；独立 HOME，合成凭据，本地 HTTP 上游' }, null, 2));
} finally {
  clearTimeout(timer); child.kill('SIGKILL'); await child.exited; await diagnostics; await upstream.stop(true); await rm(root, { recursive: true, force: true });
}
