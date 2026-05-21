# P0 端到端人工验收步骤

## 前置条件

- 已在 shell 中配置可用的模型 provider 环境变量。
- 不要把 API key、token 或其他凭证写入仓库文件。
- 使用一个全新的临时工作目录，确保从空 `knowledge/` 开始。

## Fixture

- Markdown fixture：`tests/p0-end-to-end-acceptance.fixture.md`
- 预设问题：`agent memory boundary approved notes`

## 手工验收步骤

1. 在仓库根目录准备一个新的临时目录，并复制 fixture：
   ```bash
   WORKDIR="$(mktemp -d)"
   cp tests/p0-end-to-end-acceptance.fixture.md "$WORKDIR/"
   cd "$WORKDIR"
   ```
2. 初始化本地知识目录：
   ```bash
   ai-knowledge init
   ```
3. 导入 fixture：

   ```bash
   ai-knowledge source ingest markdown ./p0-end-to-end-acceptance.fixture.md
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

   - 至少输入一轮正常消息。
   - 在 REPL 中验证 `/status`、`/summary`、`/help`、`/approve`、`/exit`。
   - 如果 discussion 还没有 ready，`/approve` 不能强行通过。

7. 在 **未执行** `ai-knowledge source approve <source_id>` 之前，先尝试：

   ```bash
   ai-knowledge note compose <source_id>
   ```

   - 预期失败，错误中应包含 `code: INVALID_INPUT`。

8. 当 discussion 已 ready 后，执行：
   ```bash
   ai-knowledge source approve <source_id>
   ```
9. 生成 Note：

   ```bash
   ai-knowledge note compose <source_id>
   ```

   - 记录输出中的 `<note_id>`。

10. 在 **未执行** `ai-knowledge note lint <note_id>` 之前，先尝试：

    ```bash
    ai-knowledge note approve <note_id>
    ```

    - 预期失败，错误中应包含 `code: INVALID_STATE`。

11. 运行 Note QA：
    ```bash
    ai-knowledge note lint <note_id>
    ```
12. 批准 Note：
    ```bash
    ai-knowledge note approve <note_id>
    ```
13. 建立索引：
    ```bash
    ai-knowledge note index <note_id>
    ```
14. 提问并检查最终回答：
    ```bash
    ai-knowledge answer "agent memory boundary approved notes"
    ```

## 关键检查点

- Source 目录下应看到：
  - `knowledge/sources/YYYY/MM/<source_id>/raw/original.md`
  - `knowledge/sources/YYYY/MM/<source_id>/processed/clean_text.md`
  - `knowledge/sources/YYYY/MM/<source_id>/processed/segments.json`
  - `knowledge/sources/YYYY/MM/<source_id>/processed/metadata.json`
  - `knowledge/sources/YYYY/MM/<source_id>/discussion.jsonl`
- Note 目录下应看到：
  - `knowledge/notes/YYYY/MM/<note_id>/note.json`
  - `knowledge/notes/YYYY/MM/<note_id>/note.md`
- 索引目录下应看到：
  - `knowledge/index/YYYY/MM/<note_id>.index.json`
- 最终 `answer` 输出应引用 approved Note，而不是直接引用 raw material 或 discussion 草稿。

## 通过标准

- 可以从空 `knowledge/` 跑到 approved Note 与最终 answer。
- `note compose` 在 discussion approval 之前被正确阻止。
- `note approve` 在 QA passed 之前被正确阻止。
- discussion REPL 交互可接受，内置命令可用，状态反馈清晰。
- 最终回答能基于 approved Note 给出结论，并显示已确认知识的依据。
