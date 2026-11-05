import { resolve, sep } from 'node:path';
import { stat, readFile, readdir } from 'node:fs/promises';
const root = '/tmp/ccrb-compact-feasibility-tsy0tloy';
const modules = resolve(root, 'modules');
const mappings = new Set();
const rewrites = [];

const graph = new Map();
const sourceTexts = new Map();
const namespaceEdges = new Set();
for (const name of (await readdir(modules)).sort()) {
  if (!name.endsWith('.js')) continue;
  const bytes = await readFile(resolve(modules, name));
  if (!bytes.subarray(0, 8).equals(Buffer.from('// @bun '))) continue;
  const contents = bytes.toString('utf8');
  sourceTexts.set(name, contents);
  const deps = new Set();
  const staticPattern = /\b(?:import\s*(?:[^;()"'`]*?\bfrom\s*)?|export\s*[^;()"'`]*?\bfrom\s*)(["'])(\/\$bunfs\/root\/[^"']+)\1/g;
  for (const match of contents.matchAll(staticPattern)) deps.add(match[2].slice('/$bunfs/root/'.length));
  graph.set(name, deps);
}
for (const [name, contents] of sourceTexts) {
  for (const match of contents.matchAll(/import\.meta\.require\((['"])(\/\$bunfs\/root\/[^'"\r\n]+)\1\)/g)) {
    const targetName = match[2].slice('/$bunfs/root/'.length);
    if (!sourceTexts.has(targetName)) continue;
    const pending = [targetName], seen = new Set();
    let cycles = false;
    while (pending.length) {
      const current = pending.pop();
      if (current === name) { cycles = true; break; }
      if (seen.has(current)) continue;
      seen.add(current);
      pending.push(...(graph.get(current) ?? []));
    }
    if (!cycles) {
      graph.get(name).add(targetName);
      namespaceEdges.add(name + '\0' + match[2]);
    }
  }
}

const source = '/root/.nvm/versions/node/v22.23.4/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe';
const target = root + '/native-api-acyclic';
try {
  const result = await Bun.build({ entrypoints: [root + '/api-entry.mjs'], target: 'bun', format: 'esm',
    env: 'disable', metafile: true, loader: { '.txt': 'text', '.md': 'text' },
    minify: { whitespace: true, syntax: true, identifiers: true, keepNames: true },
    plugins: [{ name: 'fixed-source-paths',
      /** 注册固定样本的研究用转换。
       * @param builder Bun 构建插件入口。
       * @return 完成钩子注册。
       */
      setup(builder) {
      builder.onLoad({ filter: /modules\/.*\.js$/ }, async ({ path }) => {
        const bytes = await readFile(path);
        // 预研只处理固定源码中的静态模块定位，动态表达式必须在闭包审计中另行核对。
        if (!bytes.includes(Buffer.from('import.meta.require')) && !bytes.includes(Buffer.from('He("/$bunfs/root/')) && !bytes.includes(Buffer.from('.zst'))) return;
        const namespaceImports = new Map();
        const contents = bytes.toString('utf8').replace(/import\.meta\.require\((['"])(\/\$bunfs\/root\/[^'"\r\n]+)\1\)/g, (match, quote, specifier) => {
          rewrites.push({ file: path.slice(modules.length + 1), specifier });
          if (!namespaceEdges.has(path.slice(modules.length + 1) + '\0' + specifier)) return 'require(' + JSON.stringify(specifier) + ')';
          const binding = '__ccrb_namespace_' + namespaceImports.size;
          if (!namespaceImports.has(specifier)) namespaceImports.set(specifier, binding);
          return namespaceImports.get(specifier);
        });
        let prepared = contents;
        if (bytes.includes(Buffer.from('He("/$bunfs/root/'))) {
          if (!contents.includes('He}from"/$bunfs/root/chunk-0y12vz6b.js"') && !contents.includes('He,') && !contents.includes(',He}from"/$bunfs/root/chunk-0y12vz6b.js"')) throw new Error('资源加载别名需要核对: ' + path);
          prepared = contents.replace(/\bHe\((['"])(\/\$bunfs\/root\/[^'"\r\n]+)\1\)/g, (match, quote, specifier) => {
            rewrites.push({ file: path.slice(modules.length + 1), specifier, resource_alias: 'He' });
            return 'require(' + JSON.stringify(specifier) + ')';
          });
        }
        const imports = [];
        // 让编译器显式携带原先经文件路径读取的压缩资源，避免依赖提取目录。
        prepared = prepared.replace(/(['"])(\/\$bunfs\/root\/[^'"\r\n]+\.zst)\1/g, (match, quote, specifier) => {
          const binding = '__ccrb_resource_' + imports.length;
          if (contents.includes(binding)) throw new Error('资源临时绑定冲突');
          imports.push('import ' + binding + ' from ' + JSON.stringify(specifier) + ' with {type:"file"};');
          rewrites.push({ file: path.slice(modules.length + 1), specifier, embedded_file: true });
          return binding;
        });
        for (const [specifier, binding] of namespaceImports) imports.push('import * as ' + binding + ' from ' + JSON.stringify(specifier) + ';');
        return { contents: imports.join('\n') + '\n' + prepared, loader: 'js' };
      });
      builder.onResolve({ filter: /^\/\$bunfs\/root\// }, ({ path }) => {
        const mapped = resolve(modules, path.slice('/$bunfs/root/'.length));
        if (!mapped.startsWith(modules + sep)) throw new Error('虚拟模块路径越界');
        mappings.add(path);
        return { path: mapped };
      });
    }}],
    compile: { executablePath: source, outfile: target, autoloadDotenv: false,
      autoloadBunfig: false, autoloadTsconfig: false, autoloadPackageJson: false }
  });
  await Bun.write(root + '/native-acyclic-rewrites.json', JSON.stringify(rewrites, null, 2));
  for (const output of result.outputs) await Bun.write(root + '/native-acyclic-intermediate.js', output);
  if (result.metafile) await Bun.write(root + '/native-acyclic-metafile.json', JSON.stringify(result.metafile));
  const record = { success: result.success, bun: Bun.version, mapped_modules: mappings.size, acyclic_candidates: namespaceEdges.size, rewritten_static_requires: rewrites.length,
    logs: result.logs.map(String), actual_file_bytes: (await stat(target)).size };
  await Bun.write(root + '/native-acyclic-build.json', JSON.stringify(record, null, 2));
  process.stdout.write(JSON.stringify(record) + '\n');
} catch (error) {
  const record = { success: false, error: String(error) };
  await Bun.write(root + '/native-acyclic-build.json', JSON.stringify(record, null, 2));
  process.stdout.write(JSON.stringify(record) + '\n');
}
process.exit(0);
