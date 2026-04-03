# Outline

## Hook

这个仓库不是“从零设计一个 agent 系统”，而是“在一个已经有 query loop、memory、cron、swarm、resume、tooling 的反编译 CLI 上，判断哪些能力已经成形、哪些还只是散落的骨架”。

## Sections

1. 仓库现状与判断边界
   - depth levers: active runtime path, feature-gated noise, docs drift
   - examples: `feature()` hard-false, CI vs AGENTS drift
2. 记忆、反蒸馏、API 调用控制
   - depth levers: mechanism, failure mode, control plane gaps
   - examples: session memory, auto memory, anti_distillation, retry suppression
3. 7x24、agent team、模块协作
   - depth levers: execution surface, orchestration boundaries, persistence
   - examples: cron, session persistence, team backends, mailbox and task routing
4. 质量体系、harness、设备标识与封禁
   - depth levers: current guardrails, missing governance, abuse control boundaries
   - examples: Biome/test/CI, VCR/dump-prompts, config userID vs device identity

## Practical Takeaways

- 这套仓库最值得复用的是“分层记忆 + turn loop + resume + cron + team/mailbox”这些骨架
- 最缺的是统一控制面：记忆路由策略、无效请求熔断、队伍编排策略、质量门禁、设备风控
- 不是所有问题都需要新发明，很多都可以直接挂在现有 seam 上
