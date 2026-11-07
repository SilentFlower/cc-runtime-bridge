# 实施验收证据

## 行为结果

- 自动权限分类第一阶段及第二阶段均记录为 auxiliary / auto_mode，分类用途和固定版本识别来源可见；动态 deny rules 不造成误归主会话。
- 子代理详情可从同会话、匹配的 Agent 启动历史关联父代理及 Explore 类型，显示证据。原始 context 和捕获快照保持；未知、冲突、不完整分别展示。
- 只读关联不执行工具、不补发请求；summary、off、旧记录、重启、证据清理、同会话多代理、嵌套父子、跨会话同 ID、重复历史与查询/提取上限均有定向验证。

## 实际命令与覆盖

| 验证 | 结果 |
| --- | --- |
| bun run typecheck / bun run build | 通过 |
| bun test tests/unit | 130 项通过 |
| bun run test:native | 56 项通过，原生正文、头、CCH、六类上下文及故障收口保持 |
| bun run test:integration | 28 项通过，含真实客户端本地池、存储与 Node 传输故障矩阵 |
| bun run test:ui | 7 项通过，含新关联/来源/未知/刷新、证据跳转、旧记录和 390 像素布局 |
| env 白名单 + unshare --net + bun test tests/local-pool/attribution.test.ts | 最终 202 条断言通过，三组实际 CLI：默认、deny rules、两阶段分类复核 |
| bun test tests/unit/request-attribution.test.ts tests/unit/log-api.test.ts tests/integration/storage.test.ts | 最终边界调整后 15 项、81 条断言通过 |

完整集成之后新增的第二阶段识别、证据容器字节上限及解码一致性，以对应的实际 CLI 和 15 项定向验证补齐；无关已通过场景不重复计数或冒充新验证。

## 可核对产物

- artifacts/cli-attribution-proof.json：最终三组实际 CLI 共 20 次模拟模型 POST，8 条分类调用、3 条子代理调用，全部业务正文与 TLS 实收 SHA/CCH 核对；每个请求只发送一次，报告实际回传成功。真实模型调用为 0。
- artifacts/attribution-desktop.png、artifacts/attribution-mobile.png：来源、有效关联与发生时上下文的页面证据。
- artifacts/cli-attribution-stage2-probe/：第二阶段只读研究与离线实收。未修改官方二进制或真实池设置。
- artifacts/cli-attribution-service-current.json：8787 更新后的健康与页面确认。新运行 manual-attribution-fix-20261107T020504393016Z，PID37885；旧账本保持，启动和读取零模型调用，受保护配置哈希保持。
- 首个失败回归明确记录 main != auxiliary，后续通过；中途另修正测试对脱敏预览的比较方式，最终使用入站内存原文与原始 SHA 关联后比较业务字段。

## 边界

- 当前识别固定 293 已验证 XML 分类构造；未验证格式明确未识别，不改变模型业务参数或拒绝原本可转发请求。
- 从未提供、已过期或缺少可靠证据的关系仍为未知；不承诺完整恢复代理树。
- 旧日志不回填，原始 UND_ERR_SOCKET 根因仍由原任务继续跟踪。
