# 技术设计

## 依赖

依赖父任务共享基础和环境顶层路由，负责请求记录、详情与账号采集开关。

## 所有权

RequestDiagnostics.vue、NativeStageDetails.vue、api.ts、环境卡片与采集维护后端及管理桥精确路径。

## 合同

使用冻结采集状态；关闭零文件读取；新增采集控制按空闲、归属与版本校验生效；错误与迟到回执保持明确。

详细边界及参考规格见父任务design.md与research/vm2api-style.md；本子任务只实施自身负责部分。
