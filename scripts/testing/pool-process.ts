import { readFile } from 'node:fs/promises';

/** 私有子进程 JSONL 通道；原文和 stderr 均不能作为普通日志输出。 */
export class PrivateProcess<T> {
  readonly child: Bun.Subprocess<'pipe', 'pipe', 'pipe'>;
  private iterator: AsyncGenerator<T>;
  private diagnostics: Promise<void>;
  /** 以严格环境启动并绑定唯一解码器。 @param command 程序与非秘密参数。 @param env 白名单环境。 @param decode 私有帧校验。 */
  constructor(command: string[], env: Record<string, string>, decode: (line: string) => T) {
    this.child = Bun.spawn(command, { env, stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' });
    const errors = this.child.stderr;
    this.diagnostics = (async () => { const reader = errors.getReader(); try { while (!(await reader.read()).done) {} } finally { reader.releaseLock(); } })().catch(() => {});
    const stream = this.child.stdout;
    this.iterator = (async function* () {
      const reader = stream.getReader(), decoder = new TextDecoder('utf-8', { fatal: true }); let buffer = '';
      try {
        while (true) {
          const next = await reader.read(); if (next.done) break;
          buffer += decoder.decode(next.value, { stream: true });
          if (Buffer.byteLength(buffer) > 8 * 1024 * 1024) throw new Error('私有通道接收超限');
          let end: number;
          while ((end = buffer.indexOf('\n')) >= 0) { const line = buffer.slice(0, end); buffer = buffer.slice(end + 1); yield decode(line); }
        }
        decoder.decode();
        throw new Error(buffer ? '子进程存在截断帧' : '子进程私有通道已关闭');
      } finally { reader.releaseLock(); }
    })();
  }
  /** 发送结构化控制帧，不经 shell。 @param frame 合同内的指令。 @return 写入完成。 */
  async send(frame: unknown): Promise<void> { this.child.stdin.write(JSON.stringify(frame) + '\n'); await this.child.stdin.flush(); }
  /** 在单一消费者内取得下一帧。 @param timeoutMs 等待预算，0 表示允许常驻通道空闲。 @return 下一条已验证帧。 */
  async next(timeoutMs = 50000): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { const result = await (timeoutMs === 0 ? this.iterator.next() : Promise.race([this.iterator.next(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('私有通道等待超时')), timeoutMs); })])); if (result.done) throw new Error('子进程提前结束'); return result.value; }
    finally { clearTimeout(timer); }
  }
  /** 有界关闭，超时只清理本通道创建的进程树。 @return 子进程和诊断读取均已结束。 */
  async close(): Promise<void> {
    await this.send({ type: 'shutdown' }).catch(() => {});
    const done = await Promise.race([this.child.exited.then(() => true), Bun.sleep(3000).then(() => false)]);
    if (!done) {
      const kill = async (pid: number): Promise<void> => {
        try { for (const id of (await readFile('/proc/' + pid + '/task/' + pid + '/children', 'utf8')).trim().split(/\s+/).filter(Boolean)) await kill(Number(id)); } catch {}
        try { process.kill(pid, 'SIGKILL'); } catch {}
      };
      await kill(this.child.pid); await this.child.exited;
    }
    await this.iterator.return(undefined).catch(() => {});
    await this.diagnostics;
  }
}
