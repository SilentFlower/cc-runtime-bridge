# 实施进度与验证索引

## 已实现

- schema 2 新增 request_input、raw_input_protocol=1 及 header_policy 决策事件；原版/精简复用同一 parse/prepare/native job。
- Linux x64 候选 27387960 B，双次构建完全一致；分发 SHA a6998db0128cb3d0a9862f3b72e9e359e434840c9be4d57b69d56092847fd800；执行体 112839864 B / ea2cc610928260ca76054fc1818c7c83bb95efe183b06ce98e3d6be7dc31b9b1。
- cc2api request_backend=legacy|native293：模型/SQLite/PostgreSQL/API/Accounts.vue；后端更新即使未配置 V3 也使用本地忙门禁。V3 继续受控 quiesce。
- Gateway 在 Rust 重写前分流，保留逻辑原始 JSON 及多值头（Latin-1 字节串），账号 Fast/1M 授权先做拒绝校验；旧 401/signature/429 重放循环由 early return 隔离。
- 私有 /internal/native/status、/internal/native/messages；绑定/时限/目标/秘密检查。原生池按账号、环境/代次、身份、bearer、代理、并发摘要隔离；默认3标准/6半槽；终态+idle 收齐复用；取消、异常和闲置进程死亡退役。每进程私有 HOME/config/cwd，严格环境只含当前 bearer，无 RT；FD 启动与实际 memfd SHA 核验。
- HTTP/HTTPS 代理保留原生路径；SOCKS5/5h 使用限定 api.anthropic.com:443、随机 Basic 鉴权的本地 CONNECT 适配，TLS 原始字节保持；无鉴权/跨目标在连接代理前拒绝。
- 原生诊断从 cc_prepared 白名单摘要回传 x-v3-native-observation；固定已核验293及 native293_cc_prepared 来源，消费后删除内部头；sender 证据与诊断共用私有作业 UUID。上游同名控制头剔除。摘要缺口显式 native293_unobserved，未准备的422保持零次。
- native_contract.rs 共享跨平台 DTO；native_runtime.rs 仅 Linux x64；其他平台明确503，备用实现纳入编译冒烟检查。
- bench 显式 V3_NATIVE_SENDER_MEMORY、固定二进制构建输入/清单、镜像 SHA 复核、UID1001 /native；冻结 fingerprint.native_sender_memory 同步 CLI 指标、physical_features 及静态/串行评审预算。
- 共享映像优化后的原生 sender 最低 256+192*max_workers MiB；工作数由账号并发与有限内存决定，取消任意64工作者上限。原生 PID限额128+32*工作数；legacy保持旧128。CPU总分配保持既有。
- V3 Docker Cargo registry/git/target 使用项目独立锁定缓存，--locked 编译后复制到普通/out层；用以完成可靠重复验证。

## 已取得的证据

当前根 artifacts/cc2api-binary-forwarder-20261110（均 gitignored）：

- ccrb-runtime 与 ccrb-runtime-repeat：同 SHA，manifest来源及桥接源哈希可核对。
- native.log：候选65 pass / 0 fail；unit.log：176 pass / 0 fail；integration.log：48 pass / 0 fail，包含固定官方实际CLI离线子套件。
- tls-original2.log：原版44 pass / 0 fail。
- native-original.log：原版首次63 pass / 2 fail（日志线程启动5秒超时）；native-original-recheck.log 两项补验通过，源码保持。
- standalone-3/standalone-report.json：固定干净 Python 镜像，独立二进制、无源码/Bun/官方源、无外网；3普通及6Haiku，共9次TLS实收，独立CCH核验通过；memory.max=2550136832，memory.peak=1631354880，oom/oom_kill=0。
- consumer-observation.log：HTTP，实际 Rust池+Gateway+私有HTTP+实际二进制，16次TLS模型提交、峰值6并发，账号/令牌变化/取消/CCH/白名单/原生293及诊断计数和来源通过；上游伪造内部头被剔除。
- consumer-socks-final.log：SOCKS实际路径同样16次、峰值6并发通过（最后的小写设备ID拒绝、平台模块拆分及证据UUID关联还需最新复验）。

外部日志：

- /tmp/cc2api-native-all-tests5.log：753单元及所有默认integration测试通过，--test-threads=4。后续新功能已变化，需要最新最终测试。
- /tmp/cc2api-native-final-tests.log：753通过/1失败，旧beta query场景503；/tmp/cc2api-native-beta-recheck.log 对应单场景重验通过。当前 /tmp/cc2api-native-final-serial-tests.log 为 --test-threads=1 全量（启动时早于最新平台拆分/证据UUID）。
- /tmp/cc2api-native-pg2.log：实际独立 Postgres native2 库的历史迁移、创建、全量/局部更新、回退通过。附带修复 SQLx Any NULL(i32) 的文本时间 cast，先TEXT再TIMESTAMPTZ。
- /tmp/cc2api-native-python-runtime.log：141通过；physical.log：8通过；budget-freeze.log：4通过；manage.log：32通过；web.log 前端build通过。最新83账号runtime回归在 /tmp/cc2api-native-runtime-freeze.log。
- /tmp/cc2api-native-proxy-unit.log：随机鉴权和目标隔离测试通过。

## 待完成

1. 已收齐编译、755单元及默认integration、原版两项超时补验；最新 HTTP/SOCKS消费者均17次模型提交、峰值6通过，覆盖流式工具/thinking历史及父子关联。
2. 完成最新V3镜像构建及 deploy/v3/verify_forwarding.py --native 实际两账号/三角色/3普通/6Haiku/按账号回退验证。最终代码相对已启动快照有平台拆分、证据UUID、小写设备ID变化，需要缓存温热后的最终批次重建。
3. 完成规划AC与证据、Check-All、Update-Spec、三仓精确Push门禁及实际beta2二进制发布/附件下载验收。
4. 独立 Postgres测试容器 ccrb-native-pg-20261110，127.0.0.1:36430，数据库 native2 已验证；容器已清理。

## 构建失败记录

- 旧 native-20261110-candidate control镜像完成；account阶段DockerHub python镜像元数据TLS握手超时，清单未生成。见 /tmp/ccrb-native-v3-build.log。
- native-20261110-final1 已主动停止过期快照构建，改用带Cargo缓存配方；见 /tmp/ccrb-native-v3-final-build.log。
- 当前 native-20261110-final2 正在编译，/tmp/ccrb-native-v3-final2-build.log，输出 /tmp/ccrb-native-v3-final2-verification.json；临时BuildKit缓存温热后用最新代码新批次构建，不覆盖既有标签。

## 已授权与工作区保护

用户已确认整个Brief，任务in_progress，implement路由inline。无额外整体Brief审批。Git精确计划和发布仍走对应门禁。保护 root任务外20路径及bench旧doc/11-04暂停任务；子仓初始干净。禁止真实账号、远程部署或付费推理。

## 最新补充

- 原版两项日志线程超时已单独补验通过：native-original-recheck.log，2 pass /0 fail。
- /tmp/cc2api-native-final-serial-tests.log：当前库755单元通过，所有默认integration通过；后续平台拆分和证据UUID关联由最新聚焦验证覆盖。
- consumer-release-proof.log：最新SOCKS 16次/峰值6通过，含实际原生诊断和非法大写设备身份模型零发送；本次测试编译包含平台守卫和证据UUID关联。
- 先前 cargo fmt --all 连带格式化50个 vendored craftls文件。已精确按初始干净基线恢复，差异备份 /tmp/ccrb-native-vendor-formatting.patch。后续仅 package --check，不改vendor。
- final2 的control完成，account发现Dockerfile.dockerignore缺少native-runtime允许项；已补齐，见 /tmp/ccrb-native-v3-final2-build.log。当前最新冻结批次 native-20261110-proof1，输出 /tmp/ccrb-native-v3-proof1.json，日志 /tmp/ccrb-native-v3-proof1-build.log，包含所有最新运行代码、平台守卫及恢复后的vendored源。

## 当前验证批次

- consumer-extended-proof.log：最新 SOCKS 17次提交、峰值6通过。consumer-http-release.log：最新 HTTP 同17次/峰值6通过；包括流式子代理工具返回、thinking/工具历史、实际诊断来源与UUID、伪造内部头剔除。
- /tmp/ccrb-native-final-typecheck.log：最新全部TS类型检查通过。24份实际构建输入SHA与候选manifest逐一匹配。
- native-20261110-proof2 两镜像构建完成，联合清单 /tmp/ccrb-native-v3-proof2.json；source_content_sha256=9e42d6460d06ffb6f4adc392b9ca47807a6b8048eab739498c1064eccb621a0d。
- proof1/proof2的实际容器验证在旧30秒管理桥等待上限超时。proof2/startup-failure.json保留503与脱敏启动日志；实际/proc文件句柄及CPU显示调度器正在校验并注册内置项目库。验证器改用既有ACCOUNT_STARTUP_TIMEOUT=150秒，并保存失败摘要。当前proof2b运行中，日志 /tmp/ccrb-native-v3-proof2b-test.log。
- 本地预备附件在 artifacts/cc2api-binary-forwarder-20261110/release-v0.1.0-beta.2，包含分发文件、完整构建manifest和SHA256SUMS。最终发布仍待完整验证、Check-All、Update-Spec和精确Git门禁。

## 实际 V3 验证中的修正

- proof2b 已通过角色隔离、UI 创建、SQLite、OAuth代理、JSON/SSE、取消等17组场景；重启场景失败时证据明确显示上游在12.68秒自然完成。夹具已改为恢复条件成立后显式放行，保留180秒硬上限。proof2c 的重启和后续证书/代理故障场景全部通过。
- proof2c 在切换 native293 后唤醒失败。静态链路显示 v3_quiesce 先停止角色，而新布局分支调用 _sender_active 查询停止的 HTTP 服务。已改为复用 _running_sender_active：运行时读取真实活动，停止时为零；身份和查询错误仍按原门禁拒绝。
- /tmp/ccrb-native-stopped-layout-test.log：新回归通过，覆盖运行 sender 有活动时拒绝、停止后重建、六进程预算和代次增加。/tmp/ccrb-native-layout-runtime-regression.log：84项账号运行时测试通过。
- 最新 native-20261110-proof3 正在构建，日志 /tmp/ccrb-native-v3-proof3-build.log，包含上述实际修正。过期proof2d继续保留失败诊断用途。
- 接入文档已明确通用公式128+384*2*N MiB，bench创建默认N=4需要3200m；已实测N=3的2432m配置。

## 新增内存确认

- 用户“要这么多内存吗 有点恐怖”，随后通过选择确认“先优化再发布（推荐）”。当前进入同任务增量实现，尚未进入Check-All。
- memory-independent-stream-hash.json：单进程就绪current219.9 MiB；六进程current1226.1/peak1234.9 MiB；降到一个后213.9 MiB。
- memory-shared-stream-hash.json：六进程同一实际inode、封存15，current692.2/peak700.2 MiB；降到一个后213.2 MiB。均无网络、未提交模型，完整业务仍待复验。
- proof3实际HTTP账号完成3普通/6Haiku及原端点，sender peak见partial-results。SOCKS账号并发3只收到2份上游请求，屏障60秒超时；第三请求的状态被夹具KeyError遮住，原因待核实。新夹具先断言状态并保留受控错误。当前版本的SOCKS独立消费者17次实际TLS已通过；实际V3该场景继续验证。

## 共享池当前状态

- NativePool已缓存首个经SHA/长度/版本/PID及四项封存核验的实际执行映像；后续exec核验相同dev/inode。独立进程保留私有HOME/config/cwd及每轮根。
- 单个Weak回收任务在额外进程空闲60秒后保留一个暖进程；模型峰值容量保持2*concurrency。实际Rust池测试使用2秒同一回收逻辑，验证6→1、取消→0及从缓存映像重新启动，实际13次模型提交数保持；Gateway另4次提交。
- consumer-shared-http.log与consumer-shared-socks.log各17次/峰值6通过。较低预算HTTP首次Gateway夹具遇SQLite锁，测试helper改用生产init_db/WAL；consumer-shared-budget-http2.log随后17次通过。更低预算Socks及全量Rust串行正在执行。
- 新预算预检共享基础256 MiB+每进程192 MiB，N3最低1408；V3实际候选1536 MiB，CLI在总4g下2304 MiB。/tmp/ccrb-native-shared-budget-python.log共88项通过；格式检查通过。
- native-20261110-shared1双镜像构建完成，清单/tmp/ccrb-native-v3-shared1.json，source_content_sha256=ac276e735a04d200139f81f5c0790d14b4c4d8e1dfa3dfec8e7b41444f7e83bd。后续仅Gateway测试helper/WAL及unused import变动；生产编译路径相同。控制器夹具增加同inode/封存、OOM0、60秒回收与闲置占用测试。
- 当前实际V3验证：/tmp/ccrb-native-v3-shared1-test.log，输出artifacts/cc2api-binary-forwarder-20261110/v3-shared1；最新完整Rust串行/tmp/cc2api-native-shared-final-serial.log。

## 最新验收完成

- v3-shared1真实容器29组场景通过；6路峰值HTTP676216832 B、SOCKS677347328 B，1536 MiB限额内oom/oom_kill均0；60秒回收至1个暖进程，sender_idle198385664 B。
- consumer-shared-budget-socks2.log串行复验17次提交、峰值6及诊断通过。完整单元755通过/1项usage5秒等待超时，/tmp/cc2api-native-shared-usage-recheck.log对应聚焦已通过；/tmp/cc2api-native-shared-integration.log全部默认integration通过。
- PostgreSQL进一步单连接用例复现SQLx Any NULL(i32)与文本参数缓存漂移（/tmp/cc2api-native-pg-cache-before.log）。账号创建/更新按6个可空字段存在状态追加有限SQL缓存键，停用按时间可空状态分组；值与NULL/空字符串语义保持，SQLite原SQL保持。实际PG补验/tmp/cc2api-native-pg-cache-after.log通过。
- 最后Store单元8项与SQLite时间integration16项已通过，日志为/tmp/cc2api-native-store-final.log、/tmp/cc2api-native-timestamps-final.log。临时PG容器ccrb-native-pg-cache-20261110已清理。
- 当前进入Check-All；Spec与精确Git门禁待执行，beta发布和附件实际下载仍为AC7待执行。

## 三仓推送及beta.2发布后的状态

- 用户确认精确计划后，三仓业务提交e783aa5、fff3623、97f1d446已推送；bench同时推送已明确授权的875e414历史Flower提交和已验证GC 9624fe5。原有root20/bench343个工作区路径的状态与内容已核对。
- beta.2已公开发布3个附件，实际下载/校验、标签与24项源码输入匹配、bench默认附件URL和预算配置入口均通过。完整HTTP和SOCKS复验各17次/峰值6通过。
- 发布验收的首次HTTP/SOCKS Gateway用例出现过准备503，后续多轮复验通过；具体拒绝条件仍待定位。保留失败日志和抓包；任务继续in_progress，进度记录为partial。详见research/acceptance.md。
