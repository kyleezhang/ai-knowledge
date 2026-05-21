## ADDED Requirements

### Requirement: Local Smoke Tests Require Explicit Provider Credentials
系统 SHALL 为本地真实 LLM smoke test 定义显式 provider 凭证前置条件。对于默认 deepseek provider，本地 smoke test 仅在检测到 `DEEPSEEK_API_KEY` 时才可运行；若缺失，该 smoke test MUST 默认跳过或以非阻塞方式退出，而不得让默认测试链路失败。

#### Scenario: Smoke test runs with provider key present
- **WHEN** 用户显式运行本地 smoke test，且环境中存在 `DEEPSEEK_API_KEY`
- **THEN** smoke test MAY 初始化真实 provider client
- **AND** use the configured deepseek model to exercise the target workflow

#### Scenario: Smoke test is requested without provider key
- **WHEN** 用户显式运行本地 smoke test，但环境中缺少 `DEEPSEEK_API_KEY`
- **THEN** smoke test MUST report that the required environment variable is missing
- **AND** MUST skip or exit without breaking the default automated test contract

### Requirement: Real-LLM Smoke Tests Stay Outside Default Test Contract
系统 SHALL 将真实 LLM smoke test 与默认自动化测试链路分离。真实 smoke test MUST 使用单独脚本或命令入口显式触发，且 MUST NOT 成为默认 `pnpm test` 或 CI required check 的组成部分。

#### Scenario: Default test suite runs
- **WHEN** 开发者运行默认测试入口
- **THEN** 默认测试套件不调用真实 LLM provider
- **AND** does not require `DEEPSEEK_API_KEY`

#### Scenario: Explicit smoke command runs
- **WHEN** 开发者运行独立 smoke test 命令
- **THEN** 系统执行真实 LLM 集成检查
- **AND** 将该检查标记为本地显式、非阻塞验证路径
