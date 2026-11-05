# Backend Development Guidelines

> Best practices for backend development in this project.

---

## Overview

已验证的运行时与日志合同列在下表；其它条目保留为后续整理入口。修改 API、原生适配或日志前先读实际合同及相关类型。

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [原生运行时合同](./runtime-contract.md) | 固定 293、HTTP/JSONL、头部与上下文、单次发送及取消 | 已验证 |
| [Directory Structure](./directory-structure.md) | Module organization and file layout | To fill |
| [Database Guidelines](./database-guidelines.md) | ORM patterns, queries, migrations | To fill |
| [Error Handling](./error-handling.md) | Error types, handling strategies | To fill |
| [Quality Guidelines](./quality-guidelines.md) | Code standards, forbidden patterns | To fill |
| [日志合同](./logging-guidelines.md) | 阶段、脱敏、持久化、容量和故障语义 | 已验证 |

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
