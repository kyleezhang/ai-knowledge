## MODIFIED Requirements

### Requirement: Candidate domain stays isolated from workflows and storage
系统 SHALL 允许 Candidate domain 被 Candidate storage 与只读查看 workflow 使用，但 Candidate MUST 仍保持在主知识层之外，不得绕过 Source、Discussion、Note、QA 或 Index gate。Candidate storage/read-only CLI 不得创建 Source、Note 或 Index Entry，也不得参与 answer retrieval。

#### Scenario: Candidate domain is implemented
- **WHEN** Candidate domain contract 存在
- **THEN** `src/domain/candidate.ts` 导出 `CandidateSchema`、`CandidateStatusSchema`、`CandidateSourceTypeSchema`、`Candidate`、`CandidateStatus`、`CandidateSourceType`、`parse_candidate`
- **AND** Candidate storage MAY use `parse_candidate` to validate persisted Candidate JSON
- **AND** Candidate read-only workflows MAY expose list/show behavior
- **AND** Candidate MUST NOT be written to main index
- **AND** Candidate MUST NOT be used directly as answer evidence
