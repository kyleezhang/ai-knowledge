## Context

当前 Source 主动导入已经覆盖本地 Markdown，并在 P1 范围内扩展到 PDF 与显式 public URL。飞书文档是用户常见的学习材料载体，但它不同于 public URL：读取需要依赖当前用户或机器人身份的飞书授权，失败边界包括认证、权限和文档格式转换。

本设计把飞书文档导入限定为“用户显式指定单个文档并导入为 Source”。导入只负责把外部文档冻结成本地 raw/Markdown snapshot，并创建 `status = ingested` 的 Source；后续仍由既有 `source process -> understand -> discuss -> approve -> note compose` gates 控制。

## Goals / Non-Goals

**Goals:**

- 增加 `ai-knowledge source ingest feishu-doc <doc_url_or_token>`，把单个可读取飞书文档导入为 Source。
- 在 Source metadata 中保留飞书来源信息，支持追溯原始输入、标题、文档类型和导入时间。
- 将飞书正文转换为 `raw/original.md`，复用现有 Markdown-style processing 管线。
- 保留飞书读取的 raw snapshot，避免处理失败时丢失原始材料。
- 在认证失败、权限不足、文档不可读或正文为空时失败且不创建半成品 Source。

**Non-Goals:**

- 不导入整个飞书知识库、空间、文件夹或搜索结果。
- 不自动扫描、监听、同步或采集飞书文档。
- 不导入飞书文档中的附件、PDF、图片 OCR、评论或权限信息。
- 不绕过 Source 处理、理解、讨论和用户确认 gates。
- 不引入数据库、Web UI、向量检索或新的长期外部同步服务。

## Decisions

1. **将飞书文档导入建模为用户主动导入 Source，而不是 Candidate。**
   - Rationale: 用户显式提供文档，意图是深入学习，符合 Source 的主动学习入口。
   - Alternative considered: 先进入 Candidate 池。该方案会混淆“自动采集候选”和“用户主动提供资料”的边界。

2. **导入阶段冻结远端内容，processing 阶段只读本地 snapshot。**
   - Rationale: Source processing 应该可重复、可追溯，不应因为远端文档变化或权限变化导致同一 Source 的处理输入漂移。
   - Alternative considered: 每次 process 时重新读取飞书文档。该方案更“新鲜”，但破坏 raw material 的证据边界和处理可复现性。

3. **使用 `raw/original.md` 作为规范化正文 artifact。**
   - Rationale: 飞书文档正文可视为文档类输入，转换为 Markdown 后可以最大化复用现有 Markdown processing、segments 和 evidence locator 逻辑。
   - Alternative considered: 为飞书文档新增独立 processed pipeline。该方案隔离更强，但会重复已有 Markdown 处理逻辑，并扩大改动面。

4. **保留一份 raw Feishu snapshot。**
   - Rationale: `raw/original.md` 是规范化输入，不一定能完整表达飞书 API 返回的结构；保留 raw snapshot 便于排查转换问题和追溯来源。
   - Alternative considered: 只保存 Markdown。该方案简单，但在转换失败或内容丢失时缺少证据。

5. **飞书读取能力放在 workflow 边界后面的 adapter，而不是 domain 或 storage。**
   - Rationale: domain 只定义对象契约，storage 只负责本地持久化；外部 API 调用属于导入 workflow 的外部输入步骤。
   - Alternative considered: 让 storage 直接读取飞书。该方案会把外部系统副作用混入本地文件层。

6. **失败时不创建 Source。**
   - Rationale: 导入失败表示还没有稳定 raw material，不能进入 Source 生命周期。
   - Alternative considered: 创建 `failed` Source 记录失败。该方案可审计性更高，但会产生没有 raw material 的 Source，违背后续 gate 前提。

## Risks / Trade-offs

- [Risk] 飞书 API 输出结构与 Markdown 转换能力不稳定 → Mitigation: 只要求导入可处理正文，无法转换时失败且不创建 Source；测试中使用 mock adapter 固定输入输出。
- [Risk] 远端文档在导入后变化，本地 Source 不是最新版本 → Mitigation: Source 代表导入时 snapshot；如需更新，应显式重新导入或未来设计 refresh 能力。
- [Risk] 飞书权限或认证错误难以诊断 → Mitigation: CLI 返回明确错误分类，不在 repo 中保存 token 或凭据。
- [Risk] 复用 Markdown processing 可能丢失飞书 block-level 信息 → Mitigation: 将可用 block id、heading path 或位置元数据写入 raw snapshot 或 processed metadata/locator。

## Migration Plan

- 这是新增命令和新增 `ingest_type`，不需要迁移既有 Source。
- 旧的 Markdown/PDF/URL Source processing 行为保持不变。
- 如 schema 中 `ingest_type` 或 `origin.user_input_type` 是枚举，需要添加 `feishu_doc` 并保持旧值兼容。
- Rollback: 移除 CLI 子命令和 workflow adapter 后，既有非 Feishu Source 不受影响；已导入的 Feishu Source 仍是本地 Source，可按其 raw artifacts 手工处理或删除。

## Verification Strategy

- OpenSpec: `openspec status --change import-feishu-doc-as-source` 与 OpenSpec 校验通过。
- Type/lint/format: 运行项目现有 TypeScript、ESLint、Prettier gates。
- Tests: 使用 mock Feishu adapter 覆盖成功导入、认证/权限/空正文失败、metadata schema、raw artifacts、CLI JSON 输出、processing 只读本地 snapshot。
- Workflow: 验证导入后的 Source 无 `processing_artifacts`，必须先 process 才能进入 draft understanding。

## Open Questions

- 实现时应选择调用现有 `lark-doc` 能力、`lark-cli` 子进程，还是项目内新增轻量 Feishu client adapter；需要以当前 repo 依赖和运行环境为准。
- raw Feishu snapshot 的具体文件名使用 `raw/feishu-doc.json` 还是 `raw/original.json`，实现前需要与现有 storage helper 命名风格对齐。
