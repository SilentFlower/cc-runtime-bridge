# 本地 TLS 池转发接入证据

## 已确认的用户方向

- Base URL 在本地 TLS 采集转发器修改，CC 一侧保持现有原生构造及发送。
- 池子具有 Messages 兼容接口，第二段固定使用 deepseek-flash，无需 OpenAI 协议转换。
- 原生最终出站和池转发请求分别保留，真实响应标为池测试响应；遥测关闭。

## 已读取的实现与合同

- artifacts/native-cc-ingress-20261106/run-scenes.mjs:37–81：独立 Node TLS 接收端通过私有管道交付 rawHeaders/最终正文；CONNECT 只连接固定本机接收端，当前返回合成响应。
- artifacts/cli-alignment-20261105T064401Z/tls-receiver-node.mjs：启动时使用独立 TLS 原始头探针校验大小写、顺序和重复字段，普通接收端兼容投影不能替代该证明。
- src/control/engine.ts:NativeEngine：工作进程环境白名单、固定运行时核验、1500 ms 退役宽限及单次发送约束。
- src/control/server.ts:startServer 接受注入 Engine；readConfig 支持显式环境对象；日志模式 off 不新增记录。可以通过测试包装器观察事件，不扩展生产 Engine/HTTP 合同。
- src/shared/contracts.ts：HeaderPair、RuntimeEvent、RequestDetail、CaptureRecord 已读取。生产 CaptureStage 只有既有五段，池转发额外记录由测试报告单独持有，不增加数据库字段。
- src/control/redaction.ts：Redactor 支持注册已知秘密、保持头部顺序、原文预览和部分凭据边界。池 Key 必须先注册再保存任何池响应；不能指望合成 CC 凭据的脱敏器自动知道池 Key。
- scripts/build.ts、scripts/test-native.ts、package.json、tsconfig.json：新增工具进入常规类型检查，真实池调用使用显式入口；原生模块与构建输入不变。
- .trellis/spec/backend/{runtime-contract,logging-guidelines}.md、.trellis/spec/frontend/state-management.md：最终采集位置、真实来源、截断、脱敏、隔离、响应与页面的现有合同。

## 池配置的只读核对

- /root/project/vibecoding-bench/.deploy/project-development-cycle/requester.env 存在，权限 0600，Base URL 为 HTTPS 且路径为 /v1，Key 已配置；未打印或保存 Key。
- 文件含 PROJECT_REQUESTER_BASE_URL、PROJECT_REQUESTER_API_KEY、PROJECT_REQUESTER_MODEL、PROJECT_REQUESTER_FALLBACK_MODEL；其主模型为 gemini-3-flash-agent，备用字段为 deepseek-flash。
- 本轮只读复用地址和 Key，测试模型固定 deepseek-flash；不复用主模型、不执行主备回退、不修改该文件或参考项目。
- Messages 支持来自用户明确说明；旧 OpenAI Chat Completions 联调记录不作为本轮 Messages 成功证据。当前尚未发起真实池请求。

## 网络隔离原语实证

使用本机 Node v22.23.4 运行本地研究探针，结果存于被忽略的 artifacts/pool-tls-forwarder-20261106/planning-uds-proof.json：

- 宿主 Node TLS server 监听权限 0600 的 Unix socket；客户端处于不同的 unshare --net 命名空间，仅有 lo 接口。
- 客户端通过隔离空间内回环 CONNECT，再由 Unix socket 到宿主 TLS 接收器，成功取得响应。
- Host、X-Dup、x-dUP、Content-Length 等原始头的大小写、顺序及重复项精确匹配；正文 {} 原样收到。
- 无外网或池调用。该探针只证明传输原语，不能替代真实 CC/CCH 和池流式验收。

## 当前交付基线

业务 HEAD e3b4f66da523e52ded25db80cabcff63882b8aae。固定官方 293 来源 SHA256 8968405e26db478af44eabc4635ab5ca557057b702a54460a59c13e1b253e978；当前精简分发 SHA256 20f3cb6d928aaf9c863275a02a99a4244fa6db7e5a6b1e957af8bedf1a2605f9，实际执行体 SHA256 67a49e01124d189620ce630c198f0c3db074649ebe93e895d4a87ca8c80966f2。既有 pycache SHA256 2cc351928a54cd8f205b59eee416ba130f9e5b802b1ecd62ab4a95c9a259ab5c。

规划基线仅供对照；后续实现写入测试工具与任务材料，产品 src/、固定运行时和既有预览未改动。

## 实施及验证证据

- scripts/test-pool.ts、scripts/testing/pool-*.ts 已实现独立工具；默认离线，--live 显式读取受保护配置，--report-only 只读查看。
- 原版与精简均通过 15 个回环场景，分别见 artifacts/pool-tls-forwarder-{original,compact}-release-check/report.json：原生最终 CCH 全部有效，假池实收仅根 model 改变，鉴权替换、扩展头、JSON/SSE、取消和故障均通过；每个场景只发送一次。
- CC 驱动只含 lo，命名空间与宿主不同，环境为 HOME/LANG/PATH；启动时真实拒绝普通 HTTP 和错误 CONNECT 目标。工作进程使用合成 Key/独立目录，遥测 off，结束后目录池 Key 扫描通过。
- bun run typecheck、bun run build 成功；原单元 111 项成功，此后定向池测试更新为 11 项成功，未变的 101 项继续复用。集成原 18 项成功，新 TLS 入口定向覆盖更新为 7 个子场景，后续定向结果覆盖新增代理和未收到池响应的本地 502。
- 桌面及 390 像素页面、HTML 文本安全、三次只读刷新和文件白名单已通过，见 offline compact 与 live-reviewed 目录的 page-proof.json；页面不新增推理。

## 首次真实尝试与停止

- artifacts/pool-tls-forwarder-live-first-run.json：仅预留并尝试 native-main-json 一次，状态 stopped；模型 deepseek-flash、max_tokens=128、有效 CCH=e98ae。调用方得到本地 502，没有采集到池响应正文。
- 原回执 artifacts/pool-tls-forwarder-live-verified/report.json 不改写。原工具当时未区分本地错误与上游状态，后续修正增加 upstreamStatus/forwarding；live-reviewed/report.json 只规范来源表示并保留原文件 SHA256，未改请求、CCH、池参数或调用方响应。原始异常码没有记录，明确显示 NOT_RECORDED。
- 没有重试、跟随重定向或换模型；原生子代理 SSE 和主动取消 SSE 未执行，真实接口兼容尚未验证。生产 nativeFinalCapture 仍为 false。

## 宿主代理排查与修复

- 宿主有无凭据的 HTTP(S)_PROXY=回环 7890；初版 Node 环境只有 HOME/LANG/PATH，未启用 Node 代理。DNS 可解析，额外直接 TLS 探针 4 秒超时，见 artifacts/pool-tls-forwarder-network-proof.json。
- 当前 Node v22.23.4 的本机 --help 确认支持 --use-env-proxy。工具仅向池 Node 传递经过校验的标准 HTTP_PROXY/HTTPS_PROXY/NO_PROXY；CC 驱动不继承这些宿主配置，离线模式不继承代理。受保护池 env 仍只读取地址和 Key。
- 本机假代理的实际 Node 转发通过，TLS rawHeaders 自检未经过池代理，第二段只经过代理一次。
- artifacts/pool-tls-forwarder-proxy-tls-proof.json：通过既有回环代理完成池端 TLS 1.3，证书校验通过；只有一次代理 CONNECT，池端 HTTP 请求 0、模型请求 0。它证明连接路由恢复，不证明 Messages 或付费推理成功。

## 修复与真实验收

- FBK-001：测试配置仅接纳 4–4096 位 ASCII 字母数字及 ._~-；含 JSON 转义、空白及 Unicode 的 Key 在宿主和 Node 初始化前拒绝，错误不回显原值。定向配置/JSON/SSE 跨片段反例、Node 零发送保护通过；未修改生产 Redactor。
- 每请求使用独立脱敏上下文，防止 access-control-allow-credentials=true 等标志值串扰后续预览；实际 Node 和原版/精简各 15 场景验证两个准备阶段的 stream 布尔值保持可解析。
- CHK-001：用户选择修复上一轮列出的两项后，以 --live-run repair-20261106 使用独立账本，固定三次/128 tokens/串行/首错停止；实际三次均通过。首轮 stopped 账本和原始/reviewed 回执的 SHA256 与保存前一致。
- 修复轮非流式主请求 HTTP 200/success，6757 ms，409 B；子代理 SSE HTTP 200/success，1845 ms，4833 B；主动取消 SSE HTTP 200/canceled，1102 ms，池和调用方均观察到 533 B，转发器 canceled，工作进程退役。时长含本地 CC 初始化及网络，不作为纯模型延迟。
- artifacts/pool-tls-forwarder-live-repair-20261106/acceptance-proof.json 独立核验原生 CCH 17118/ba627/9ae2d、身份头/metadata 及第二段原始正文 SHA256 仅根 model 改动。原真测部分准备预览因响应标志头而额外脱敏，保留原样，用原始哈希核验，不反向填充或重放。
- 修复阶段 bun run test：115 通过；bun run test:integration：18 通过（TLS 子场景随后新增请求隔离反例后定向通过）；typecheck/build 通过。最新离线证据在 artifacts/pool-tls-forwarder-{compact,original}-repair-offline，15/15 全通过。
- 新报告 http://127.0.0.1:8791；page-proof.json 桌面、390 像素、无脚本执行、三次刷新零推理通过。池配置原文件 SHA256 保持，产品 src/、运行时身份及生产最终采集能力没有改动。
