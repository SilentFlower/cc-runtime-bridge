# 实现证据与交付边界

## 仓库基线

| 仓库 | 开工 HEAD | 任务责任 |
| --- | --- | --- |
| cc-runtime-bridge | af4e31336fb5bd2b8bc07f84821db8a2b8cc1517 | 固定 293 构建配方、签署附件、离线消费者夹具 |
| vibecoding-bench | 06bbb6f3d1fef1b5cdf242f85073263989e31dc6 | 灰度目录、受控下载、账号切换协调和环境页 |
| cc2api | 9591df8fbe349e17be7a56a988bed3a9b7a93717 | 受信版本校验、维护所有权、零模型预热、进程轮换 |

开工检查见各仓 HEAD 与 porcelain。根仓其他任务文档及 bench 的 303 研究文档属于既有工作。cc2api 开工时无工作区改动。变更范围以三个仓实际差异和任务责任冻结。

## 候选证据

- 官方源：2.1.293，SHA256 8968405e26db478af44eabc4635ab5ca557057b702a54460a59c13e1b253e978。
- 候选配方启用 ELF Build ID，方便定位分发文件。两次独立构建分发文件一致，27388048 字节，SHA256 bc732aad564e702050e88ad0888b38dbac1692200cfab2afd2b2ab9720026114。
- 实际执行体 112839864 字节，SHA256 22f26d7803f80630968caf21b6170cf9bb94d87bea6f5eef678464f3bb0d3ecd，与镜像内置版相同。实际候选加载器及进程轮换在隔离消费者验证。
- 本地候选先使用临时测试 Ed25519 签名。正式发布 `v0.1.0-beta.4` 使用独立发行公钥，精确附件及生产灰度环境已绑定，详见生产验收。

## 本地结果

- 根仓 TypeScript 类型检查及 178 项单元测试通过；固定原生回归 67 项通过，可选独立 TLS 模式未纳入本次原生回归。
- cc2api 全量 Cargo 测试：766 项库测试及 85 项集成测试通过，需另行配置的忽略场景保留。
- bench 账号运行、管理工具、管理鉴权分别 90、33、6 项通过；内核状态机 7 项通过。
- 首轮隔离真实网关/发送器使用签名候选，完成 22 条回环请求，验证排空期间原流完整、准备零推理、候选 PID 与原 PID 不同、原版回滚和新请求复用。
- 无外网独立容器候选报告：artifacts/native-kernel-online-switch/standalone-candidate/standalone-report.json。
- V3 双账号真实容器验收使用明确标记的 verification-only 联合镜像及测试签名；生产验收需另按发布和部署操作单执行。


## 修复后验收（2026-11-11）

- FBK-001：管理端提交环境代次与持久状态版本，准备、激活与对账消费原版本；相同请求重复读取原结果。回滚后的旧激活请求明确冲突，版本保持 beta.3，预热共两次。
- FBK-002：专用切换准备在原 warmup 写锁内等待物理 live 与 idle 一致，退役旧空闲集合后等待 live=0，再启动候选。实际二进制夹具模拟退出未收口和一个空闲进程；100ms 内旧 PID 保持，归还物理许可后才启动新 PID。
- 当前 Rust 全量测试、Python 7 项状态机、90 项账号生命周期回归通过。
- consumer-repair-http.json 与 consumer-repair-socks.json：各 22 次实际 TLS 回环，code=0。无外网合成身份，真实发布候选及双摘要核验。
- v3-repair-e2e/results.json：30 组全部通过。N5 经真实管理 API 完成准备、激活、回滚；目标长流完整、仅一条上游请求、实际 worker PID 更新，对照账号 PID 与所有容器 ID/StartedAt 保持一致。切换后再发业务请求复用新 worker。
- 第一轮 V3 夹具因提前创建制品目录触发首次部署归属保护。修复夹具为完成空数据根初始化后再放离线候选，第二轮 30 组完整通过。
- Check-All 重检：FBK-001、FBK-002 已修复，余下 CHK=0、FBK=0；生产现场正向/回滚保留为上线后验证，由真实 11-5 环境与正式受信发布制品验收。

## 生产验收（2026-11-11）

- 正式发布：[v0.1.0-beta.4](https://github.com/SilentFlower/cc-runtime-bridge/releases/tag/v0.1.0-beta.4)，标签绑定 `f2ef5bba233b8fa99e0250e0f0d68f4e636e2bec`。四个附件已发布，发行公钥为 `78789cb81868c9a91b9e8b7d0e88b8d676dcfa01ed90fa907c3dc5b8cd82f792`。分发与执行体摘要同上述候选证据。
- [联合 CI 42979923877](https://github.com/SilentFlower/vibecoding-bench/actions/runs/42979923877) 成功。生产使用其清单和镜像，批次 `ci-42979923877-1`，bench 提交 `2fdb73e10ac9f5afe162d3a407eeba2821400041`，cc2api 提交 `d6b21f72eacacd7bcac30f3c8f6d1c12c28c74e0`。
- 用户明确批准三个运行环境的首次底座重建。等待 `10-23` 的真实请求自然结束后，按既有维护门进入空闲窗口。`10-23`、`10-30`、`11-5` 的环境代次分别为 46、24、10，九个角色均运行同批镜像。身份、资源政策、项目目标与会话字段的完整保护摘要通过；其他容器身份保持一致。
- 首次底座启动触发既有网关迁移，账号 12 的 `canonical_env.build_time` 和 `node_version` 被覆盖。逐项还原这两个字段后，完整身份摘要精确匹配维护前值；恢复回执为 `identity-reconciliation.json`。后续共享网关重启仍需复核此既有迁移行为。
- 唯一试点绑定为 bench 账号 14、网关账号 12、环境 `15551aa6f302494cb9b5440750899c2c`。通过正式管理 API 从发布源准备、激活 `beta.4`，随后显式回滚 `beta.3`。正向 PID=15，回滚 PID=27；两个实际 `/proc/<pid>/exe` 摘要均为 `22f26d7803f80630968caf21b6170cf9bb94d87bea6f5eef678464f3bb0d3ecd`，memfd 封存标记均为 15。
- 内核切换期间全机容器 ID、镜像身份、StartedAt、运行状态及重启次数保持一致。其他账号的内核操作入口保持灰度外状态，最终 `11-5` 为 `beta.3`。页面、管理鉴权及两个数据库 `quick_check` 通过，本次验收主动模型请求数为 0。
- 健康验收后按冻结清单定向移除两个旧批次共四个镜像，实际可用空间增加 6,951,485,440 字节。保留当前批次、`ci-42957725509-1`、`ci-42929758814-1` 三套完整发布及全部容器引用；36 个容器、14 个运行容器和其余 16 个镜像的保护复核通过。
- 服务器审计目录：`/opt/vibebench-v3-us/operations/native-kernel-online-ci-42979923877-1/`。关键回执为 `staged.json`、`deployed.json`、`identity-reconciliation.json`、`verified.json`、`final-readonly.json`、`image-cleanup/result.json`。本地脱敏执行日志位于 bench 的 `.deploy/native-kernel-online-switch/`。
