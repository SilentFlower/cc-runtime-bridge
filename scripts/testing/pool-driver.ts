import { createServer } from 'node:http';
import { connect } from 'node:net';
import type { Duplex } from 'node:stream';
import { mkdir, readFile, readlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { readConfig, startServer } from '../../src/control/server';
import { createEngine, type Engine } from '../../src/control/engine';
import type { HeaderPair, JsonObject } from '../../src/shared/contracts';
import { Redactor } from '../../src/control/redaction';
import { RequestTrace } from '../../src/control/trace';
import { isObject } from '../../src/shared/errors';
import { SYNTHETIC_KEY, BodyCapture, sample, type DriverFrame, type DriverResult, type PoolScene } from './pool-common';

const send = async (frame: DriverFrame): Promise<void> => { if (!process.stdout.write(JSON.stringify(frame) + '\n')) await once(process.stdout, 'drain'); };

/** 在只有回环接口的命名空间运行真实 HTTP 入站。 @return 场景及进程均已收口。 */
async function main(): Promise<void> {
  const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const commands = input[Symbol.asyncIterator](); const first = await commands.next();
  const value: unknown = JSON.parse(first.value ?? 'null');
  if (!isObject(value) || !['root','socketPath','certFile','binary'].every(k => typeof value[k] === 'string')) throw new Error('驱动配置格式错误');
  const setup = value as unknown as { root: string; socketPath: string; certFile: string; binary: string };
  if (Bun.spawnSync(['ip','link','set','lo','up']).exitCode !== 0) throw new Error('无法启用隔离回环');
  const interfaces = (await readFile('/proc/net/dev', 'utf8')).split('\n').slice(2).filter(line => line.includes(':')).map(line => line.split(':')[0]!.trim());
  if (interfaces.length !== 1 || interfaces[0] !== 'lo') throw new Error('驱动存在非回环接口');
  if (Object.keys(process.env).some(name => /POOL|REQUESTER/.test(name))) throw new Error('驱动继承了池配置');
  const sockets = new Set<Duplex>();
  let proxyRequests = 0, rejectedRequests = 0, runFinished: Promise<void> = Promise.resolve();
  const proxy = createServer((request, response) => { rejectedRequests++; request.resume(); response.writeHead(403); response.end(); });
  proxy.on('connect', (request, socket, head) => {
    proxyRequests++;
    if (request.url !== 'api.anthropic.com:443') { rejectedRequests++; socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
    const target = connect({ path: setup.socketPath }, () => { socket.write('HTTP/1.1 200 Connection Established\r\n\r\n'); if (head.length) target.write(head); socket.pipe(target); target.pipe(socket); });
    sockets.add(socket); sockets.add(target);
    socket.on('close', () => { sockets.delete(socket); target.destroy(); }); target.on('close', () => { sockets.delete(target); socket.destroy(); });
    socket.on('error', () => target.destroy()); target.on('error', () => socket.destroy());
  });
  await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve));
  const address = proxy.address(); if (!address || typeof address === 'string') throw new Error('代理端口无效');
  const deniedHttp = await fetch('http://127.0.0.1:' + address.port + '/', { headers: { connection: 'close' } });
  await deniedHttp.arrayBuffer();
  const deniedConnect = await new Promise<boolean>((resolve, reject) => {
    const timer = setTimeout(() => { socket.destroy(); reject(new Error('目标拒绝探针超时')); }, 3000);
    const socket = connect(address.port, '127.0.0.1', () => socket.write('CONNECT forbidden.example:443 HTTP/1.1\r\nHost: forbidden.example:443\r\n\r\n'));
    socket.once('data', bytes => { clearTimeout(timer); socket.destroy(); resolve(bytes.toString().startsWith('HTTP/1.1 403')); });
    socket.once('error', () => { clearTimeout(timer); reject(new Error('目标拒绝探针失败')); });
  });
  if (deniedHttp.status !== 403 || !deniedConnect || rejectedRequests !== 2) throw new Error('本地代理没有拒绝非法目标');
  proxyRequests = 0; rejectedRequests = 0;
  await send({ type: 'driver_ready', namespace: await readlink('/proc/self/ns/net'), interfaces, envNames: Object.keys(process.env).sort(), rejectedTargetProbe: true });
  let redactor = new Redactor();
  let engine: Engine | undefined, app: Awaited<ReturnType<typeof startServer>> | undefined, lastPolicy = '';
  let context: JsonObject | null = null, prepared: DriverResult['prepared'] = null, state = 'error', workerEnvNames: string[] = [], syntheticCredential = false;
  try {
    while (true) {
      const next = await commands.next(); if (next.done) break;
      const command: unknown = JSON.parse(next.value);
      if (isObject(command) && command.type === 'shutdown') break;
      if (!isObject(command) || command.type !== 'run' || !isObject(command.scene)) throw new Error('场景指令错误');
      const scene = command.scene as unknown as PoolScene;
      if (typeof scene.id !== 'string' || !isObject(scene.input) || typeof scene.cancel !== 'boolean' || !['preserve','sub2api'].includes(scene.cachePolicy)) throw new Error('场景合同错误');
      redactor = new Redactor(); redactor.register({ api_key: SYNTHETIC_KEY });
      if (scene.cachePolicy !== lastPolicy) {
        await app?.close();
        const root = join(setup.root, scene.cachePolicy);
        await mkdir(join(root, 'home'), { recursive: true, mode: 0o700 }); await mkdir(join(root, 'config'), { recursive: true, mode: 0o700 });
        await writeFile(join(root, 'config/.claude.json'), JSON.stringify({ userID: 'd'.repeat(64) }), { mode: 0o600 });
        const config = readConfig({ CCRB_PORT: '0', CCRB_LOG_MODE: 'off', CCRB_DATA_DIR: join(root, 'data'), CCRB_CLAUDE_BINARY: setup.binary, CCRB_CLAUDE_HOME: join(root, 'home'), CCRB_CLAUDE_CONFIG_DIR: join(root, 'config'), CCRB_WORKDIR: root, CCRB_NATIVE_API_KEY: SYNTHETIC_KEY, CCRB_CA_FILE: setup.certFile, CCRB_PROXY_URL: 'http://127.0.0.1:' + address.port, CCRB_TIMEOUT_MS: '45000', CCRB_CACHE_POLICY: scene.cachePolicy, CCRB_TELEMETRY: 'off' });
        engine = await createEngine(config.engine);
        const actual = engine;
        const observed: Engine = {
          name: actual.name,
          get binarySha256() { return actual.binarySha256; }, get workerPid() { return actual.workerPid; }, get telemetryState() { return actual.telemetryState; },
          /** 观察同一轮的中间值与语义终态，仍由原引擎唯一发送。 @param request 已校验输入。 @param signal 调用方取消。 @param emit 原服务消费者。 @return 本轮引擎与观察均已收口。 */
          async run(request, signal, emit) {
            context = { ...request.context };
            // off 不持久化；复用产品的终态计算，避免把传输 EOF 当成 SSE 完整成功。
            const trace = new RequestTrace(request, request.input, [], app!.store, { mode: 'off', engine: actual.name, maxBodyBytes: 0 });
            trace.start();
            const running = actual.run(request, signal, async event => {
              trace.event(event);
              if (event.type === 'cc_prepared') {
                prepared = { body: sample(event.body, redactor), headers: redactor.headers(event.headers) };
                const env = (await readFile('/proc/' + actual.workerPid + '/environ')).toString().split('\0').filter(Boolean);
                workerEnvNames = env.map(entry => entry.split('=', 1)[0]!).sort();
                syntheticCredential = env.includes('ANTHROPIC_API_KEY=' + SYNTHETIC_KEY) && !workerEnvNames.some(name => /POOL|REQUESTER/.test(name));
              }
              if (event.type === 'completed') state = trace.finish(event.state);
              if (event.type === 'error') state = trace.finish('error');
              await emit(event);
            });
            runFinished = running.catch(() => {});
            try { await running; } catch (error) { state = trace.finish(signal.aborted ? 'canceled' : 'error'); throw error; }
          },
          /** 关闭被观察的原引擎。 @return 工作进程已释放。 */
          async close() { await actual.close(); },
        };
        app = await startServer(config, observed); lastPolicy = scene.cachePolicy;
      }
      prepared = null; context = null; state = 'error'; workerEnvNames = []; syntheticCredential = false;
      const ingress = JSON.stringify(scene.input), started = performance.now(), abort = new AbortController(), capture = new BodyCapture();
      let statusCode = 0, headers: HeaderPair[] = [], complete = false;
      try {
        const response = await fetch('http://127.0.0.1:' + app!.server.port + '/api/requests', { method: 'POST', signal: abort.signal, headers: { 'content-type': 'application/json' }, body: ingress });
        statusCode = response.status; headers = [...response.headers.entries()] as HeaderPair[];
        const reader = response.body?.getReader();
        if (reader) {
          void reader.closed.catch(() => {});
          while (true) {
            const part = await reader.read(); if (part.done) { complete = true; break; }
            capture.push(part.value);
            if (scene.cancel) { abort.abort(); await reader.cancel().catch(() => {}); state = 'canceled'; break; }
          }
        } else complete = true;
      } catch { if (abort.signal.aborted) state = 'canceled'; }
      // HTTP EOF 可能先于 worker_idle；等待同一轮 run 收口，不能用固定睡眠猜测终态。
      await runFinished;
      await send({ type: 'result', id: scene.id, ingress, context, prepared, response: capture.finish(redactor, complete), headers: redactor.headers(headers), statusCode, state, elapsedMs: performance.now() - started, workerPid: engine!.workerPid, workerEnvNames, syntheticCredential, proxyRequests, rejectedRequests, telemetry: engine!.telemetryState ?? 'unavailable' });
    }
  } finally {
    input.close(); await app?.close();
    for (const socket of sockets) socket.destroy(); await new Promise<void>(resolve => proxy.close(() => resolve()));
  }
}

if (import.meta.main) void main().then(() => process.exit(0)).catch(async () => { await send({ type: 'fatal', message: '隔离测试驱动失败，未自动重放' }).catch(() => {}); process.exit(1); });
