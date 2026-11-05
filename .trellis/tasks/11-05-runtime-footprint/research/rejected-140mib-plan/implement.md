# 实施计划

## 开工条件

- [x] 创建规划任务并记录实现前 Git 基线。
- [x] 读取原生运行时、日志和代码复用规范，核对现有类型与启动入口。
- [x] 完成原版/UPX 体积、版本、预加载、还原和资源预研，保留原始记录。
- [x] 核对固定模块图和缓存组成，读取结构来源并记录源码哈希。
- [ ] 三件套收敛、完整 Brief 展示及首次实施批准。
- [ ] 批准后运行 task.py start，并通过 trellis-route 进入实现；当前不改产品代码。

## 1. 精简候选与保留校验

- [ ] 在独立输出目录验证缓存精简原型；先重建模块图及 ELF 元数据，不更换原生 Bun、不改 JS、不删除文件和资源。
- [ ] 实现固定源、布局、指针边界和标志检查；异常在执行或发布候选前明确拒绝。
- [ ] 比较全部 2511 个文件名称/内容及原生节哈希，保留预链接、运行选项及其它非缓存元数据。
- [ ] 验证版本、预加载、内嵌接口、五次启动中位数和峰值 RSS；若合同或资源指标失败，回到设计并保留现状。

## 2. 可重复生成入口

- [ ] 新增 runtime:compact 命令及有界生成报告，源和目标独立，已存在输出拒绝覆盖，验证后原子发布。
- [ ] 同一固定输入至少生成两次，核对结果一致，记录最终产物摘要；不引入整体 UPX 或额外运行时依赖。
- [ ] 新增 runtime:measure 命令，生成不含账号数据的进程初始化及部署体积报告；报告明确探针性质与运行条件。

## 3. 原生引擎接入

- [ ] 为 profile 登记通过验证的精简身份，保留原版固定身份；不放宽为任意可自报的 manifest。
- [ ] 引擎启动保存实际摘要，每个作业核对本次选定文件未变化；日志和引擎来源准确表达实际执行文件。
- [ ] 验证错误源、布局异常、产物损坏和运行中替换明确失败，不能执行未知程序、覆盖原版或回退 demo。
- [ ] 更新 README、接口配置说明和生成/测量操作说明，写明精简版性质及原版回退方式。

## 4. 验证命令

新增命令属于待实现入口，当前不可声称已可运行。实现后先生成并测量候选，再进行以下检查：

```bash
bun run runtime:compact -- --source /absolute/path/to/official-293 --out runtime/293-compact
bun run runtime:measure -- --original /absolute/path/to/official-293 --compact runtime/293-compact/claude
bun run build
bun run typecheck
bun run test
bun run test:integration
CCRB_TEST_CLAUDE_BINARY=/absolute/path/to/official-293 bun run test:native
CCRB_TEST_CLAUDE_BINARY=/absolute/path/to/runtime/293-compact/claude bun run test:native
```

新增测试只覆盖保留合同、拒绝未知产物及真实原生链路，不编写重复实现细节的测试。原生场景使用既有无外网 TLS 夹具、合成凭据及独立数据目录，不能因失败改用真实账号。

## 5. 交付检查与回退点

- [ ] 记录完整部署集合不超过 146800640 字节、初始化中位增量不超过 500 毫秒、最大峰值 RSS 增量不超过 33554432 字节的证据。
- [ ] 原版和精简版的完整原生场景均通过；代码构建、类型及相关测试通过。
- [ ] 通过 trellis-route(target=check) 执行 Check-All，随后按工作流完成 Spec 评估和精确 Push 计划。
- [ ] 源文件、宿主安装、现有配置及其它仓库保持原状；回退仅显式选择原版路径并重启本地服务。
