# Brief — 环境管理独立顶部导航入口

## Goal

顶部环境直接进入环境列表；任务页保留任务相关功能；既有链接、刷新和前进后退均正确。

## Scope

Dashboard.vue、router.ts、Environments.vue及webui受控嵌入导航。

## Non-Goals

其它子任务的独立交付由其负责。

## Technical Overview

保持统一会话；路由与iframe状态同步；旧环境链接和筛选参数兼容。

## Context & Decisions

本子任务属于父任务已完整展示的范围；沿用父任务冻结 Brief、实际参考和共同约束。

## Acceptance

- 顶部环境直接进入环境列表；任务页保留任务相关功能；既有链接、刷新和前进后退均正确。
- 采用合成数据和离线回归，保护当前工作区其它开发改动。

## Next Step

进入实现路由，完成本子任务交付及对应验证。
