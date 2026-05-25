## Why

P1 已经允许用户导入 PDF Source，但处理链路需要把 `raw/original.pdf` 稳定转换为后续 `understand` 可消费的标准 `processed` artifacts。现在补齐这个小闭环，可以让 PDF 主动学习路径复用既有 Source 状态机、artifact 索引和后续讨论/笔记门槛。

## What Changes

- 为 `ai-knowledge source process <source_id>` 增加 PDF Source 分支，读取 `raw/original.pdf`。
- PDF 处理成功后写入标准三件套：`processed/clean_text.md`、`processed/segments.json`、`processed/metadata.json`。
- `source.processing_artifacts` 继续只登记相对 Source 目录的 `clean_text`、`segments`、`metadata` 路径。
- 处理流程继续使用 Source state machine：`ingested -> processing -> processed`，失败进入 `failed` 并记录 `last_error.stage = processing`。
- 保持 raw PDF 不被重写或删除；PDF 提取结果只作为处理阶段 artifact，不直接生成 Note。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `source-processing`: 明确 PDF Source 的 processed artifact 内容、失败语义和 CLI 处理路径，作为 P1 手动 PDF 导入后的处理闭环。

## Impact

- Scope：P1。
- Affected layers：domain、storage、processing、workflows、CLI、tests。
- 可能新增 PDF 正文抽取依赖，但不得引入数据库、Web UI、自动采集、URL crawling 或向量检索。
- 不改变 `Note` 生成门槛：仍然必须先有 processed artifacts、draft understanding、多轮讨论收敛和用户显式确认。
