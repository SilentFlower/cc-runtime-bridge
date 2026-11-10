process.stdout.write(JSON.stringify({ version: Bun.version, revision: Bun.revision,
  fetchExports: Object.keys(Bun).filter(name => /fetch|network|session/i.test(name)) }) + '\n');
process.exit(0);
