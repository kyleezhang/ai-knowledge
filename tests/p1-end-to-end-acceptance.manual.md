# P1 PDF / URL 端到端人工验收步骤

## 前置条件

- 默认自动化验收使用 fake agents / deterministic fixtures，不依赖真实 LLM 或真实公网。
- 人工验收如果要使用真实 LLM，请在 shell 中配置 provider 环境变量；不要把 API key、token 或其他凭证写入仓库文件。
- 使用一个全新的临时工作目录，确保从空 `knowledge/` 开始。
- PDF / URL 只覆盖 P1 手动导入能力；不覆盖爬虫、自动采集、向量检索、数据库或 Web UI。

## Fixtures

- PDF：准备一份可稳定抽取文本的小型 PDF，例如人工创建的 1 页 PDF，文件名可为 `p1-acceptance.pdf`。
- URL：建议使用可公开访问且内容稳定的 HTML 页面；若不希望访问公网，用自动化测试中的 mocked HTML 作为行为参考。
- 预设问题：
  - PDF：`p1 pdf locator approved notes`
  - URL：`p1 url locator approved notes`

## PDF happy path

1. 准备临时目录：
   ```bash
   WORKDIR="$(mktemp -d)"
   cp /path/to/p1-acceptance.pdf "$WORKDIR/"
   cd "$WORKDIR"
   ```
2. 初始化本地知识目录：
   ```bash
   ai-knowledge init
   ```
3. 导入 PDF：

   ```bash
   ai-knowledge source ingest pdf ./p1-acceptance.pdf
   ```

   - 记录输出中的 `<source_id>`。

4. 处理 Source：
   ```bash
   ai-knowledge source process <source_id>
   ```
5. 生成 draft understanding：
   ```bash
   ai-knowledge source understand <source_id>
   ```
6. 启动讨论 REPL：

   ```bash
   ai-knowledge source discuss <source_id>
   ```

   - 至少进行一轮讨论。
   - 确认 discussion summary 已收敛，并通过 `/approve` 或退出后执行 `source approve`。

7. 在 source approval 前尝试：

   ```bash
   ai-knowledge note compose <source_id>
   ```

   - 预期失败，不能从 raw PDF 或 draft_understanding 直接生成 formal Note。

8. 批准 Source：
   ```bash
   ai-knowledge source approve <source_id>
   ```
9. 生成 Note：

   ```bash
   ai-knowledge note compose <source_id>
   ```

   - 记录输出中的 `<note_id>`。

10. 在 lint 前尝试：

    ```bash
    ai-knowledge note approve <note_id>
    ```

    - 预期失败，Note 不得进入 `approved`。

11. 运行 QA、批准、索引：
    ```bash
    ai-knowledge note lint <note_id>
    ai-knowledge note approve <note_id>
    ai-knowledge note index <note_id>
    ```
12. 提问：
    ```bash
    ai-knowledge answer "p1 pdf locator approved notes"
    ```

## URL happy path

1. 准备临时目录：
   ```bash
   WORKDIR="$(mktemp -d)"
   cd "$WORKDIR"
   ```
2. 初始化本地知识目录：
   ```bash
   ai-knowledge init
   ```
3. 导入显式公开 URL：

   ```bash
   ai-knowledge source ingest url https://example.com/path/to/stable-page
   ```

   - 记录输出中的 `<source_id>`。

4. 处理 Source：
   ```bash
   ai-knowledge source process <source_id>
   ```
5. 生成 draft understanding 并讨论确认：
   ```bash
   ai-knowledge source understand <source_id>
   ai-knowledge source discuss <source_id>
   ai-knowledge source approve <source_id>
   ```
6. 生成、QA、批准、索引 Note：
   ```bash
   ai-knowledge note compose <source_id>
   ai-knowledge note lint <note_id>
   ai-knowledge note approve <note_id>
   ai-knowledge note index <note_id>
   ```
7. 提问：
   ```bash
   ai-knowledge answer "p1 url locator approved notes"
   ```

## 关键检查点

- PDF Source 目录下应看到：
  - `knowledge/sources/YYYY/MM/<source_id>/raw/original.pdf`
  - `knowledge/sources/YYYY/MM/<source_id>/processed/clean_text.md`
  - `knowledge/sources/YYYY/MM/<source_id>/processed/segments.json`
  - `knowledge/sources/YYYY/MM/<source_id>/processed/metadata.json`
  - `knowledge/sources/YYYY/MM/<source_id>/discussion.jsonl`
- URL Source 目录下应看到：
  - `knowledge/sources/YYYY/MM/<source_id>/raw/fetched.html`
  - `knowledge/sources/YYYY/MM/<source_id>/processed/clean_text.md`
  - `knowledge/sources/YYYY/MM/<source_id>/processed/segments.json`
  - `knowledge/sources/YYYY/MM/<source_id>/processed/metadata.json`
  - `knowledge/sources/YYYY/MM/<source_id>/discussion.jsonl`
- `processed/segments.json` 中每个 segment 应包含 `locator.ref = processed/segments.json#<segment_id>`。
- PDF segment locator 应包含页码或等价页内位置。
- URL segment locator 应包含 heading path、section 或等价正文位置。
- `note.json` 中的 `source_refs[].evidence_refs` 应只引用 `processed/segments.json#<segment_id>`，不得引用 raw PDF/HTML。
- `note.md` 应展示来源链接与 evidence refs，但 `note.json` 仍是正式知识主真相。
- 索引目录下应看到：
  - `knowledge/index/YYYY/MM/<note_id>.index.json`
- 最终 `answer` 输出应引用 approved Note，而不是直接引用 raw material、draft understanding 或 discussion summary。

## 失败路径检查

- URL fetch failure：
  - 使用不可访问、非公开或会失败的 URL。
  - 预期 `source ingest url` 返回明确错误，不创建可处理 Source。
- Unsupported content-type：
  - 使用返回 JSON、PDF 或其他非 HTML content-type 的 URL。
  - 预期 `source ingest url` 返回明确错误，不创建可处理 Source。
- PDF extraction failure：
  - 使用无法抽取文本的 PDF 或损坏 PDF。
  - 预期 `source process <source_id>` 返回明确 processing / extraction 错误。
  - `raw/original.pdf` 应仍然保留。

## 通过标准

- PDF 可以从空 `knowledge/` 跑到 approved Note、index entry 与最终 answer。
- URL 可以从空 `knowledge/` 跑到 approved Note、index entry 与最终 answer。
- `note compose` 在 discussion approval 前被正确阻止。
- `note approve` 在 QA/lint passed 前被正确阻止。
- URL fetch failure、unsupported content-type、PDF extraction failure 都能明确报错。
- 来源追溯信息可接受：processed segment locator、`source_refs.evidence_refs`、`note render` 与 `answer` 输出保持 approved-note-only 语义。

## 真实 LLM smoke 边界

真实 LLM smoke 只维护一个入口：`pnpm test:smoke`。该入口会在一次运行中覆盖 Markdown、PDF、URL 三类输入的关键链路；不再分别维护 P0 smoke 与 P1 smoke。

该检查仍然是本地显式触发，不并入默认 `pnpm test` 或 CI gate。运行前确认：

- 已在 shell 中配置必要的 provider API key。
- 明确会消耗 token，输出可能有轻微波动。
- 不要求逐字匹配，只检查状态推进、schema 校验、QA gate、approved Note 与 answer grounding 是否成立。
- 默认 `pnpm test` 仍使用 fake agents，不依赖真实 LLM。
