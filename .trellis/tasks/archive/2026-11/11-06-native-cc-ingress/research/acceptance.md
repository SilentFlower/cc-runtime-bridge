# 原生 CC 入站验收记录

## 实现与合同

- 完整固定 293 原生正文通过 billing + metadata 识别；原生业务字段及省略状态保留，普通 API 白名单保持。工具省略或空列表均不补默认工具。
- 原生分支仅改写 metadata.user_id 的设备/账号归属及 billing CCH 占位，保留会话、其他 metadata、版本后缀、prompt、轮次及父子信息；完整合法扩展正文不会成为本机控制参数。
- 同一 SDK 的种子构造仅提供当前账号发送上下文，唯一 Ree 发送原生正文；没有第二个 SDK、JS 最终 CCH、模型重试、本地工具执行或代理循环。
- 日志新增可选 inputFormat，旧记录保持未标注，入口失败尚未解析的请求显示未解析；原生中间段准确标为改写，demo 继续标为 demo_fixture。生产 nativeFinalCapture 仍为 false。

## 原超时根因与新结果

| 原场景 | 根因 | 当前结果 |
| --- | --- | --- |
| forced-tool | 固定模型要求 adaptive thinking，与强制工具选择不兼容；原生失败未及时收口 | 原生 kps 实际能力前置校验，400，0 发送 |
| tool-history | 同次原生提醒被并入 tool_result.content，旧投影误判业务改变；构造异常被查询循环消费 | 完整前缀及已知提醒逐项关联，200，1 发送 |
| subagent | 带工具历史时同类提醒合并，部分 Environment 附件提升为 system | 仅接受同次已知完整转换，200，1 发送 |

原生构造异常、助手 API 失败事件和 model_fallback_triggered 均确定失败并取消原生任务。业务丢失、修改及未知提醒仍拒绝。额外补充两条接入路径的 thinking 类型/预算校验，以及 billing 合法间隔的占位/最终 CCH 回归。

## 验证与场景

- 单元：69 项、219 断言；集成：17 项、65 断言；原版/最终精简版各 49 项原生测试、707 断言；浏览器：5 项。类型检查和构建通过。
- 原 23 组普通 API：每份运行时 17 组 200、1 组 400、5 组 422，0 超时。新增原生 26 组：20 组 200、2 组 400、4 组 422。共 49 组，逐条结果在 [场景矩阵](./scenario-matrix.md)。
- 场景矩阵中原版和最终产物各 37 条已发送样本由独立 Node TLS 接收器保存有序 rawHeaders 与实体字节，并独立核验原生最终 CCH；每组最多发送 1 次，无重放。另对两套原生回归各 60 条 Bun TLS 实体正文做完整独立 CCH 审核，120 条均通过；这些头部已经规范化，不能作为有序原始头证据。最终 20 条原生成功样本逐字段确认只有改写清单发生变化。
- cc2api 探针比较同一入站正文，原生模式为 ClaudeCode 改写，普通 API 模式为 API 改写，均进入产品 send_direct；它不是完整 Gateway 验收。43 次 cc2api 发送中 42 条独立 CCH 核验通过，合成 billing 间隔变体未通过；标准格式原生样本通过，不能由这一容错边界推断真实账号表现。
- 原版来源与原生模型工厂已从固定官方源核对；vm2api 的 303 常量与未匹配本地二进制不作为规则权威。

## 最终产物与体积

| 对象 | 字节数 | SHA256 |
| --- | ---: | --- |
| 官方源 2.1.293 | 252755128 | 8968405e26db478af44eabc4635ab5ca557057b702a54460a59c13e1b253e978 |
| runtime/claude-293-native-ingress-release | 27375672 | 9573d2b95d8da1840619e934963bdd2f6e19fbc416ffbae4ab453fa64ac0c8c1 |
| memfd 执行体 | 112786616 | 92db6d58144c1ff12be157d2044da620318a6de54caf98b5b64826a5ab77c36d |

完整部署仅一个必需可执行文件，26.11 MiB，比旧显式工具产物增加 4096 B，低于 27933052 B 上限，余量 557380 B。两次独立构建的外层/执行体/源码/配方及闭包集合一致；19 份嵌入源码摘要与当前源码逐项一致。候选、重复构建和先前失败证据均保留在忽略目录；正式接纳表只登记最终身份。

普通 API 和原生入站各在隐藏官方源、项目源码/依赖、构建驱动、提取目录及旧 /tmp 的私有挂载/网络空间完成独立运行；实际 /proc memfd 身份正确，只观测到 189 B 专用配置增量，没有完整执行体的磁盘展开。实际新执行体与原版的 108 组分词、24 组 Unicode 规范化对照通过，覆盖 default/en/zh/ja/th/ar；不扩大 locale 定制承诺。

## 时延与计量边界

五轮、每进程六个串行作业，两方交错共 60 次本地 HTTP SSE 请求，真实上游为 0：

| 指标 | 最终精简版中位数 |
| --- | ---: |
| 启动至 worker_ready | 2732.179 ms |
| 启动至首轮完整完成 | 2760.539 ms |
| 就绪后首轮 | 25.724 ms |
| 暖复用 | 17.691 ms |
| 作业后 RSS | 185311232 B |
| 额外配置文件 | 188 B |

旧相对速度脚本保留 passed=false、退出 1，暖比值 1.671；用户已取消该相对速度门槛，这不等于历史性能目标通过。页缓存未清理，计时包含解包及本地初始化，不包含 HTTP 控制面、外网和模型推理；各阶段中位数不相加或相减代替总耗时，不跨批次宣称确定速度收益。

## 页面、历史与安全

- 两批共追加 95 条，预览 184 条；原 89 条详情不变，最终追加前的 135 条也全部复核哈希不变。最终 49 场景有 37 条真实本机 TLS 最终采集、12 条无发送。分页 50/50/50/34，桌面和 390 像素手机通过，浏览器错误为 0。
- 场景页面 http://127.0.0.1:8788/ 默认原生 26 组，另列普通 API 23 组；项目日志 http://127.0.0.1:8787/ 仍显式 demo 服务，只读展示导入的真实离线采样。原生中间值与独立最终值分开，缺失不补造。
- 所有执行均使用合成凭据、独立 HOME/config/cwd 与无外网回环；没有读取或刷新真实账号，没有付费推理。既有 pyc 缓存 SHA 未变；cc2api/vm2api 产品代码未修改。
- 不宣称免封、生产 OAuth 已验证、完整 Gateway 已验证或 TLS 指纹完全一致。当前生产最终出站自动采集能力没有改变。

## 原始证据入口与回滚

证据根目录 artifacts/native-cc-ingress-20261106/ 已被忽略，完整提示词、提取源码、原始样本、凭据及二进制不进入 Git：

- native-original-boundary.log、native-release.log；unit-release.log、integration-release.log、typecheck-ui-status.log、build-control-release.log、ui-status-fixed.log、build-ui-status.log。
- 四个 *release-scenes/comparison.json 及 cases/*/request-log.json：原 23 + 新 26，原版和最终产物逐行对照。
- native-cch-audit-release.json、reproducibility-release.json、deployment-report-release.json、deployment-native-report-release.json、intl-verification-release.json。
- benchmark-release/{samples,summary}.json 及 benchmark-release.log：旧诊断失败与原始时延。
- preview-import-release.json、preview-verification-release.json、history-before*.json 及 *-release.png。

需要回滚时同时恢复本任务控制/适配代码和对应接纳表；旧运行时保留磁盘文件，不能只替换版本字符串、混用新控制层或重放失败请求。当前任务无外部部署与账号状态迁移。
