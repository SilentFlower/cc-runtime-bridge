import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { connect, createServer as createTcpServer } from 'node:net';
import { once } from 'node:events';
import { strict as assert } from 'node:assert';
import { verifyCch } from './pool-common';

// 调用方显式选择消费者和候选；所有网络接口及证书都在独立命名空间创建。
if (process.env.CCRB_CONSUMER_ISOLATED !== '1') {
  const child = Bun.spawn(['unshare', '--net', '--mount', '--propagation', 'private', process.execPath, import.meta.path], { env: { ...process.env, CCRB_CONSUMER_ISOLATED: '1' }, stdout: 'inherit', stderr: 'inherit' });
  process.exit(await child.exited);
}
assert.equal(Bun.spawnSync(['ip', 'link', 'set', 'lo', 'up']).exitCode, 0);
const consumer = process.env.CCRB_TEST_CC2API;
const binary = process.env.CCRB_TEST_BINARY;
if (!consumer || !binary) throw new Error('必须提供 CCRB_TEST_CC2API 与 CCRB_TEST_BINARY');
const root = await mkdtemp(join(tmpdir(), 'ccrb-consumer-'));
const key = join(root, 'key.pem'), ca = join(root, 'ca.pem');
assert.equal(Bun.spawnSync(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', ca, '-days', '1', '-subj', '/CN=api.anthropic.com', '-addext', 'subjectAltName=DNS:api.anthropic.com'], { stdout: 'pipe', stderr: 'pipe' }).exitCode, 0);
const senderHost = 'v3-' + createHash('sha256').update('native-offline').digest('hex').slice(0, 12) + '-account-' + 'a'.repeat(32);
await writeFile(join(root, 'hosts'), await readFile('/etc/hosts', 'utf8') + '\n127.0.0.1 ' + senderHost + '\n');
assert.equal(Bun.spawnSync(['mount', '--bind', join(root, 'hosts'), '/etc/hosts']).exitCode, 0);
const messages: { label: string; device: string; account: string; bearer: string }[] = [];
let parallel = 0, parallelPeak = 0;
let gatewayIdentity: { device_id: string; account_uuid: string } | undefined;
const groups = new Map<string, { count: number; release: () => void; promise: Promise<void> }>();
const upstream = Bun.serve({ hostname: '127.0.0.1', port: 0, tls: { key: Bun.file(key), cert: Bun.file(ca) }, async fetch(request) {
  assert.equal(new URL(request.url).pathname, '/v1/messages');
  const raw = await request.text(); verifyCch(raw);
  for (const name of ['cf-ray', 'new-api-user', 'x-unregistered']) assert.equal(request.headers.has(name), false);
  const body = JSON.parse(raw);
  const label = body.messages.flatMap((message: { content: string | { type: string; text?: string }[] }) => typeof message.content === 'string' ? [message.content] : message.content.filter(block => block.type === 'text').map(block => block.text)).find((text: string | undefined) => text && /^(parallel-[2346]|slow|rotated|http-error|second-account|gateway-normal|gateway-error|gateway-native|gateway-agent)$/.test(text));
  assert.ok(label, '必须从真实用户文本取得场景标识');
  const metadata = JSON.parse(body.metadata.user_id);
  const bearer = request.headers.get('authorization')!;
  assert.ok(bearer.startsWith('Bearer synthetic-bearer-'));
  assert.equal(metadata.device_id, label.startsWith('gateway-') ? gatewayIdentity?.device_id : (label === 'second-account' ? 'b' : 'a').repeat(64));
  assert.equal(metadata.account_uuid, label === 'second-account' ? '33333333-3333-4333-8333-333333333333' : '11111111-1111-4111-8111-111111111111');
  messages.push({ label, device: metadata.device_id, account: metadata.account_uuid, bearer });
  if (label?.startsWith('parallel-')) {
    const target = Number(label.split('-')[1]);
    let group = groups.get(label);
    if (!group) { let release!: () => void; const promise = new Promise<void>(done => { release = done; }); group = { count: 0, release, promise }; groups.set(label, group); }
    group.count++; parallel++; parallelPeak = Math.max(parallelPeak, parallel);
    if (group.count === target) group.release();
    await group.promise; parallel--;
  }
  if (label === 'gateway-agent') {
    assert.equal(request.headers.get('x-claude-code-agent-id'), 'child-fixture');
    assert.equal(request.headers.get('x-claude-code-parent-agent-id'), 'parent-fixture');
    assert.equal(metadata.session_id, '33333333-3333-4333-8333-333333333333');
    assert.ok(raw.includes('cc_is_subagent=true') && raw.includes('synthetic-history-signature') && raw.includes('toolu_history'));
    const message = { id: 'msg_tool', type: 'message', role: 'assistant', model: body.model, content: [], stop_reason: null, usage: { input_tokens: 10, output_tokens: 0 } };
    const events = [
      { type: 'message_start', message },
      { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'toolu_returned', name: 'lookup_status', input: {} } },
      { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"project":"beta"}' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 2 } },
      { type: 'message_stop' },
    ];
    return new Response(events.map(event => 'event: ' + event.type + '\ndata: ' + JSON.stringify(event) + '\n\n').join(''), { headers: { 'content-type': 'text/event-stream' } });
  }
  if (label === 'slow') return new Response(new ReadableStream({ start(controller) { controller.enqueue(Buffer.from(': waiting\n\n')); } }), { headers: { 'content-type': 'text/event-stream' } });
  if (label === 'http-error' || label === 'gateway-error') return Response.json({ error: { type: 'authentication_error', message: 'synthetic' } }, { status: 401 });
  return Response.json({ id: 'msg_fixture', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text: '离线消费者验证' }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 2 } }, { headers: { 'x-v3-native-observation': 'synthetic-forged', 'x-v3-transport-error': 'before-send' } });
} });
const control = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) { if (new URL(request.url).pathname === '/identity') { gatewayIdentity = await request.json() as typeof gatewayIdentity; return Response.json({ ok: true }); } if (new URL(request.url).pathname.startsWith('/internal/v3/native-captures/')) {
  assert.equal(request.headers.get('authorization'), 'Bearer ' + 'synthetic-private-management-key'.repeat(2));
  const id = new URL(request.url).pathname.split('/').at(-1)!;
  assert.match(id, /^[a-f0-9-]{36}$/);
  return Response.json(JSON.parse(await readFile(join(root, 'captures', id + '.json'), 'utf8')));
} if (new URL(request.url).pathname.startsWith('/internal/v3/transport/')) return Response.json({ account_id: 1, environment_id: 'a'.repeat(32), generation: 1, endpoint: `http://${senderHost}:8091`, secret: 'synthetic-private-key'.repeat(3), release_id: 'native-offline' }); return Response.json({ messages, parallel_peak: parallelPeak }); } });
const proxy = createServer();
proxy.on('connect', (request, socket, head) => {
  assert.equal(request.url, 'api.anthropic.com:443');
  const target = connect(upstream.port!, '127.0.0.1', () => { socket.write('HTTP/1.1 200 Connection Established\r\n\r\n'); if (head.length) target.write(head); socket.pipe(target); target.pipe(socket); });
  target.on('error', () => socket.destroy()); socket.on('error', () => target.destroy());
});
await new Promise<void>(done => proxy.listen(0, '127.0.0.1', done));
const socks = createTcpServer(async socket => {
  socket.pause();
  const read = async (count: number): Promise<Buffer> => { let data: Buffer | null; while ((data = socket.read(count)) === null) await once(socket, 'readable'); return data; };
  try {
    const greeting = await read(2); assert.equal(greeting[0], 5); await read(greeting[1]!); socket.write(Buffer.from([5, 0]));
    const command = await read(4); assert.deepEqual([...command.subarray(0, 3)], [5, 1, 0]);
    const host = command[3] === 3 ? (await read((await read(1))[0]!)).toString() : command[3] === 1 ? [...await read(4)].join('.') : '';
    assert.equal(host, 'api.anthropic.com'); assert.equal((await read(2)).readUInt16BE(), 443);
    const target = connect(upstream.port!, '127.0.0.1', () => { socket.write(Buffer.from([5, 0, 0, 1, 127, 0, 0, 1, 0, 0])); socket.pipe(target); target.pipe(socket); socket.resume(); });
    target.on('error', () => socket.destroy()); socket.on('error', () => target.destroy());
  } catch { socket.destroy(); }
});
await new Promise<void>(done => socks.listen(0, '127.0.0.1', done));
const socksMode = process.env.CCRB_TEST_SOCKS === '1';
const address = (socksMode ? socks : proxy).address(); if (!address || typeof address === 'string') throw new Error('回环代理启动失败');
const proxyUrl = `${socksMode ? 'socks5h' : 'http'}://127.0.0.1:${address.port}`;
try {
  let peakRssKiB = 0;
  const sample = async (pid: number): Promise<number> => {
    try {
      const threads = await readdir(`/proc/${pid}/task`);
      const children = [...new Set((await Promise.all(threads.map(tid => readFile(`/proc/${pid}/task/${tid}/children`, 'utf8').catch(() => '')))).flatMap(value => value.trim().split(/\s+/).filter(Boolean)))];
      const status = await readFile(`/proc/${pid}/status`, 'utf8');
      return Number(/VmRSS:\s+(\d+)/.exec(status)?.[1] ?? 0) + (await Promise.all(children.map(id => sample(Number(id))))).reduce((a, b) => a + b, 0);
    } catch { return 0; }
  };
  const phases = process.env.CCRB_TEST_GATEWAY_ONLY === '1' ? ['native_real_gateway'] : ['native_real_binary', 'native_real_gateway'];
  let code = 0;
  for (const phase of phases) {
    const child = Bun.spawn(['cargo', 'test', '--locked', '--lib', phase, '--', '--ignored', '--nocapture'], { cwd: resolve(consumer), env: { ...process.env, CCRB_TEST_BINARY: resolve(binary), CCRB_TEST_CAPTURE_DIR: join(root, 'captures'), CCRB_TEST_CA_FILE: ca, CCRB_TEST_PROXY: proxyUrl, CCRB_TEST_CONTROL: control.url.toString(), CCRB_TEST_SENDER_HOST: senderHost, V3_RUNTIME_URL: control.url.toString(), V3_INTERNAL_TOKEN: 'synthetic-private-management-key'.repeat(2), V3_DEPLOYMENT_ID: 'native-offline', V3_RELEASE: 'native-offline' }, stdout: 'inherit', stderr: 'inherit' });
    const timer = setInterval(() => { void sample(child.pid).then(value => { peakRssKiB = Math.max(peakRssKiB, value); }); }, 100);
    code = await child.exited; clearInterval(timer);
    // 失败时同样保存实收请求摘要，后续断言与夹具清理才有可核对的现场。
    if (process.env.CCRB_TEST_REPORT) await writeFile(process.env.CCRB_TEST_REPORT, JSON.stringify({ code, binary: resolve(binary), messages, parallelPeak, processTreePeakRssKiB: peakRssKiB }, null, 2));
    assert.equal(code, 0);
  }
  assert.equal(code, 0);
  assert.equal(messages.length, phases.length === 2 ? (process.env.CCRB_TEST_UNLIMITED === '1' ? 14 : 17) : 4);
  if (phases.length === 2) assert.equal(messages.find(message => message.label === 'rotated')?.bearer, 'Bearer synthetic-bearer-b');
  console.log(JSON.stringify({ messages: messages.length, parallelPeak, processTreePeakRssKiB: peakRssKiB }));
} finally { upstream.stop(true); control.stop(true); proxy.closeAllConnections(); proxy.close(); socks.close(); await rm(root, { recursive: true, force: true }); }
