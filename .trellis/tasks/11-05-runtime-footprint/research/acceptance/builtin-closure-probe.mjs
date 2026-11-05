const names = ['child_process','bun:ffi','perf_hooks','fs','path','stream','constants','util','assert','events','http','https','net','tls','url','http2','crypto','undici','os','tty','process','buffer','fs/promises','querystring','zlib','dns'];
const rows = names.map(name => {
  try { const value = import.meta.require(name); return { name, available: value !== undefined, type: typeof value }; }
  catch { return { name, available: false }; }
});
process.stdout.write(JSON.stringify(rows) + '\n');
process.exit(rows.every(row => row.available) ? 0 : 1);
