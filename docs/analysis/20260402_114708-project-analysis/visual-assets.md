# Visual Assets

## Visuals Considered

- 主执行流图
- 扩展点地图
- interactive/headless 分支对照图
- 仓库目录结构图

## Visuals Used

### 1. 主执行流 Mermaid 图

- Location:
  - `final-analysis.md`
- Why it helps:
  - 把入口、编排层、query loop、API 层、tools/MCP 的顺序关系一次讲清楚。
- Source basis:
  - `src/entrypoints/cli.tsx`
  - `src/main.tsx`
  - `src/QueryEngine.ts`
  - `src/query.ts`
  - `src/services/api/claude.ts`

### 2. 扩展点地图 Mermaid 图

- Location:
  - `final-analysis.md`
- Why it helps:
  - 让维护者知道改 commands、tools、skills、plugins、hooks、MCP 分别从哪里入手。
- Source basis:
  - `src/commands.ts`
  - `src/tools.ts`
  - `src/skills/bundled/index.ts`
  - `src/skills/loadSkillsDir.ts`
  - `src/utils/plugins/loadPluginCommands.ts`
  - `src/utils/hooks.ts`
  - `src/services/mcp/client.ts`

### 3. Interactive vs Headless 分叉图

- Location:
  - `maintainer-deep-dive.md`
- Why it helps:
  - 直接说明 `REPL` 并不会先走 `QueryEngine`，避免维护者改错入口。
- Source basis:
  - `src/main.tsx`
  - `src/screens/REPL.tsx`
  - `src/cli/print.ts`
  - `src/QueryEngine.ts`

## Visuals Not Included

### Repository Layout Map

- Reason omitted:
  - 目录很多且噪音较大，画成结构图容易把“树上存在”误读成“当前运行”。

## External Images

- None.
