## 1. Domain 与 storage schema

- [x] 1.1 在 processed segment Zod schema 中新增 `locator` 结构，保留 `id`、`order`、`heading_path`、`text` 现有字段语义。
- [x] 1.2 增加 evidence locator 格式校验工具，统一识别 `processed/segments.json#<segment_id>` 并拒绝 raw path 与 artifact-level refs。
- [x] 1.3 更新 processed artifacts 读写类型，确保 `processed/segments.json` 写入与读取时校验 locator metadata。

## 2. Processing locator 生成

- [x] 2.1 更新 Markdown processor，为每个 segment 生成 `locator.ref`、`locator.source_kind`、正文顺序与 heading path 定位信息。
- [x] 2.2 更新 PDF processor，为每个 segment 生成 `locator.ref`、`locator.source_kind`、页码或等价页内 processed 位置。
- [x] 2.3 更新 URL processor，为每个 segment 生成 `locator.ref`、`locator.source_kind`、heading path、section 或等价正文位置。
- [x] 2.4 更新 processor 单元测试，覆盖 Markdown/PDF/URL 的统一 segment locator 输出。

## 3. Note compose 与 lint 校验

- [x] 3.1 更新 note compose 的 `source_refs` 构造逻辑，从 `processed/segments.json` 的 segment locator 生成 allowed evidence refs。
- [x] 3.2 更新 Note Agent 输入约束或 prompt 内容，使模型只能选择 workflow 提供的 processed segment locators。
- [x] 3.3 在 note compose workflow 中校验 Note candidate 的 `source_refs[].evidence_refs` 必须属于 allowed evidence refs，失败时拒绝 candidate 且不静默修复。
- [x] 3.4 更新 note lint，校验 evidence refs 非空、格式为 `processed/segments.json#<segment_id>`，并在可解析时确认 segment 存在。
- [x] 3.5 更新 note compose 与 note lint 测试，覆盖 allowed locator、发明 locator、raw path、artifact-level ref、缺失 segment anchor。

## 4. CLI、render、index 与 answer 回归

- [x] 4.1 确认 `note show` 与 `note render` 展示新的 locator 字符串且不改变 `note.json` 主真相。
- [x] 4.2 确认 note indexing 不把 draft、archived、superseded Notes 编入主索引，并评估 evidence locator tag 派生是否仍合理。
- [x] 4.3 确认 answer workflow 仍只通过 approved index entries 加载 approved Notes，不读取 raw Source、draft understanding 或 discussion summary。
- [x] 4.4 更新 CLI/render/index/answer 相关测试，覆盖多来源 evidence refs 下的展示与 approved-note-only 语义不变。

## 5. 验证

- [x] 5.1 运行 OpenSpec 校验，确认 `unify-evidence-locator` 的 proposal、design、specs、tasks 均有效。
- [x] 5.2 运行 TypeScript typecheck，修复类型错误。
- [x] 5.3 运行 Vitest 测试，修复失败用例。
- [x] 5.4 运行 lint 与 format check，修复质量问题。
- [x] 5.5 运行 build 或仓库等价验证命令，确认 CLI 可构建。
