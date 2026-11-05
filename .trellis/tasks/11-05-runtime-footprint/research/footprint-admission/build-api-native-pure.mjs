import { resolve, sep } from 'node:path';
import { stat, readFile } from 'node:fs/promises';
const root = '/tmp/ccrb-compact-feasibility-tsy0tloy';
const modules = resolve(root, 'modules');
const mappings = new Set();
const rewrites = [];
const purePositions = new Map(Object.entries(JSON.parse(await readFile(root + '/native-pure-locations.json', 'utf8'))));
const source = '/root/.nvm/versions/node/v22.23.4/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe';
const target = root + '/native-api-pure';
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
        const positions = purePositions.get(path.slice(modules.length + 1)) ?? [];
        // 预研只处理固定源码中的静态模块定位，动态表达式必须在闭包审计中另行核对。
        if (!bytes.includes(Buffer.from('import.meta.require')) && !bytes.includes(Buffer.from('He("/$bunfs/root/')) && !bytes.includes(Buffer.from('.zst')) && !positions.length) return;
        let annotated = bytes.toString('utf8');
        for (const position of [...positions].sort((a, b) => b - a)) annotated = annotated.slice(0, position) + '/*#__PURE__*/' + annotated.slice(position);
        const contents = annotated.replace(/import\.meta\.require\((['"])(\/\$bunfs\/root\/[^'"\r\n]+)\1\)/g, (match, quote, specifier) => {
          rewrites.push({ file: path.slice(modules.length + 1), specifier });
          return 'require(' + JSON.stringify(specifier) + ')';
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
  await Bun.write(root + '/native-pure-rewrites.json', JSON.stringify(rewrites, null, 2));
  for (const output of result.outputs) await Bun.write(root + '/native-pure-intermediate.js', output);
  if (result.metafile) await Bun.write(root + '/native-pure-metafile.json', JSON.stringify(result.metafile));
  const record = { success: result.success, bun: Bun.version, mapped_modules: mappings.size, rewritten_static_requires: rewrites.length,
    logs: result.logs.map(String), actual_file_bytes: (await stat(target)).size };
  await Bun.write(root + '/native-pure-build.json', JSON.stringify(record, null, 2));
  process.stdout.write(JSON.stringify(record) + '\n');
} catch (error) {
  const record = { success: false, error: String(error) };
  await Bun.write(root + '/native-pure-build.json', JSON.stringify(record, null, 2));
  process.stdout.write(JSON.stringify(record) + '\n');
}
process.exit(0);
