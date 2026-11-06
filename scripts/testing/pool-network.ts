import { createServer } from 'node:http';
import { connect } from 'node:net';
import type { Duplex } from 'node:stream';
import { readFile, readlink } from 'node:fs/promises';

/** 仅允许固定 CONNECT 进入宿主 Unix socket 的隔离代理。 */
export interface IsolatedProxy {
  url: string;
  namespace: string;
  interfaces: string[];
  readonly proxyRequests: number;
  readonly rejectedRequests: number;
  /** 关闭本次创建的连接和监听器。 @return 资源已释放。 */
  close(): Promise<void>;
}

/** 验证仅回环网络并实测非法目标拒绝，启动阶段不访问模型。
 * @param socketPath 宿主 TLS 接收端的私有 socket。
 * @return 已完成目标拒绝自检的代理。
 */
export async function startIsolatedProxy(socketPath: string): Promise<IsolatedProxy> {
  if (Bun.spawnSync(['ip','link','set','lo','up']).exitCode !== 0) throw new Error('无法启用隔离回环');
  const interfaces = (await readFile('/proc/net/dev', 'utf8')).split('\n').slice(2).filter(line => line.includes(':')).map(line => line.split(':')[0]!.trim());
  if (interfaces.length !== 1 || interfaces[0] !== 'lo') throw new Error('驱动存在非回环接口');
  if (Object.keys(process.env).some(name => /POOL|REQUESTER|PROXY|ANTHROPIC|CLAUDE/.test(name))) throw new Error('驱动继承了非白名单配置');
  const sockets = new Set<Duplex>();
  let proxyRequests = 0, rejectedRequests = 0;
  const proxy = createServer((request, response) => { rejectedRequests++; request.resume(); response.writeHead(403); response.end(); });
  proxy.on('connect', (request, socket, head) => {
    proxyRequests++;
    if (request.url !== 'api.anthropic.com:443') { rejectedRequests++; socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
    const target = connect({ path: socketPath }, () => { socket.write('HTTP/1.1 200 Connection Established\r\n\r\n'); if (head.length) target.write(head); socket.pipe(target); target.pipe(socket); });
    sockets.add(socket); sockets.add(target);
    socket.on('close', () => { sockets.delete(socket); target.destroy(); }); target.on('close', () => { sockets.delete(target); socket.destroy(); });
    socket.on('error', () => target.destroy()); target.on('error', () => socket.destroy());
  });
  await new Promise<void>((resolve, reject) => { proxy.once('error', reject); proxy.listen(0, '127.0.0.1', resolve); });
  const close = async (): Promise<void> => { for (const socket of sockets) socket.destroy(); await new Promise<void>(resolve => proxy.close(() => resolve())); };
  try {
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
    return { url: 'http://127.0.0.1:' + address.port, namespace: await readlink('/proc/self/ns/net'), interfaces,
      get proxyRequests() { return proxyRequests; }, get rejectedRequests() { return rejectedRequests; }, close };
  } catch (error) { await close(); throw error; }
}
