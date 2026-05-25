## ADDED Requirements

### Requirement: Evidence Refs Use Processed Segment Locators
系统 SHALL 使用 processed segment locator 表示正式 Note 证据位置。`Note.source_refs[].evidence_refs` 中的正式证据引用 MUST 指向 processed artifacts，标准格式 MUST 为 `processed/segments.json#<segment_id>`，其中 `<segment_id>` MUST 对应 `processed/segments.json` 中存在的 segment `id`。

#### Scenario: Note references a processed segment
- **WHEN** Note 包含 `source_refs[].evidence_refs` 值 `processed/segments.json#seg_0001`
- **THEN** 该 ref 被解释为当前 Source 的 `processed/segments.json` 中 `id = seg_0001` 的 segment
- **AND** 该 ref 不要求读取 raw material 才能定位证据

#### Scenario: Note references raw material
- **WHEN** Note 包含 `raw/original.pdf#page=1`、`raw/original.html#intro`、`raw/original.md#heading` 或其他 raw path evidence ref
- **THEN** 系统 SHALL 将该 ref 视为无效正式 evidence ref
- **AND** 不允许该 Note 通过需要 evidence locator 的校验

#### Scenario: Note references artifact without segment anchor
- **WHEN** Note 包含 `processed/segments.json`、`processed/clean_text.md` 或 `processed/metadata.json` 作为 evidence ref
- **THEN** 系统 SHALL 将该 ref 视为无效正式 evidence ref
- **AND** 要求使用 `processed/segments.json#<segment_id>` 定位到具体 segment

### Requirement: Processed Segments Expose Locator Metadata
系统 SHALL 在每个 processed segment 中暴露结构化 locator metadata。该 metadata MUST 包含与 Note evidence ref 一致的 `ref`，并 MUST 提供足以解释 Markdown、PDF 或显式 URL 来源中 segment 位置的 processed-level 信息。

#### Scenario: Markdown segment has locator metadata
- **WHEN** Markdown Source 被处理成 `processed/segments.json`
- **THEN** 每个 segment SHALL 包含 `locator.ref = processed/segments.json#<segment_id>`
- **AND** locator SHALL 包含 Markdown 可用的正文顺序或 heading path 定位信息

#### Scenario: PDF segment has locator metadata
- **WHEN** PDF Source 被处理成 `processed/segments.json`
- **THEN** 每个 segment SHALL 包含 `locator.ref = processed/segments.json#<segment_id>`
- **AND** locator SHALL 包含页码或等价页内位置，使证据可定位到 processed PDF 文本中的页或页内片段

#### Scenario: URL segment has locator metadata
- **WHEN** 显式 URL Source 被处理成 `processed/segments.json`
- **THEN** 每个 segment SHALL 包含 `locator.ref = processed/segments.json#<segment_id>`
- **AND** locator SHALL 包含 heading path、section 或等价正文位置，使证据可定位到 processed URL snapshot 的正文片段

### Requirement: Locator Validation Is Deterministic
系统 SHALL 以确定性规则校验 evidence locator，不得依赖 LLM 自行解释或修复 locator。

#### Scenario: Locator exists in processed segments
- **WHEN** workflow 或 lint 校验 `processed/segments.json#seg_0001`
- **THEN** 系统 SHALL 读取对应 Source 的 processed segments
- **AND** 确认存在 `id = seg_0001` 的 segment 或存在相同 `locator.ref` 的 segment

#### Scenario: Locator does not exist in processed segments
- **WHEN** workflow 或 lint 校验 `processed/segments.json#seg_9999` 但 processed segments 中不存在该 segment
- **THEN** 系统 SHALL 报告 locator 不存在
- **AND** 不得静默替换成相似或相邻 segment
