# 本地 Claude Code 常驻池联调设计

## 架构与数据流

1. 新增 scripts/local-pool.ts，复用 startServer、BridgeService、RequestTrace、LogStore 与现有前端，宿主只监听回环 HTTP。
2. 仅此实例开启 Base URL 入站兼容，将控制层确定的策略沿 PreparedInput 传入，客户端正文/头不能自行授权。
3. 新增符合现有 Engine 接口的隔离代理引擎，经私有通道将 PreparedInput 交给仅 lo 网络空间内的驱动；驱动复用 createEngine，返回经共享解码器验证的 RuntimeEvent，保持串行、取消退役、单次发送。
4. 复用 pool-driver 的 CONNECT 隔离：只接受 api.anthropic.com:443，接入 0600 Unix socket，不解析真实目标。复用 pool-forwarder 的 Node TLS 实收、rawHeaders 自检、原生 CCH 独立核验与池映射。
5. 宿主核对活动 request_id、唯一 TLS 采集和非零正确 CCH 后允许第二段。池仅改目标、根 model、鉴权及必要传输字段，JSON/SSE 逻辑字节按原背压路径返回，取消传到池，不重放。
6. TLS 实收样本交给同请求 RequestTrace 的 wire_final，池映射另作说明，不把池客户端参数称为池端实收。

## 合同调整

### 入站策略

- 新增严格默认/本地 Base URL 兼容两种启动策略，由 parseInput、readNativeInput、PreparedInput 传递及私有解码器共同验证；外部请求不能启用，非法私有枚举拒绝。
- 兼容分支只允许固定 293、cli/sdk-cli，CCH 可以省略，出现时必须唯一且为五位十六进制。其他 billing、metadata、工具、归因及本机控制字段规则继续生效。
- prepareNativeBody 在兼容分支读取同次 SDK 实际生成的 CLI billing 上下文，保留业务/扩展并准备实际入口和 CCH 占位，由原生传输完成最终值。默认严格分支不变，不能仅替换 sdk-cli 日志标签。

### 手工预算

- PoolConfig 显式区分有限验收/手工联调，live 继续表示是否访问真实外部池，不能用 live=false 绕过限制。
- 旧模式保持三次/128 tokens 和首错停止。手工模式最多 20 次、max_tokens 上限 32768、池超时 30 秒；单次错误后可接收后续新入站，失败尝试同样消耗预算，客户端重试计为新入站。
- 手工使用独立运行 ID/账本，发送前预留，同 ID 排他、不覆盖、不自动续轮。控制层和 Node 双重检查；耗尽返回本地错误，未收池响应头时 upstreamStatus=null。
- 沿用保护文件地址/Key 读取规则，只取两项，固定 deepseek-flash。仅 Node 池端继承经过校验的宿主代理白名单，池 Key 不放进原生引擎配置。

### 采集与秘密

- startServer 增加向后兼容的启动侧选项：入站策略、额外已知秘密、最终采集提供者，默认为空，HTTP 不可注入。
- 提供者按 request_id 返回 TLS 原始正文、HeaderPair、HTTP 版本、时间和校验结果，取出即清理；非活动或重复帧拒绝，不能串入下一请求。
- RequestTrace 增加受控最终采集入口，提前注册池 Key/合成 token，再按现有模式脱敏/截断，长度和 SHA256 保持实收值；采集失败单独标 failed/unavailable 和 captureError，不阻断响应、不重试、不用中间值补写。
- 只有自检完成的本地实例启用 nativeFinalCapture，普通实例仍为 false；私有 stdout/stderr 不作为原文日志保存。

## 生命周期、风险与回退

- 本地模式使用现有固定原版 293 与当前 dist/preload.mjs，不复制或修改二进制；现有轻量文件内嵌旧私有入口，未经重建验证不用于此模式。启动前校验固定身份；独立受保护运行目录保存证书、HOME/config、日志与账本。启动只做离线自检，资源就绪才开放 API。
- 关闭停止接收、取消活动请求、关闭驱动/Node、清理本次临时私钥/socket，保留日志和预算。失败只清理本次资源，8791 历史报告保留。
- 提供 Bash/PowerShell 临时 ANTHROPIC_BASE_URL、合成 ANTHROPIC_AUTH_TOKEN 和模型用法，不修改永久配置及系统证书。
- 交互 CLI/工具续轮兼容、异步采集归属、取消收口及响应回显凭据是重点离线回归点。池不兼容字段保留并显示真实失败。
- 回退为停止手工模式，继续原默认启动；不迁移历史数据、不修改固定二进制与验收规则。
