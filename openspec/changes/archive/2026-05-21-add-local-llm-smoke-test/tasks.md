## 1. Smoke test 入口与隔离环境

- [x] 1.1 新增本地显式触发的 smoke test 入口（如 `pnpm test:smoke`），并确保它不并入默认 `pnpm test` 或 CI 阻塞链路。
- [x] 1.2 为 smoke test 创建固定 fixture 与隔离工作目录，确保真实集成验证不会污染仓库内已有 `knowledge/` 数据。

## 2. 真实 LLM 集成校验

- [x] 2.1 实现 `DEEPSEEK_API_KEY` 前置检查：存在时运行真实 provider smoke test，缺失时默认跳过或以非阻塞方式退出。
- [x] 2.2 让 smoke test 串起固定的关键主链路检查（`source ingest -> process -> understand -> discuss/approve -> note` 或等价控制面），但只断言关键状态与关键产物，不做逐字输出比较。
- [x] 2.3 记录真实 smoke test 的关键结果与失败上下文，便于人工判断 provider 波动、prompt 漂移或协议问题。

## 3. 文档与验证

- [x] 3.1 更新本地使用说明，明确 smoke test 的前置条件、成本、波动性和非阻塞定位。
- [x] 3.2 新增针对 smoke test 入口与跳过语义的测试或脚本级验证，确保无 `DEEPSEEK_API_KEY` 时不会破坏默认测试契约。
- [x] 3.3 运行 OpenSpec validation��typecheck、默认测试、lint / format check 与 build，并确认 smoke test 入口不影响默认自动化链路。
