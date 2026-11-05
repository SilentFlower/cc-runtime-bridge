export {};

if (process.platform !== 'linux') throw new Error('原生离线验证需要 Linux 网络命名空间');
const child = Bun.spawn(['unshare', '--net', process.execPath, 'test', 'tests/native', '--timeout', '45000', ...process.argv.slice(2)], {
  env: { ...process.env, CCRB_NATIVE_ISOLATED: '1' }, stdin: 'inherit', stdout: 'inherit', stderr: 'inherit',
});
process.exitCode = await child.exited;
