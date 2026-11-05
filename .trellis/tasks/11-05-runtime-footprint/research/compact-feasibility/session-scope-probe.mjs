import { AsyncLocalStorage } from 'node:async_hooks';
const state = await import('/$bunfs/root/chunk-g79wjybr.js');
const original = state.F();
const storage = new AsyncLocalStorage();
state.yLs(() => storage.getStore());
const id = '11111111-1111-4111-8111-111111111111';
const project = { originalCwd: process.cwd(), projectRoot: process.cwd(), cwd: process.cwd() };
const first = state.nEr({ host: original.host, id, project });
const second = state.nEr({ host: original.host, id, project });
let delayed;
await storage.run({ session: first }, async () => {
  state.t_(id, 'resume');
  state.F().requestJournal.replacePromptIndex(11);
  delayed = new Promise(resolve => setTimeout(() => resolve({ id: state.F().id, index: state.F().requestJournal.promptIndex() }), 25));
});
const result = await storage.run({ session: second }, async () => {
  state.t_(id, 'resume');
  const initial = state.F().requestJournal.promptIndex();
  state.F().requestJournal.replacePromptIndex(22);
  const old = await delayed;
  return { second_initial_index: initial, second_final_index: state.F().requestJournal.promptIndex(), first_delayed: old };
});
result.roots_distinct = first.root !== second.root;
result.host_shared = first.host === second.host;
result.outside_restored = state.F() === original;
process.stdout.write(JSON.stringify(result) + '\n');
process.exit(0);
