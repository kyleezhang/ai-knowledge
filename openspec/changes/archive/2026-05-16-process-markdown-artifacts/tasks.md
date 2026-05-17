## 1. Domain

- [x] 1.1 确认或补齐 Source schema 中 `processing_artifacts` 三件套、`last_error`、`failed` 状态校验规则。
- [x] 1.2 确认 Source 状态机支持 `ingested -> processing -> processed` 与 `processing -> failed`，并拒绝非 `ingested` 的普通 processing 请求。
- [x] 1.3 增加或更新 domain tests，覆盖 processed 状态必须存在 `clean_text`、`segments`、`metadata` artifact 路径，以及 failed 状态必须存在 `last_error`。

## 2. Storage

- [x] 2.1 补齐 artifact store 读取 `raw/original.md` 的能力，路径必须通过 storage helper 解析。
- [x] 2.2 补齐 artifact store 写入 `processed/clean_text.md`、`processed/segments.json`、`processed/metadata.json` 的能力，并返回相对 Source 目录路径。
- [x] 2.3 增加 storage tests，覆盖 artifact 相对路径、path traversal 拒绝、JSON artifact 格式和 raw 文件不被改写。

## 3. Processing

- [x] 3.1 实现 Markdown processor，将 `raw/original.md` 转为 `clean_text`、`segments`、`metadata` 三类候选输出。
- [x] 3.2 为 `segments.json` 定义最小稳定结构，包含 segment id、顺序、标题路径和文本内容。
- [x] 3.3 为 `metadata.json` 输出可确定的 Markdown metadata，例如标题、heading 列表、链接列表、segment 数量和处理时间。
- [x] 3.4 增加 processor tests，覆盖无标题 Markdown、多级标题、链接保留、空白清洗和 segment 顺序稳定性。

## 4. Workflow

- [x] 4.1 实现或完善 `process_source_workflow`：加载 Source、校验 `ingested` 前置状态、transition 到 `processing` 并保存。
- [x] 4.2 在 workflow 中读取 `raw/original.md`、调用 Markdown processor、写入 processed artifacts、更新 `source.processing_artifacts`。
- [x] 4.3 在成功路径中清除 `last_error`，通过状态机 transition 到 `processed`，保存 Source，并返回 `ai-knowledge source understand <source_id>` next action。
- [x] 4.4 在失败路径中尽量 transition 到 `failed`，写入 `last_error.stage = processing`、错误消息和 `occurred_at`。
- [x] 4.5 增加 workflow tests，覆盖成功流转、非 `ingested` 状态拒绝、raw 缺失失败、processor 失败和 artifact 写入失败。

## 5. CLI

- [x] 5.1 增加 `ai-knowledge source process <source_id>` 命令，CLI 只解析参数、调用 workflow 并展示结果。
- [x] 5.2 增加人类可读输出，成功时显示 Source id、status、artifact 路径和 next action。
- [x] 5.3 增加 `--json` 输出，返回 workflow result 中的 Source 摘要、artifact 路径和 next action。
- [x] 5.4 增加 CLI smoke tests，覆盖成功输出、`--json` 输出和状态不匹配错误展示。

## 6. Verification

- [x] 6.1 运行 OpenSpec 校验，确认 `process-markdown-artifacts` artifacts 和 delta spec 有效。
- [x] 6.2 运行 TypeScript typecheck。
- [x] 6.3 运行 Vitest 测试套件。
- [x] 6.4 运行 ESLint 和 Prettier 检查。
- [x] 6.5 手动从已 ingest 的 Markdown Source 运行 `ai-knowledge source process <source_id>`，确认三件套落盘、Source 状态为 `processed`，并显示 next action。
