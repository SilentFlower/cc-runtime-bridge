# 固定 293 的 CLI 装配边界

## 来源与共用入口

固定官方 2.1.293，SHA256 为 8968405e26db478af44eabc4635ab5ca557057b702a54460a59c13e1b253e978，Bun 1.4.3/revision eecfd55debb281c3fe3518098b1a49f76429637c。模块和导出集中在 src/runtime/293/source-profile.ts 的 PROFILE_293.modules 与 NATIVE_EXPORTS_293；preload 和静态编译器消费同一映射，worker 在初始化时逐项核验接口形状。

正式装配代码为 src/runtime/293/cli.ts，类型投影见 native.ts。下表记录本任务实际读取定义并在隔离环境调用过的接口；不是适用于其它版本的符号表。

| 边界 | 固定导出 | 用途与生命周期 |
| --- | --- | --- |
| CLI 初始化 | state.vwo/REr、context.Nst | 选择交互和 markdown 问题预览，完成固定账号本地配置初始化 |
| 显式密钥的本地确认 | context.Lle/Iyr/Ae/VH | 只确认控制配置已经提供的密钥标识；保留拒绝列表，不登录、不刷新、不写完整密钥 |
| 内置定义 | cliSkills.Hoe/$8e | 注册实际内置扩展与技能，进程初始化一次 |
| 默认模型与来源 | state.bf、cliSource.u1e | 每轮绑定模型；主来源须与解析上下文一致，不能静默改变来源后缀 |
| 权限 | cliPermissions.XUr/JUr/dmn/B1e | 每轮独立计算，统一禁用原生基础池，权限仍由官方逻辑处理 |
| 代理与命令 | core._R/_p | 从实际专用 cwd/config 读取定义，不能跨作业保留可变结果 |
| 工具目录与声明 | cliTools.Bq/OD、cliToolPool.$0t/F0t | Bq 保留为权限及目录接口；OD/池选择保留固定绑定，prepareCli 不进入该缺省选择路径。省略 tools 与 [] 均无工具；仅调用方 schema 经 extraToolSchemas 输入 |
| 状态 | cliState.yF、cliStore.rs、cliLenses.f9e、cliTasks.rg、cliToolState.jM、cliFiles.Uk/dC | 在新原生根内创建并绑定本轮状态、任务、工具和文件读取视图 |
| 业务消息 | core.Re/Kc/Fyn | 保留历史内容，实际人类主输入采用 human；纯 tool_result 不伪装为新的人类轮次 |
| 提醒与提示词 | core.pie/VA/Kz/LT/Uz、cliQuery.OM | 初始附件、默认正文、显式替换、环境和日期归因均由原生生成 |
| 唯一发送 | core.K_t 的 fetchOverride、api.Ree | 业务保留校验后，复用同一 SDK 的发送上下文；不再创建第二个客户端 |

## 单轮与失败边界

worker 每轮以 nEr 创建全新根，AsyncLocalStorage/yLs 绑定后执行 t_。本地初始化根只构造、不发送，全部成本计入 ready 前。跨作业保留官方 host 自身拥有的缓存、静态绑定及已验证的纯工厂字符串，不共享业务根、权限选择、完整装配结果、账本或取消状态。

OM 只允许进入一次 deps.callModel。K_t 提供的实际业务消息与已知原生提醒分别核验；tools（包括省略时的空列表）、thinking、max_tokens、temperature、tool_choice、output_config 无法保留时，在实际发送前拒绝。没有把全部 system-reminder 作为可忽略差异。

send 回调保留原 SDK 的上下文和原生凭据头，合并合法扩展头，只在 stream 确实变化时重新序列化。cc_prepared 的正文、长度和 SHA 在 Ree 前固定；采集写出与唯一发送并行，两方均成功后才交付响应事件。失败时取消原生调用，等待收口并释放未交付响应。SDK 始终拿不到原始 Response，不能解析、重试或进入工具循环。

runQuery/canUseTool 明确拒绝本地执行，自动压缩关闭；收到 Bash 等 tool_use 仍原样交给调用方。显式 compaction 保留类别。子代理采用实际可用原生定义；未知命名类型且未提供 system 时拒绝，不伪造定义。未指定类型的非主调用只证明已公开的结构化分类与关联，不宣称复刻自动创建终端子代理的全流程。

## 可复核结果

原版与当前显式工具产物分别通过 28 项原生用例、429 个断言，每方 40 份实际 TLS 正文独立核验 CCH，全部 40 份另作两份入口的逐字段比较。五个主输入与三种匹配的 PTY 配置完成完整字段对照：省略及 [] 共用禁用工具参考，业务 system、空文本及空数组 system 也在禁用工具条件下比较。

仅归一化已逐项验证的 session/prompt/request UUID 与关联、已独立核验的 CCH、与正文长度相符的 Content-Length、专用 cwd，以及与 cwd 编码一致的 config/projects 路径。没有删去工具、静态 system、模型默认值、功能标志或原生提醒差异。

当前证据在被忽略的 artifacts/cli-alignment-20261105T064401Z/explicit-tools/，其中 bridge-original/ 与 bridge-compact/ 分别为两份入口，final-tls-explicit-tools/ 为独立 Node 最终采样；旧 static/ 和 repairs/ 保留为历史。源码、完整提示词和二进制不提交。接收端另以原始 TLS 探针核验头名大小写、顺序及重复项；生产自动 wire_final 能力仍未实现。六个纯正文工厂的编译复用不改变本节调用边界，具体依赖见 static-text-reuse.md。体积与计时见当前验收记录，不能由本节行为通过推导旧相对速度规则也通过。
