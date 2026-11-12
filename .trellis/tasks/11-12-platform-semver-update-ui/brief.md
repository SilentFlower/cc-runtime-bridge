# Brief — 平台语义版本与更新页交互整理

## Goal

平台版本使用可读语义版本，历史编号可追溯；时间本地化；默认收起版本详情且同时只展开一项。

## Scope

SystemUpdates.vue、平台发行元数据、manage.py、Docker构建与publish_system_release.py。

## Non-Goals

其它子任务的独立交付由其负责。

## Technical Overview

前端构建版本与签名说明同源；原发行身份、旧清单兼容及安装维护合同保留。

## Context & Decisions

本子任务属于父任务已完整展示的范围；沿用父任务冻结 Brief、实际参考和共同约束。

## Acceptance

- 平台版本使用可读语义版本，历史编号可追溯；时间本地化；默认收起版本详情且同时只展开一项。
- 采用合成数据和离线回归，保护当前工作区其它开发改动。

## Next Step

进入实现路由，完成本子任务交付及对应验证。
