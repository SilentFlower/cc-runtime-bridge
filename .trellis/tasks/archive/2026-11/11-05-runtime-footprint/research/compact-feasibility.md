# 固定 293 轻量构建与常驻状态预研

> 历史记录：本报告描述首次 Brief 批准前的预研。用户随后已批准实施及内核裁剪；最新准入、产品实现与回归进展见 kernel-admission.md，不能把下文的当时状态理解为当前仍未获准。

## 结论及有效范围

本次只修改任务材料，并在临时目录做构建/状态探针，没有修改产品代码，也没有取得本版首次 Brief 实施批准。

固定原版自带的 Bun 构建 API 可以重建专用应用并保留已核对原生节，必需的 11 个接口已成功导入。普通 UPX 压缩后为 34217464 字节（32.63 MiB），超过标杆 6284412 字节，**体积验收未通过**。没有实际多轮请求/模型调用性能数据，不能认定已实现兼容的轻量常驻运行时。

单独的状态探针证实新建原生根加异步作用域能隔离 requestJournal 和迟到回调。这只是实现依据，不能替代完整 metadata、billing、工具、thinking、取消及跨轮测试。

## 输入与实验隔离

- 原版路径：/root/.nvm/versions/node/v22.23.4/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe。
- 原版 SHA256：8968405e26db478af44eabc4635ab5ca557057b702a54460a59c13e1b253e978；自报版本 2.1.293，内部 Bun 版本探针为 1.4.3。
- 临时根：/tmp/ccrb-compact-feasibility-tsy0tloy。全部提取源码与可执行文件仅在临时目录，未收入仓库。
- 构建和运行均经 unshare --net 隔离，环境白名单及独立 HOME/CLAUDE_CONFIG_DIR；不读取宿主账号、不执行外网请求或真实推理。
- UPX 为已核对的 5.3.0，工具 SHA256 为 39bbf81cb4c56ce3e2e13a1755a31ec4970e33f061db8e214e9fac59354fc9aa，来源及归档身份沿用前一轮 research/study.json。

## 构建入口与原生代码

1. 从固定 ELF 应用区校验并提取 2511 个模块/资源，按实际编码转换文本，保留原始字节摘要和 loader。
2. BUN_BE_BUN=1 的 --version/build --help 探针没有进入可用的通用编译入口，不能直接照搬外部 Bun 的命令假设。
3. 通过原版 BUN_OPTIONS 预加载脚本调用 Bun.build，指定 compile.executablePath 为同一原版，可以生成并运行新的可执行文件；最小程序自报 Bun 1.4.3。
4. API 探针入口绑定固定模块的 Re/Kc/K_t、yN/Ree、Nst、F/nEr/yLs/t_、su。最终成功探针的 .text、.rodata、.bun_builtins、.data 大小及 SHA256 均与原版完全一致，详见 compact-feasibility/native-files-preservation.json。
5. Bun.build 的返回 BuildArtifact.size 不是最终可执行文件大小；最小编译探针的 Blob 仅 90 字节，而文件系统 stat 是 89181368 字节。后续所有体积结论均读实际文件。

这是原生节保留证据，不是整个二进制与原版相同，也不证明已完成 CCH 或原生发送回归。[Bun 官方单文件构建文档](https://github.com/oven-sh/bun/blob/main/docs/bundler/executables.mdx)描述的文件嵌入与实际编译 API 可作为接口说明，具体支持能力仍以固定程序探针为准。

## 依赖闭包的实际缺口及修正

构建最初成功、metafile 输出 imports 为空，但运行连续暴露三类依赖：

| 暴露问题 | 探针修正 |
| --- | --- |
| import.meta.require 的静态 JS 目标未打包 | 在固定源码中把静态定位变为可被编译器解析的 require，并映射受限虚拟根 |
| He 调用的文本资源缺失 | 先核对 He 为固定辅助模块导出的 import.meta.require，再显式包含文本 loader 资源 |
| 通过文件路径读取的 .zst 资源缺失 | 使用带 file 属性的显式导入，保留文件字节并让编译器提供嵌入路径 |

最终探针 metafile 有 1141 个输入，转换 197 个静态 import.meta.require、12 个资源别名调用，并嵌入 9 个压缩资源。11 个必需接口的 typeof 均为 function，运行退出码为 0。

这些数字只描述本探针的实际命中。临时脚本采用了固定样本的受限匹配，尚未实现产品级逐位置/哈希合同及残留动态路径审计；不能直接作为通用转换器发布。更不能通过运行时访问原版提取目录补齐缺失项。

## 体积和探针耗时

| 对象 | 字节数 | 结论 |
| --- | ---: | --- |
| 成功导入接口的同内核专用构建 | 107199672 | 其中 .bun 为 18020943 字节 |
| 该构建经 UPX --best --lzma | 34217464 | 32.63 MiB，未达目标 |
| 相同内核的 Hello World，经相同 UPX 参数 | 29599364 | 28.23 MiB；当前方式下仅继续裁剪 JS 不足以保证目标 |
| 专用构建整体 XZ/x86/LZMA2 压缩 | 33147020 | 31.61 MiB，且仅为压缩归档，尚非可运行部署方案 |
| 固定 vm2api cli-node | 27933052 | 26.64 MiB 的最终验收上限 |

UPX 压缩用时 59.620 秒；完整性测试退出码为 0，解压后 SHA256 与压缩前 3ad0d4b919b30dae2de91a6152b5ffb53315204e5792e64137bca95dd5d2391f 一致。压缩后文件 SHA256 为 eea569fd5d9d80f03a15bdee5ac12775ec02d0e995ba940ba69a1603b1efa89f。

五次压缩探针新进程均成功，启动至打印接口类型并退出的中位数为 2.740924 秒。它没有完成配置就绪、构造请求或模拟上游往返，不能与 vm2api 的协议就绪/首轮/复用速度作验收比较。

普通接口探针未压缩的一次启动为 0.741485 秒，只是辅助观察。原版 0.1491 秒的历史模块探针、这里的重建探针及 vm2api 的 20 槽 ready 边界不同，均不能交叉冒充初始化对照。

## trim 探针

[Bun 的体积文档](https://bun.com/docs/compiler/size)说明实验性 trim 可移除未使用能力。本次在固定原版 API 上加入 compile.trim=true，构建仍为 107199672 字节，接口导入能成功，但体积没有变化；原二进制亦未发现该选项相关的若干诊断字符串。现有证据只能说明本探针没有获得裁剪收益，不能宣称此固定程序支持文档中的完整 trim 能力，更不能为了缩小文件换成未验证的通用 Bun。

## 原生会话作用域

已读取固定状态模块的实际定义：

- F 通过已注册读取器获取当前 session，否则使用进程默认根。
- yLs 注册作用域读取器。
- nEr 按 host、id、parentId、project 创建新根，账号 host 可共享，请求日志、模型选择、账本和 scratch 等重新创建。
- t_ 更新会话身份，但只切换相同 sessionId 不足以清理上一轮全部状态。

探针为同一个 sessionId 创建两份根，用 AsyncLocalStorage.run 分别绑定：第一份 promptIndex 写为 11，并延后读取；第二份初始值为 0、写为 22；延后回调仍读到第一份的 11。roots_distinct、host_shared、outside_restored 均为 true，证据见 compact-feasibility/session-scope-probe.json。

这为“同账号常驻、每轮独立根”提供依据。账号 host 内部共享缓存、原生 SDK 残留状态及完整请求账本尚需验证；取消和未知异常优先销毁工作进程，不带病复用。

## 后续准入

体积目标继续为 27933052 字节，当前候选均未通过。先研究并证明达到该目标的完整打包方式，保留固定原生发送能力和真实执行身份；未通过前不把常驻重构当作体积问题已经解决。后续必须用最终产物执行 TLS 原生回归、同 PID 隔离及同边界速度对照。

compact-feasibility/ 保存 JSON 元数据及自有探针脚本快照；脚本含本次临时路径，不是产品构建入口。复现需要相同固定输入并始终保持独立 HOME、网络命名空间；没有保存或引导读取真实凭据。
