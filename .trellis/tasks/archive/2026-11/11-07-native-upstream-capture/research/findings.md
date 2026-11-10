# 研究结论

## 固定参考

- 原版 CC：2.1.293，SHA256 `8968405e26db478af44eabc4635ab5ca557057b702a54460a59c13e1b253e978`。
- 本地 cc2api：`/root/project/vibecoding-bench/cc2api`，HEAD `47e75ef4a1e982e2693edab81d5387eedb6adf40`，只读参考。
- `src/tlsfp/profile.rs` 注册 `claude-code-2.1.293`；`src/tlsfp/tlsfp.rs:149` 开始定义固定 293 的 cipher/扩展画像，不能只依据 README 的“模拟 Node.js”概括实际代码。
- 独立参考夹具：`tests/fixtures/claude_code_293_tls.json`、`tls_clienthello.py`、`tls_fingerprint_server.py`。覆盖有序公开字段、TLS 版本、HRR、恢复及证书校验；不是 UA 或版本字符串校验。

## 现有合同与适配点

- `EngineConfig` 没有 Base URL；引擎环境白名单也不继承宿主 `ANTHROPIC_BASE_URL`。应新增显式传递，不通过修改 Ree 的目标实现普通上游选择。
- 模型在请求正文中已存在；模型覆盖应在前置解析后、内部构造前应用，只修改根字段，并保留原始入站及选择依据。
- 当前 `prepareNativeBody` 的 `local_base_url` 表示入站兼容，不等于内部出站目标自定义。两者需要分离，生成上下文也必须按实际原生分支验证。
- 官方二进制内 billing 函数 `Kso`（偏移 208068764）只有 `(provider === firstParty && pi()) || provider === vertex` 时加入 CCH 占位。普通 `pi()` 在没有内部强制开关时检查未设置 Base URL 或 URL.host 等于 `api.anthropic.com`。未插入占位时后续传输不会凭空补造字段。
- `FinalCaptureSample` 当前没有来源字段，`RequestTrace.finalCapture` 硬编码旧池来源；新能力必须明确区分历史池样本和新验证接收端，不冒充上游实收。
- 现有 Node TLS 接收端仅支持 HTTP/1.1，第二段为 Node fetch，并强制 Connection: close。普通配置迁移不能把该链路直接称为原生对齐。

## 已完成的离线实验

### 原生启动配置

`artifacts/native-upstream-config-20261107T091635322996Z/report.json`：设置原生 Base URL、原生凭据和前置模型，HTTP/HTTPS × 保留/指定模型四例通过。没有 Ree 覆盖、TLS 中间转发或 Node 二次发送；自定义目标均原生省略 CCH。真实模型调用 0。

### 两段原版发送器，保留失败证据

第一轮：`artifacts/native-capture-transport-20261107T093636048825Z/report.json`。三个合成请求，两段均导入固定原版 `api.Ree`，完整公开 ClientHello、正文及连续请求连接复用通过；有序头失败。原因是把接收端已经由原生追加的 Host、Connection、Accept-Encoding 等再次作为显式 fetch 输入，第二次序列化改变了头部排列。

第二轮：`artifacts/native-capture-transport-20261107T093811856520Z/report.json`。第二段改为使用同次原始发送前输入头，正文使用实际接收实体；原生传输自行生成默认头。七项全部通过：三次 200、每次唯一上游发送、完整公开 ClientHello 相同、正文逐字节相同、有序头相同、两段各自连续复用一个连接。

- 两段 JA3 均为 `1523504b38f0fae0d881d4b6554aac1b`，并与独立 293 夹具完整比对通过。
- 均在仅 lo 的新网络命名空间，新的 HOME/专用配置、合成凭据、自签回环证书；没有真实模型调用。
- 实验仅证明原版传输复用的可行性，尚未实现产品验证模式；完整 SDK 构造、恢复、HRR、长流、取消与并发仍是实现验收项。
- 不直接复制接收端 rawHeaders 作为二次 fetch 输入，也不把发送前头直接写成“最终头”。同次输入头只用于让相同原生发送器再现序列化，实收记录仍来自验证端。

## 原先方案的结论

双原版发送器保留为已验证的研究路径，但只有第一跳样本，不满足逐请求最后一跳采集要求，不能直接进入产品实现。

## 最后一跳接口实验（2026-11-07）

所有实验仅在新网络命名空间的 lo 接口进行，使用合成凭据及假上游；原始正文/密钥只保留在忽略的私有 artifacts 目录。

- `artifacts/native-final-output-20261107T095350935466Z/report.json`：原生 curl 诊断在单次请求中已包含最终非零 CCH，头/正文与同次独立实收完全一致。SSLKEYLOGFILE/NODE_OPTIONS/BUN_OPTIONS 密钥开关均未覆盖原生 Ree；同二进制 Node TLS 对照导出 938 字节密钥日志，说明开关有效但传输范围不同。
- `artifacts/native-final-matrix-20261107T095638952781Z/report.json`：TLS1.2/1.3、HRR 的公开字段、HTTP 和连接行为在启用诊断前后相同，但复用连接三请求只出现一次完整 curl；普通 shell 分词也无法正确恢复含引号的合法头。
- `artifacts/native-final-warm-20261107T095919416361Z/report.json`：全局 verbose 不解决复用缺口。自定义诊断解析可恢复特殊字符；管道下 2/8 MiB 样本不完整。
- `artifacts/native-final-file-20261107T100144315035Z/report.json`：常规文件输出完整保留 2/8 MiB，说明大正文问题与诊断管道有关；但复用连接仍只有第一条完整请求，诊断路径不能作为可靠逐请求最终采集接口。
- `artifacts/native-tls-profile-20261107T100428112773Z/comparison.json`：同二进制 Node TLS 即使调整 cipher、ALPN、requestOCSP，仍缺少原生的 5/18 扩展；不能把 Node 兼容 TLS 直接冒充原生画像。
- 固定二进制的 Node 调试兼容源中，Network.enable 是空应答；FetchSession 原型只公开 close/fetch/constructor，未发现已验证的最终输出回调。以上不证明所有未公开机制绝对不可能，只证明本轮已验证接口不足。

## 可控 TLS 原字节实验

- 首次 `artifacts/controlled-tls-output-20261107T100954257701Z/report.json` 保留失败：夹具将 CA 用作服务端叶证书，rustls 以 CaUsedAsEndEntity 拒绝。未降低验证标准；改用正常 CA+叶证书链。
- `artifacts/controlled-tls-output-20261107T101312790142Z/report.json`：TLS1.3、TLS1.2、HRR、2 MiB 四组全部通过。每组先用固定原版 Ree 取得实际 HTTP 原字节，再经固定画像 TLS 通道逐字节写出；最后写出文件与独立 TLS 接收端整个 HTTP 请求完全相同，包括请求行、有序头、正文和原生 CCH。
- 两个实现的完整公开 ClientHello 在上述场景相同，JA3 为 1523504b38f0fae0d881d4b6554aac1b；HRR 同时比较两次实际 ClientHello，不只比较初始摘要。
- `independent-cch.json` 独立复核 8 条正文全部通过。没有 JS 最终 CCH 生成或业务重组。
- `provenance.json` 记录参考源码、已编译依赖、rustc 和原型二进制哈希。研究临时借用只读 cc2api 已编译库；生产必须独立固定源码与依赖，不能直接交付依赖本机目录/缓存的原型。
- 当前原型只验证单连接写出能力与握手，不代表透明中继、复用、重连/恢复、长流、取消、并发或所有服务器兼容已完成。

## 当前实现建议

正常模式保留原版直连；验证模式加入独立、可控的 TLS 原字节转发器，采用已登记 293 画像，在最后写出通道采集。验证模式的 TLS 实现不同于原版，需要新增小型辅助程序及完整回归；不能再沿用“全链路都是原版发送器”的说法。业务、身份和 CCH 仍由原版生成，验证器不重新创建 HTTP 请求。
