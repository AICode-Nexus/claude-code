# Claude Code Strategy Repo Scan

## Repository Identity

- This repository is a Bun-based, reverse-engineered terminal agent CLI with a real interactive REPL, a multi-turn query loop, tool orchestration, session persistence, memory subsystems, and experimental multi-agent/team scaffolding.
- The active runtime path is `src/entrypoints/cli.tsx` -> `src/main.tsx` -> `src/QueryEngine.ts` / `src/query.ts` -> `src/services/api/claude.ts` -> tools/tasks/memory/services.
- The biggest source of noise is decompilation residue and disabled feature-flag branches. In this build, `feature()` is hardcoded to return `false` from the CLI entrypoint, so feature-gated internal branches are present in the tree but mostly dormant.

## Files Most Relevant To The 10 Questions

- Memory system:
  - `src/memdir/memdir.ts`
  - `src/memdir/paths.ts`
  - `src/services/SessionMemory/sessionMemory.ts`
  - `src/services/SessionMemory/sessionMemoryUtils.ts`
  - `src/services/extractMemories/extractMemories.ts`
  - `src/services/autoDream/autoDream.ts`
  - `src/services/teamMemorySync/index.ts`
  - `src/services/teamMemorySync/watcher.ts`
  - `src/services/teamMemorySync/teamMemSecretGuard.ts`
- Anti-distillation / attribution / exposure control:
  - `src/services/api/claude.ts`
  - `src/utils/streamlinedTransform.ts`
  - `src/utils/undercover.ts`
  - `src/utils/fingerprint.ts`
  - `src/constants/system.ts`
- Invalid API call control / retries:
  - `src/query.ts`
  - `src/services/api/errors.ts`
  - `src/services/api/withRetry.ts`
  - `src/services/teamMemorySync/watcher.ts`
- 7x24 runtime surfaces:
  - `src/tools/ScheduleCronTool/prompt.ts`
  - `src/utils/cronTasks.ts`
  - `src/hooks/useScheduledTasks.ts`
  - `src/utils/backgroundHousekeeping.ts`
  - `src/utils/sessionStorage.ts`
  - `src/main.tsx`
- Agent teams:
  - `src/tools/TeamCreateTool/TeamCreateTool.ts`
  - `src/tools/shared/spawnMultiAgent.ts`
  - `src/tasks/InProcessTeammateTask/InProcessTeammateTask.tsx`
  - `src/utils/swarm/inProcessRunner.ts`
  - `src/utils/swarm/backends/registry.ts`
  - `src/utils/agentSwarmsEnabled.ts`
- Quality and code management:
  - `package.json`
  - `.githooks/pre-commit`
  - `.github/workflows/ci.yml`
  - `scripts/health-check.ts`
- Harness / eval infrastructure:
  - `src/services/vcr.ts`
  - `src/services/api/dumpPrompts.ts`
  - `src/query/deps.ts`
  - `src/utils/claudeCodeHints.ts`
  - `src/entrypoints/cli.tsx`

## Key Drift And Constraints

- `AGENTS.md` says there is no configured test runner and no configured linter, but `package.json` and `.github/workflows/ci.yml` show `bun test`, Biome linting, build, and CI are configured. That is meaningful documentation drift.
- The codebase includes several duplicated or generated-looking paths such as `src/src/*`; these should be treated as noise unless a live import path proves otherwise.
- External-build reality matters more than tree breadth. Examples:
  - anti-distillation code exists in `src/services/api/claude.ts`, but its feature gate is dormant in this build
  - team memory and swarm tooling have usable scaffolding, but some surrounding internal-only flows remain gated or partial

## Suggested Reading Order

1. `src/entrypoints/cli.tsx`
2. `src/main.tsx`
3. `src/query.ts`
4. `src/services/api/claude.ts`
5. `src/memdir/paths.ts`
6. `src/services/SessionMemory/sessionMemory.ts`
7. `src/services/extractMemories/extractMemories.ts`
8. `src/services/teamMemorySync/index.ts`
9. `src/tools/TeamCreateTool/TeamCreateTool.ts`
10. `src/tools/shared/spawnMultiAgent.ts`
11. `src/services/api/withRetry.ts`
12. `package.json`, `.githooks/pre-commit`, `.github/workflows/ci.yml`
