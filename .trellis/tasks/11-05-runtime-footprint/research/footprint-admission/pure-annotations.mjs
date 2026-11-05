import ts from '/root/project/cc-runtime-bridge/node_modules/typescript/lib/typescript.js';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = '/tmp/ccrb-compact-feasibility-tsy0tloy';
const directory = root + '/modules';
const helper = '/$bunfs/root/chunk-0y12vz6b.js';
const locations = {};
const records = [];
for (const name of (await readdir(directory)).sort()) {
  if (!name.endsWith('.js')) continue;
  const bytes = await readFile(directory + '/' + name);
  if (!bytes.includes(Buffer.from(helper))) continue;
  const source = bytes.toString('utf8');
  const file = ts.createSourceFile(name, source, ts.ScriptTarget.ESNext, false, ts.ScriptKind.JS);
  const factories = new Map();
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== helper) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      const original = (element.propertyName ?? element.name).text;
      if (original === 'k' || original === 'Ui') factories.set(element.name.text, original);
    }
  }
  const positions = [];
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      const call = declaration.initializer;
      if (!call || !ts.isCallExpression(call) || !ts.isIdentifier(call.expression) || !factories.has(call.expression.text)) continue;
      // 已核对的两个工厂只创建惰性闭包；限定函数字面量参数，避免省略参数求值副作用。
      if (call.arguments.length !== 1 || !(ts.isArrowFunction(call.arguments[0]) || ts.isFunctionExpression(call.arguments[0]))) continue;
      positions.push(call.expression.getStart(file));
    }
  }
  if (positions.length) {
    locations[name] = positions;
    records.push({ name, count: positions.length, source_sha256: createHash('sha256').update(bytes).digest('hex') });
  }
}
await writeFile(root + '/native-pure-locations.json', JSON.stringify(locations));
await writeFile(root + '/native-pure-annotation-summary.json', JSON.stringify({ typescript: ts.version, modules: records.length, annotations: records.reduce((n, row) => n + row.count, 0), records }, null, 2));
process.stdout.write(JSON.stringify({ typescript: ts.version, modules: records.length, annotations: records.reduce((n, row) => n + row.count, 0) }) + '\n');
