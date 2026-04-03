# Claude Code Analysis Outline

## Goal

- 给后续维护者一份“看完就知道从哪里改”的仓库地图。
- 明确区分“树上有代码”与“当前构建真会运行”的路径。
- 把文档漂移集中拆出来，避免误读 AGENTS/CLAUDE/README。

## Section Plan

1. Project Summary
   - 定义仓库是什么，不把它泛化成普通 app。
2. What Actually Runs
   - 给出当前构建的真实活跃路径与非活跃路径边界。
3. Runtime And Build
   - 记录 Bun、workspace、build.ts、headless/repl 双路径。
4. Execution Flow
   - 显式拆开 interactive 与 headless：`cli.tsx -> main.tsx -> REPL.tsx -> query.ts` vs `cli.tsx -> main.tsx -> print.ts -> QueryEngine -> query.ts`
5. Core Module Map
   - 入口、状态、UI、API、tooling、MCP、skills/plugins/hooks。
6. State / Persistence / Backgrounding
   - `AppStateStore`、`onChangeAppState`、`messageQueueManager`、`sessionStorage`、task framework。
7. Extension Points
   - 改工具、改命令、改 skills、改 plugins、改 query loop 各从哪里入手。
8. Known Noise And Constraints
   - feature gates、反编译噪音、镜像目录、type 不可信。
9. Documentation Drift
   - build / test / plugin / voice / LSP，以及 docs 站总览页对 QueryEngine 的误导点。
10. Confidence And Remaining Gaps
   - 说明做过一轮 bounded autoresearch，但没有实际跑整套 CLI。
11. Suggested Reading Order / Follow-up Questions
   - 面向新人或维护者的下一步阅读列表。

## Additional Deliverables

- `maintainer-deep-dive.md`
  - 专讲 interactive/headless 分叉与改动入口。
- `architecture-handoff.md`
  - 专讲状态层、队列、持久化、后台任务、session hooks。
- `drift-matrix.md`
  - 专门记录文档与代码的偏差矩阵，方便后续修文档。

## Visual Opportunities

- 执行流 Mermaid 图：
  - 目的：让维护者快速把入口、query loop、API 层、工具层串起来。
- 扩展点 Mermaid 图：
  - 目的：说明 commands / tools / skills / plugins / MCP / hooks 如何挂入主流程。

## What The Reader Should Learn

- 为什么这个仓库的“真相”必须以 `cli.tsx` 和各 registry 为准。
- 为什么 `feature()` 恒 false 是当前分析的第一原则。
- 哪些模块适合改行为，哪些模块只是历史包袱或当前构建死代码。
