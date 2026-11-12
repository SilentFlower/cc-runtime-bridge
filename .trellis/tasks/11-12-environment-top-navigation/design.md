# 技术设计

## 依赖

在父任务共享基础后实施，提供环境顶层路由与任务独立入口。

## 所有权

Dashboard.vue、router.ts、Environments.vue及webui受控嵌入导航。

## 合同

保持统一会话；路由与iframe状态同步；旧环境链接和筛选参数兼容。

详细边界及参考规格见父任务design.md与research/vm2api-style.md；本子任务只实施自身负责部分。
