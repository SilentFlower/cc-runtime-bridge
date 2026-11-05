import type { NativeBindings } from './native';
import { PROFILE_293 } from './source-profile';
import { startWorker } from './worker';

try {
  const [core, api, context, state, permissions] = await Promise.all([
    import(PROFILE_293.modules.core),
    import(PROFILE_293.modules.api),
    import(PROFILE_293.modules.context),
    import(PROFILE_293.modules.state),
    import(PROFILE_293.modules.permissions),
  ]);
  await startWorker({ core, api, context, state, permissions } as NativeBindings);
  // 预加载结束必须退出，避免原 CLI 继续解析 --version 并污染协议通道。
  process.exit(0);
} catch {
  process.stderr.write('固定运行时初始化失败\n');
  process.exit(111);
}
