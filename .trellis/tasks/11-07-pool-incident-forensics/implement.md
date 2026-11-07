# 断连现场自动取证：实施计划

## 开工前

- [x] 按 trellis-task-brief 展示完整 Brief，取得本任务首次实施确认后再执行 task.py start。
- [x] 通过 trellis-route(target=implement) 进入实施，沿用 inline 执行；通过 trellis-before-dev 加载当前任务、backend 规范及共享指南。
- [x] 复核实际源定义：CaptureRecord、RequestRow、RequestState、LogSnapshot、日志表、LogStore 只读连接、账本文件、PoolTransportDiagnostics 及启动／关闭入口；新增公共类型和方法先定义语义、参数、返回与失败行为。
- [x] 对照 task.json 的基线保留原有 20 个脏路径；本任务只修改自身材料及下述有证据支持的实现文件，不整理或提交其它历史任务。

## 顺序与文件范围

1. **安全投影和单次采集**
   - [x] 新建 `scripts/testing/local-pool-incidents.ts`：最小报告合同、严格字段／白名单头解码、只读 SQLite 适配、账本只读关联、正文文件元数据检查、排他报告发布。
   - [x] 明确运行冲突、未知字段、重复预留、异常／超限数据和报告冲突的固定失败码；不读取池配置，不复用可写账本实例。
   - [x] 新增共享合成存储夹具 `tests/fixtures/pool-incidents.ts` 及 `tests/unit/pool-incidents.test.ts`，覆盖信息投影与秘密排除、旧字段、阶段边界、状态来源、同头冲突及安全路径。

2. **自动扫描和生命周期**
   - [x] 同模块增加有界循环分页、终态短暂收口、重复报告跳过和状态文件；旧排队请求晚完成必须在后续循环发现。
   - [x] 接入 `scripts/local-pool.ts`：ready 后后台启动，获取日志模式与 captureError 存在性，正常及异常关闭均收口采集器，固定诊断不改变业务启动／响应／清理结果。
   - [x] 原预算、串行槽位、零启动模型调用、无自动重放及 HTTP 输出合同保持。

3. **补采入口和说明**
   - [x] 新建 `scripts/collect-pool-incidents.ts`，仅接受设计中的本地运行、请求及新输出目录参数；复用相同采集逻辑，不导入或启动引擎。
   - [x] `package.json` 增加 `collect:pool-incidents` 脚本；`README.md` 说明自动报告／状态位置、未知语义、证据边界及一次性补采。

4. **离线行为验证**
   - [x] 新增 `tests/integration/pool-incidents.test.ts`，以真实日志表和已脱敏合成数据验证 CLI、只读权限、无源数据变更、缺失／锁定／损坏／超限来源及写盘失败。
   - [x] 新增 `tests/local-pool/incidents.test.ts`，随现有无外网本地池套件验证实际服务自动产出：发送前错误、读头前断连、HTTP 失败、流错误／缺终态，以及随后独立请求成功且失败请求没有重放。
   - [x] 同一套件验证多个会话及请求报告精确归属；分页、晚终态、重复扫描、跨运行误配、取证自身故障、日志 off/summary 和关闭收口使用必要的合成夹具验证。
   - [x] 关闭后检查定时器／连接不再工作；原源记录和报告不被覆盖；合成秘密扫描及 ledger 计数证明取证零增量调用。

## 验证命令与证据

```bash
bun run typecheck
bun test tests/unit/pool-incidents.test.ts
bun test tests/integration/pool-incidents.test.ts
bun run test
bun run test:integration
git diff --check
```

- 本地池验证沿用 `tests/integration/local-pool.test.ts` 的 unshare --net 包装；不得直接用真实账号或真实模型替代离线夹具。
- 集成套件已经覆盖实际固定 293、本地池和生命周期；本轮不改 src/runtime、转发器或原生协议，不例行重复完整 test:native。若实现实际触及这些边界，先同步设计并按受影响合同补充验证。
- 取证报告、零真实调用证明、源文件／账本对比、秘密扫描、分页／晚完成／关闭结果保存在独立 artifacts 目录；任务 research 仅保存无秘密的结果摘要和路径。

## 验收映射

| 验收 | 验证 |
| --- | --- |
| AC1 | 无外网假池断连、HTTP 与流失败，自动报告 ID、阶段、错误码和状态与原记录一致 |
| AC2 | 旧账本、损坏字段、无最终采集、无头值／标识及冲突头，未知／冲突可见 |
| AC3 | 超过 100 条、多轮分页、早创建晚失败、重复扫描、多个会话和两个独立运行目录 |
| AC4 | CLI 无引擎初始化；自动采集前后池实收与账本计数无增量；报告和诊断秘密扫描；正文文件未读取 |
| AC5 | 源不可读／占锁、日志 off/缺口、输出不可写及清理异常；不改变请求结果，无重放，无后台泄漏 |
| AC6 | 已停止服务的运行目录补采；runId 不一致拒绝关联；已有报告跳过、冲突报告拒绝覆盖 |

## 后续关口与回滚

- [x] CHK-001：隔离请求报告与状态文件，兼容旧平铺报告，补 `status` 请求 ID 回归。
- [x] CHK-002：补齐 Candidate、CaptureRow、RunSources 的中文接口注释。
- [x] FBK-001：累计最终扫描各页故障，验证首／中／尾页失败及恢复后的状态。
- [x] FBK-002：完整校验历史报告，验证损坏嵌套值、缺字段、额外字段及合法部分证据。
- [x] 复跑完整集成，保留上一轮 forwarder_start/UNKNOWN 的失败证据；只有新一轮通过后才能更新验证结论。

- [x] 代码完成后按 trellis-route(target=check) 进入 Check-All，修复本轮确认问题；按流程评价／更新 logging-guidelines 的自动取证合同。
- [x] 通过检查后展示精确文件提交计划，遵循 trellis-push 的确认；不把历史脏路径混入本任务。
- 功能回滚仅移除 local-pool 的采集器生命周期接入、新 CLI 与脚本入口；原日志、账本、配置和 reports 证据保留，不执行数据清理或迁移。

## 本轮验证事实

- 修复 CHK-001、CHK-002、FBK-001、FBK-002，完整重检通过，剩余 CHK/FBK 为 0。
- `bun run typecheck` 通过；单元 149/149、775 条断言；定向 22/22、191 条断言；完整集成 41/41、265 条外层断言。
- 上一轮 5 份现场报告兼容验证通过，原报告未覆盖；所有模型场景均使用无外网隔离及合成身份，真实模型调用为 0。
- 证据：`artifacts/pool-incident-forensics-repair-20261107T071748Z/`；上一轮失败记录仍保留在 `artifacts/pool-incident-forensics-20261107T070046Z/`，启动 UNKNOWN 本轮未复现，未宣称根因已定位。
- `trellis-update-spec` 返回 written，仅修改 `.trellis/spec/backend/logging-guidelines.md`，六节合同及边界验证通过。
