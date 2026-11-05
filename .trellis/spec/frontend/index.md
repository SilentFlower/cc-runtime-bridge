# Frontend Development Guidelines

> Best practices for frontend development in this project.

---

## Overview

当前页面使用原生 HTML/CSS/TypeScript。已验证的页面状态合同见下表；修改日志展示前同时读取 src/shared/contracts.ts 和 src/shared/log-api.ts。

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | To fill |
| [Component Guidelines](./component-guidelines.md) | Component patterns, props, composition | To fill |
| [Hook Guidelines](./hook-guidelines.md) | Custom hooks, data fetching patterns | To fill |
| [页面状态合同](./state-management.md) | 筛选、异步读取、详情、采集状态和安全渲染 | 已验证 |
| [Quality Guidelines](./quality-guidelines.md) | Code standards, forbidden patterns | To fill |
| [Type Safety](./type-safety.md) | Type patterns, validation | To fill |

---

## How to Fill These Guidelines

For each guideline file:

1. Document your project's **actual conventions** (not ideals)
2. Include **code examples** from your codebase
3. List **forbidden patterns** and why
4. Add **common mistakes** your team has made

The goal is to help AI assistants and new team members understand how YOUR project works.

---

**Language**: 项目说明和新增代码注释使用中文。
