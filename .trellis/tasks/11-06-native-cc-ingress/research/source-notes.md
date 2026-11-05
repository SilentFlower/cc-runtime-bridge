# 规划依据与证据边界

- 基线提交：0bf504a972c3b3695ba273f754b2230686315198；唯一原有未跟踪项是 .codex/hooks/__pycache__/session-start.cpython-312.pyc，SHA256 为 2cc351928a54cd8f205b59eee416ba130f9e5b802b1ecd62ab4a95c9a259ab5c。任务创建已保存该基线。
- src/shared/input.ts:5 定义普通 API 白名单，src/runtime/293/job.ts:18 拒绝已有 billing；job.ts 中 generateNativeRequest 经 OM → K_t → fetchOverride，runNativeJob 经 Ree 唯一发送，Response 由桥接独占。
- NativeApi、NativeModelCall、NativeSession 等定义已从 src/runtime/293/native.ts 核对；现有 metadata.user_id 实际为 JSON 字符串，当前观测键为 device_id、account_uuid、session_id，不猜测账号结构或新导出。
- artifacts/scenario-compare-20261106/comparison.json 保存原 23 场景和 15 条 CLI 控制组。桥接 HTTP 状态为 15×200、5×422、3×504；强制工具、工具历史、带历史子代理均无 cc_prepared/最终出站。
- 原 5 类普通 API 拒绝是现有合同边界；新增原生分支要接纳对应原生字段。不能为声称“全通过”而把合法拒绝改成成功或删去负例。
- cc2api CLI 控制组 15 条保留 tools、messages、顶层字段集合、CCH 外的 system 及已存在分类/父子头；metadata 与 CCH 改写，beta 也变化。其合成 OAuth 账号与当前桥接 API key 条件不同，不能直接按 beta 差异判错。
- artifacts/vm-native-ingress-20261106/source-tests.log 为 113 项源码测试通过；results.json 的 10 次本地回环包含 8 次最终出站和 2 次模型策略拒绝，真实上游为 0。但本地 cli-node 实际 SHA256 为 8484c4c58f4b7782a190f7cab7c8aa5d1f706ae26b2d2a5cafe81af070f0611b，与仓库 README 的 303 声明不符，只作为本地组合诊断，不作为版本准入或模型规则权威。
- 官方 293 的本地参考为 vibecoding-bench 正式抓包研究的脱敏结构，覆盖 25 个运行、112 条 billing；原始正文不在本地，本任务不自动触发真实抓包。需要的原生验证使用合成正文或本地已有原版离线样本，标清来源。
- 原 89 条预览保存在 artifacts/wire-preview-20261105T061352Z；生产最终采集能力仍为 nativeFinalCapture=false，本任务不能用离线补采改变这项能力声明。
