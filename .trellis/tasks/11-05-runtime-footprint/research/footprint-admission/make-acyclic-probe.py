"""生成只转换无环边的研究构建，不修改固定源码或产品入口。"""
from pathlib import Path
root=Path('/tmp/ccrb-compact-feasibility-tsy0tloy')
s=(root/'build-api-native-files.mjs').read_text()
s=s.replace("import { stat, readFile }", "import { stat, readFile, readdir }")
s=s.replace("'/native-api-files'", "'/native-api-acyclic'").replace('native-files-','native-acyclic-')
addition=r'''
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
'''
s=s.replace("const source =",addition+"\nconst source =")
s=s.replace("const contents = bytes.toString('utf8').replace", "const namespaceImports = new Map();\n        const contents = bytes.toString('utf8').replace")
old="return 'require(' + JSON.stringify(specifier) + ')';"
new="""if (!namespaceEdges.has(path.slice(modules.length + 1) + '\\0' + specifier)) return 'require(' + JSON.stringify(specifier) + ')';
          const binding = '__ccrb_namespace_' + namespaceImports.size;
          if (!namespaceImports.has(specifier)) namespaceImports.set(specifier, binding);
          return namespaceImports.get(specifier);"""
s=s.replace(old,new,1)
s=s.replace("return { contents: imports.join('\\n') + '\\n' + prepared, loader: 'js' };", "for (const [specifier, binding] of namespaceImports) imports.push('import * as ' + binding + ' from ' + JSON.stringify(specifier) + ';');\n        return { contents: imports.join('\\n') + '\\n' + prepared, loader: 'js' };")
s=s.replace("mapped_modules: mappings.size,", "mapped_modules: mappings.size, acyclic_candidates: namespaceEdges.size,")
(root/'build-api-native-acyclic.mjs').write_text(s)
