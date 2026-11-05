# 轻量运行时与常驻执行

运行时以官方 Claude Code 2.1.293 为源，使用同一 Bun 1.4.3 原生构造、FetchSession/默认发送及 CCH 能力。原版与轻量版调用相同的作业适配器；版本、原生符号和源 SHA256 只由 `src/runtime/293/source-profile.ts` 定义，经过验证的分发与执行体身份登记在 `src/runtime/compact-profile.ts`。

## 构建

需要 Linux x64、项目 Bun/TypeScript 依赖、Python 3、GCC、tar、unshare 和固定官方文件。构建目录临时创建，结束时清理；原版、其它项目和已有输出均不覆盖。7-Zip 26.05 工具及 C SDK 默认从官方 GitHub 发布下载，完整校验 SHA256；可用参数显式指定同一固定工具及 SDK 归档。

```bash
bun scripts/build-runtime.ts \
  --source /绝对路径/官方claude.exe \
  --out /绝对路径/新目录/claude-293-compact
```

离线准备工具后，增加 `--sevenzip /绝对路径/7zz --sdk /绝对路径/7z2605-src.tar.xz`。工具只参与构建，不是部署依赖。C SDK 的解码与 SHA256 部分静态编进自有加载器，SDK 源文件及许可说明来自该固定归档；没有引入 UnRAR 代码。

输出包括可直接执行的单文件和 `.manifest.json` 构建报告。报告列出来源、Bun revision、编译工具、转换位置、桥接源码摘要、资源裁剪、外层与执行体 SHA256，以及部署大小。报告用于核对，不会自行授信一个未知二进制；更改桥接代码或工具后必须重新构建和验证实际产物，再更新接纳表。

## 体积及执行边界

体积按与 vm2api CLI 相同的边界统计：运行时及全部新增专属依赖，既有桥接控制面与系统库单列。当前单文件为 26404920 字节（25.18 MiB），不需要外置 Bun、JS、原版、提取目录、7zz 或新增动态库；沿用系统 libc 与 ELF 加载器。manifest 是可选构建证据，不参与运行。

加载器校验解码载荷 SHA256，写入封存的 memfd 后用 fexecve 在同一 PID 执行，不产生磁盘展开副本。控制层在握手后还通过 `/proc/<pid>/exe` 独立核对执行体。内存文件约 102.25 MiB，加载器解码也有临时内存开销；磁盘减少不代表 RSS 同比例下降。

工作进程固定 LANG=C.UTF-8。裁剪只删除非 root/en 的 ICU locale 定制资源，保留字符、规范化和全部语言分词规则/字典。它是桥接专用运行时，不提供完整通用 CLI 的各语言日期、货币、排序等 Intl 定制保证；已支持的正文和上下文输入没有 locale 参数。默认格式与中/日/泰/阿拉伯文、组合字符和 emoji 的文本分段另有与原版对照证据。

## 使用与原版回退

将 `CCRB_CLAUDE_BINARY` 指向接纳表内的轻量文件；HOME、配置目录、显式凭据、代理、CA 和 cwd 绑定引擎，变更后关闭并重建服务。轻量版使用内嵌入口，原版使用 `dist/preload.mjs`。

控制层和性能脚本默认设置 `CLAUDE_CODE_ENTRYPOINT=cli`，由原生代码生成一致的 User-Agent 入口段与 billing `cc_entrypoint=cli`。主会话、子代理和压缩等请求分类继续按实际上下文生成；入口标识不改变现有结构化适配路径。历史日志保留采样时的标识。

回退时把 `CCRB_CLAUDE_BINARY` 显式切回固定官方原版，再重启服务。轻量部署不要求常备原版副本；启动失败不会自动切换原版、演示或其它版本。

创建服务只校验文件，读取日志和 PID 不会启动 CC。首个模型作业启动进程，完成原生接口/配置及本地构造依赖初始化后握手；本地初始化在隔离根中构造一次参数并在上游发送前中止，不发模型请求、协议请求事件或业务日志，其成本计入总启动时间。正常串行作业复用同一物理进程。最多 16 项执行中及排队请求，每轮新建原生会话根、AbortController 和日志作用域，同一 sessionId 也不复用前一轮账本。

新进程加载时做完整哈希；暖复用只比较真实路径、dev/inode、大小、mtime/ctime。通过已打开的核验 FD 启动，避免校验与路径替换之间执行另一个文件。接收到唯一终态与匹配的 worker_idle 后才完成本轮；取消、异常和协议故障隔离进程，下一轮重建，当前模型请求不重放。关闭服务会取消队列并回收常驻进程。

私有工作进程协议为 schema 2，以 worker_id 和 request_id 分别归属物理进程与作业；控制层解包后沿用 schema 1 日志事件，HTTP API 及捕获阶段语义不变。

## 验证与性能

```bash
bun run build
bun run typecheck
bun run test
bun run test:integration
bun run test:native
CCRB_TEST_CLAUDE_BINARY=/绝对路径/claude-293-compact bun run test:native
bun run test:ui
bun scripts/benchmark-runtime.ts \
  --binary /绝对路径/claude-293-compact \
  --reference /root/project/vm2api/share/wrap-cli/cli-node \
  --output artifacts/runtime-benchmark
```

原生回归验证实际 TLS 请求、CCH、扩展头、metadata、父子/压缩关联、工具/thinking、响应字节、同 PID 多轮及故障恢复。原生与性能验证只使用合成凭据、独立 HOME 和无外网命名空间。

性能脚本交错执行两方各五个新进程，每进程六轮串行作业，使用相同合成输入与本地 SSE 上游。原始样本保存启动至首轮完整返回、就绪后首轮和暖复用耗时，以及 RSS、运行生成文件和请求次数；三项中位耗时均须不超过 vm2api 的 1.10 倍。页缓存未清理，统计边界为 CLI 运行时协议，不是虚拟机启动、完整 HTTP 控制面或真实模型推理速度。任何一项失败均保持任务未完成。

固定产物首次验收使用 `sdk-cli` 入口，五轮配对为：启动至首轮完整完成 **3.360 秒**（vm2api **4.484 秒**），就绪后首轮 **22.156 毫秒**（**148.016 毫秒**），暖复用 **10.947 毫秒**（**21.958 毫秒**）。当时单元、集成、两份原生运行时及浏览器共 **94 项**用例通过。完整身份、原始采样、内存、控制面补充观察和适用边界见 [验收记录](../.trellis/tasks/11-05-runtime-footprint/research/acceptance.md)。

默认入口改为 `cli` 后，以同一配对脚本复验五轮：总启动 **2.440 秒**（vm2api **2.630 秒**）、就绪后首轮 **15.085 毫秒**（**81.428 毫秒**）、暖复用 **7.195 毫秒**（**10.570 毫秒**），三项均通过原定门槛。原版和精简版各 **17 项**原生回归通过，独立 TLS 接收端核对 User-Agent、billing 入口与最终 CCH。该次复验沿用上述离线合成边界，不与不同批次数字直接相减解释性能收益。
