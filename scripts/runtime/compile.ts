import { readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, sep } from 'node:path';
import ts from 'typescript';
import { PROFILE_293 } from '../../src/runtime/293/source-profile';

const root = process.env.CCRB_BUILD_ROOT!;
const source = process.env.CCRB_BUILD_SOURCE!;
const project = process.env.CCRB_BUILD_PROJECT!;
const modules = resolve(root, 'modules');
const manifest: { name: string; sha256: string }[] = JSON.parse(await readFile(resolve(root, 'modules.json'), 'utf8'));
const sourceHashes = new Map(manifest.map(row => [row.name, row.sha256]));
const rewrites: { file: string; start: number; end: number; kind: string; specifier: string }[] = [];
const dynamic: { file: string; start: number; kind: string }[] = [];
const nativeImports: { file: string; start: number; specifier: string }[] = [];
const nativeModules = new Set(['child_process', 'bun:ffi', 'perf_hooks', 'fs', 'path', 'stream', 'constants', 'util', 'assert', 'events', 'http', 'https', 'net', 'tls', 'url', 'http2', 'crypto', 'undici', 'os', 'tty', 'process', 'buffer', 'fs/promises', 'querystring', 'zlib', 'dns']);
const mappings = new Set<string>();
const definitions = [
  ['core', PROFILE_293.modules.core, ['Re', 'Kc', 'K_t']],
  ['api', PROFILE_293.modules.api, ['yN', 'Ree']],
  ['context', PROFILE_293.modules.context, ['Nst']],
  ['state', PROFILE_293.modules.state, ['F', 'nEr', 'yLs', 't_']],
  ['permissions', PROFILE_293.modules.permissions, ['su']],
] as const;
const entry = definitions.map(([, file, symbols]) => 'import {' + symbols.join(',') + '} from ' + JSON.stringify(file) + ';').join('\n') +
  '\nimport {startWorker} from ' + JSON.stringify(resolve(project, 'src/runtime/293/worker.ts')) + ';\n' +
  'try { await startWorker({' + definitions.map(([role, , symbols]) => role + ':{' + symbols.join(',') + '}').join(',') + '}); process.exit(0); } catch { process.stderr.write("固定运行时初始化失败\\n"); process.exit(111); }\n';
await writeFile(resolve(root, 'entry.mjs'), entry);

try {
  const result = await Bun.build({
    entrypoints: [resolve(root, 'entry.mjs')], target: 'bun', format: 'esm', env: 'disable', metafile: true,
    loader: { '.txt': 'text', '.md': 'text' },
    minify: { whitespace: true, syntax: true, identifiers: true, keepNames: true },
    plugins: [{ name: 'fixed-293-closure', setup(builder) {
      builder.onResolve({ filter: /^\/\$bunfs\/root\// }, ({ path }) => {
        if (!sourceHashes.has(path)) throw new Error('原生依赖不在固定提取清单中');
        const mapped = resolve(modules, path.slice('/$bunfs/root/'.length));
        if (!mapped.startsWith(modules + sep)) throw new Error('原生模块路径越界');
        mappings.add(path);
        return { path: mapped };
      });
      builder.onLoad({ filter: /modules\/.*\.js$/ }, async ({ path }) => {
        const bytes = await readFile(path);
        const file = '/$bunfs/root/' + path.slice(modules.length + 1);
        if (createHash('sha256').update(bytes).digest('hex') !== sourceHashes.get(file)) throw new Error('提取模块在构建期间改变');
        const text = bytes.toString('utf8');
        if (!text.includes('import.meta.require') && !text.includes('He(') && !text.includes('.zst')) return { contents: text, loader: 'js' };
        // 只改真实语法节点，避免把内嵌示例、模板文本或普通字符串误当作依赖表达式。
        const tree = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
        const aliases = new Set<string>();
        for (const node of tree.statements) {
          if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier) || node.moduleSpecifier.text !== '/$bunfs/root/chunk-0y12vz6b.js') continue;
          const bindings = node.importClause?.namedBindings;
          if (bindings && ts.isNamedImports(bindings)) for (const element of bindings.elements) if ((element.propertyName ?? element.name).text === 'He') aliases.add(element.name.text);
        }
        const changes: { start: number; end: number; text: string }[] = [];
        const imports: string[] = [];
        const visit = (node: ts.Node): void => {
          if (ts.isCallExpression(node)) {
            const callee = node.expression;
            const direct = ts.isPropertyAccessExpression(callee) && callee.name.text === 'require' && ts.isMetaProperty(callee.expression) && callee.expression.keywordToken === ts.SyntaxKind.ImportKeyword;
            const alias = ts.isIdentifier(callee) && aliases.has(callee.text);
            if (direct || alias) {
              const first = node.arguments[0];
              if (node.arguments.length === 1 && first && ts.isStringLiteral(first) && first.text.startsWith('/$bunfs/root/')) {
                if (first.text.endsWith('.zst')) throw new Error('压缩资源不能作为普通 require 处理');
                const start = node.getStart(tree), end = node.getEnd();
                changes.push({ start, end, text: 'require(' + JSON.stringify(first.text) + ')' });
                rewrites.push({ file, start, end, kind: alias ? 'helper-require' : 'static-require', specifier: first.text });
                return;
              }
              if (first && ts.isStringLiteral(first)) {
                if (!nativeModules.has(first.text)) throw new Error('固定闭包出现未登记的外部依赖');
                nativeImports.push({ file, start: node.getStart(tree), specifier: first.text });
              } else dynamic.push({ file, start: node.getStart(tree), kind: direct ? 'dynamic-require' : 'helper-dynamic-require' });
            }
          }
          if (ts.isStringLiteral(node) && node.text.startsWith('/$bunfs/root/') && node.text.endsWith('.zst')) {
            const binding = '__ccrb_resource_' + imports.length;
            if (text.includes(binding)) throw new Error('资源绑定名称冲突');
            const start = node.getStart(tree), end = node.getEnd();
            imports.push('import ' + binding + ' from ' + JSON.stringify(node.text) + ' with {type:"file"};');
            changes.push({ start, end, text: binding });
            rewrites.push({ file, start, end, kind: 'embedded-file', specifier: node.text });
            return;
          }
          ts.forEachChild(node, visit);
        };
        visit(tree);
        changes.sort((a, b) => b.start - a.start);
        let contents = text;
        let boundary = text.length;
        for (const change of changes) {
          if (change.end > boundary) throw new Error('依赖转换位置重叠');
          contents = contents.slice(0, change.start) + change.text + contents.slice(change.end);
          boundary = change.start;
        }
        return { contents: imports.join('\n') + '\n' + contents, loader: 'js' };
      });
    } }],
    compile: { executablePath: source, outfile: resolve(root, 'ccrb-worker'), autoloadDotenv: false, autoloadBunfig: false, autoloadTsconfig: false, autoloadPackageJson: false },
  });
  if (!result.success) throw new Error('固定源码构建失败，诊断数量=' + result.logs.length);
  await writeFile(resolve(root, 'closure.json'), JSON.stringify({ bun_version: Bun.version, bun_revision: Bun.revision, mapped_modules: [...mappings].sort(), rewrites, native_imports: nativeImports, remaining_dynamic_calls: dynamic, actual_file_bytes: (await stat(resolve(root, 'ccrb-worker'))).size }, null, 2));
  process.exit(0);
} catch {
  process.stderr.write('固定 293 依赖转换或原生构建失败\n');
  process.exit(111);
}
