# 产品验收记录

## 范围和身份

- 固定官方 CC 2.1.293，SHA256 `8968405e26db478af44eabc4635ab5ca557057b702a54460a59c13e1b253e978`。
- 独立辅助程序 `ccrb-tls-verifier`，Linux x64，release 3816568 B，SHA256 `f41c1aff4c4836767790a67cab57370446a7610cb7ec79ae9d7c44e5ec02fb01`。
- 编译器 rustc 1.96.0 (ac68faa20 2026-05-25)，Cargo.lock、97 个第三方快照文件及四份原许可固定；快照逐文件校验无差异。构建、来源及二进制清单在忽略的 dist/tls-verifier.manifest.json。
- 默认 off；测试均使用独立回环网络、专用 HOME/config 和合成凭据，真实模型调用为 0。未操作现有 8787 服务或受保护凭据文件。

## AC 对照

| 验收 | 实现和证据 | 结果 |
| --- | --- | --- |
| AC1 | 原生/API 输入 × 四种端点/模型组合 × off/verify；另有 HTTP 直连和显式代理 | 通过 |
| AC2 | off 无额外辅助进程或模型调用；原生 CCH 存在/省略由实际 CC 决定 | 通过 |
| AC3 | 实际最后 TLS 写出实体和整体 HTTP 哈希与独立 OpenSSL 实收核对；部分写出、进程退出及截断区分 | 通过；CHK-002 修复并重检通过 |
| AC4 | TLS1.2/1.3、HRR 两次握手的全部公开字段、实际连接复用/关闭/无恢复基线、有序头；错误证书严格拒绝；ML-KEM+X25519 真正封装/解封及低阶输入拒绝 | 通过 |
| AC5 | JSON/SSE、36 秒健康流及慢消费、取消/重建、HTTP/SSE 错误、3xx 不跟随、正文中途断开，无模型重试 | 通过 |
| AC6 | 两个实际原版 CLI 并发，每个三个子代理；28 条请求跨实例模型、凭据、session、agent、连接归属；错误 PID 持有效代理凭据仍被拒绝且不污染作业 | 通过 |
| AC7 | 状态、来源、预览/整体哈希、旧记录和只读页面、新构建身份及回退说明 | 通过；CHK-001、CHK-002 修复并重检通过 |

专项完整证据：`artifacts/tls-verifier-final/report.json`，26 项通过、833 个断言，实际假上游收到 89 条请求、54 条 ClientHello；真实模型调用为 0。它包含独立服务端证据而非仅将画像对自身比较。

## 已执行验证

- `bun test tests/unit --timeout 45000`：158 通过，844 个断言。
- `bun run typecheck`、`bun run build`：通过。
- Cargo fmt、clippy -D warnings、locked 构建：通过。Cargo test：6 项通过，含真实混合交换及写入失败只计成功前缀。
- `bun run test:native`：56 通过，2445 个断言；TLS 专项使用独立 test:tls 入口。
- `bun run test:ui`：旧 7 项通过；新增模型/写出来源/验证器失败只读场景另跑 1 项通过。
- 最后写出预览在秘密中途截断的持久化集成：通过，原始哈希和整体字节数保留，边界不留下部分凭据。
- 首次集成整体 42 通过、1 失败：旧池不限次数场景初始化在 forwarder_start 返回 UNKNOWN，没有池业务请求；原始失败保存在 artifacts/tls-verifier-old-pool-initial-failure.json。该场景单独重跑通过（55 个断言），随后完整集成重跑 43 项全部通过（277 个断言，228.11 秒），含旧池 26 MiB、66 秒请求及双实际终端隔离；不据此臆测初次 UNKNOWN 的根因。

## 保留的失败和支持边界

- 首轮专项夹具使用重复未知扩展头，被原有无损策略按合同拒绝；改为实际可合并的 Accept-Language 后继续，不放宽策略。
- 初次普通 API 大消息在原版构造阶段失败，cc_prepared/wire_final 均未取得；完整原生输入的 2/8 MiB 转发与采集通过，二者不混作同一测试结果。
- 实际 CLI 最初未启动子代理，因为假分类器返回了无效文本；保持正常权限流程，修正合成分类响应为原版要求格式后，两个真实客户端各启动三个子代理。失败报告保留于 artifacts/tls-verifier-dual-debug/。
- 指纹范围不包含随机密钥和绝对时延，不承诺所有服务器兼容。verify 的 TLS 实现与官方不同；最后本地写出不证明上游执行。仅支持已声明的 HTTPS/HTTP1.1、关闭遥测、直连/HTTP CONNECT 组合。
- 不自动生成新的官方或精简 CC 文件，不修改旧文件授信哈希。辅助程序新哈希需独立验收，构建不会自动授信。

## 补充传输核对

- 初版中继 CONNECT 缺少原版的 Proxy-Connection: Keep-Alive，实际对照失败证据保存在 artifacts/tls-verifier-connect-baseline/report.json；随后改为原字节沿用 CONNECT，仅选择冻结的上游代理凭据。
- 当前 f41c1aff 产物的受影响定向矩阵 11 项通过，510 个断言，涵盖 TLS1.2/1.3/HRR、连接、2/8 MiB、双实际客户端、部分写出、PID 归属及认证代理；证据为 artifacts/tls-verifier-connect-aligned/report.json。先前 26 项矩阵的其余链路实现未变化，保留原始证据，不把该报告的旧产物哈希改成新哈希。
- 实际 HTTPS IP 直连和 Latin-1 头补充检查均通过；IP 直连两份完整公开 ClientHello 相同、零 CONNECT，证据在 artifacts/tls-verifier-audit/ip-report.json；非 ASCII 字段不以猜测编码替代实测。

## Check-All 补查未通过（修复前记录）

- CHK-001：实际原版离线请求的用户正文含 `__ccrb_cch_observation_slot__` 时，off 返回 200，verify 返回 502。原因可定位为 src/shared/tls-verifier-protocol.ts:98 的固定哨兵冲突拒绝；证据 artifacts/tls-verifier-audit/report.json。合法业务文本不应成为验证器的禁用值。
- CHK-002：原生 billing 的 `cch=12345 \t;` 已由现有解析合同接纳并保留，但新槽位正则只接受五位之后紧跟分号或末尾空白。实际原版请求两模式均返回 200，verify 的 wire_final 却为 failed/integrity_mismatch；证据 artifacts/tls-verifier-audit/spacing-report.json。
- 上述为修复前报告；用户已确认两项修复，处理和重检见下节。

## CHK-001、CHK-002 修复与重检

- 原因：CCH 定位将固定哨兵误作业务禁用值，且字段匹配没有覆盖现有 billing 合同接受的空白及首字段位置。
- 修复：只在已解析的观测副本中改变一个已知 ASCII 字符，以序列化首个差异的 UTF-8 偏移定位槽位；实际发送文本、billing、身份和头部均不变。不再保留特殊业务字符串，也不改写 CCH 生成。
- `bun test tests/unit/tls-verifier.test.ts tests/unit/native-input.test.ts`：23 项通过、155 个断言；覆盖消息和工具中的同名文本、根字段次序、Unicode/JSON 转义和合法空白。
- `CCRB_TLS_REPORT=artifacts/tls-verifier-repairs/report.json bun run test:tls -t 'CHK-001/CHK-002'`：7 项通过、154 个断言，实际原版共 14 次离线请求。普通 API 的标记字面量、空格/制表符、billing 前导空白、CCH 首/末字段、Unicode/转义前缀以及无 CCH 分支均成功；每个入站仅一次发送，最后写出整体 HTTP 哈希与独立上游一致，captureError 均为空。
- `CCRB_TLS_REPORT=artifacts/tls-verifier-repair-regression/report.json bun run test:tls -t '大正文|两个实际'`：3 项通过、249 个断言，2/8 MiB 整体哈希及两个实际客户端各三个子代理继续正确。
- `bun run typecheck`、专项入口中的 build 与 locked 辅助程序构建通过；辅助程序哈希仍为 f41c1aff4c4836767790a67cab57370446a7610cb7ec79ae9d7c44e5ec02fb01。
- 定向重检复用前轮 full 证据，局部 light 检查覆盖原问题、定位函数、私有协议消费者与日志完整性：CHK-001、CHK-002 均已修复，无剩余 CHK/FBK。尚未执行 Git 提交或推送。
