## Why

当前主索引以关键词和元数据检索为主，能够支撑 P0 问答，但无法表达语义相近但措辞不同的知识关系。为了进入 P3 向量检索，需要先明确向量索引对象、embedding 生成边界、持久化契约与失败语义，避免后续实现把 `note.json`、`note.md`、索引条目和模型输出边界混在一起。

本变更属于 **P3 scope**：只为已批准 Note 增加向量索引契约与 embedding 生成流程，不改变 P0 的关键词 / 元数据检索默认行为。

## What Changes

- 增加向量索引契约：定义 approved `Note` 如何被切分为可嵌入文本块、如何生成 embedding、如何落盘为向量索引条目。
- 明确 embedding 生成只读取已批准 Note 的规范化内容；不得从 raw Source、`draft_understanding`、discussion 中直接生成主向量索引。
- 明确向量索引是检索派生物，不是知识真相；`note.json` 仍是正式知识 source of truth，`note.md` 仍是阅读视图。
- 扩展现有 note indexing 行为：主索引入口继续只接受 `approved` Note，并在 P3 可同时维护关键词索引与向量索引。
- 增加可验证的失败语义：embedding provider 失败、维度不匹配、Note 非 approved、Note 被 archived / superseded 时，向量索引不得静默产生可检索条目。
- Non-goals：不新增 PDF、自动采集、Web UI、数据库替换、本地向量数据库服务，也不让 P0 answer 默认依赖向量检索。

## Capabilities

### New Capabilities
- `vector-indexing`: 定义 approved Note 的向量索引条目、embedding 生成、持久化、重建和失效规则。

### Modified Capabilities
- `note-indexing`: 扩展现有 Note 索引需求，使 `approved` Note 在 P3 可生成向量索引派生物，同时保持 draft、archived、superseded Note 不进入主索引。

## Impact

- Affected layers: domain, storage, agents, workflows, CLI, tests。
- Domain: 新增 vector index / embedding 相关类型、Zod schema、维度校验与状态约束。
- Storage: 在 `knowledge/index/` 下增加向量索引派生文件的路径和读写 helper，不手写路径。
- Agents: 增加 embedding provider wrapper；agents 只负责调用模型，不写文件、不改状态。
- Workflows: 在 Note 索引工作流中组合 chunking、embedding、验证、落盘与失败处理。
- CLI: 扩展或新增索引命令用于触发 P3 向量索引构建 / 重建，但不改变 P0 问答默认路径。
- Tests: 覆盖 schema 校验、approved gate、维度不匹配、provider 失败、archived / superseded 失效、workflow mocked embedding。