# Claude Code Repo Scan

## Repository Identity

- 这是一个用 Bun 运行的终端 AI coding assistant CLI，目标是复刻 Anthropic 官方 Claude Code 的主要能力，但当前仓库是“反编译/逆向恢复版”。
- 仓库形态不是单体脚本，而是一个带 `packages/*` workspace、Ink TUI、headless print 模式、MCP、skills、plugins、hooks、worktree/agent 支撑层的中大型 CLI monorepo。
- 根事实来源主要来自 `README.md`、`package.json`、`build.ts`、`src/entrypoints/cli.tsx`、`src/main.tsx`。

## Runtime / Build Facts

- 运行时是 Bun，`package.json` 指定 `"type": "module"`，脚本入口是 `bun run src/entrypoints/cli.tsx`。
- 当前构建事实以 `build.ts` 为准，不是单文件 bundle，而是 `Bun.build({ splitting: true, target: "bun" })` 的多文件输出，并对 `import.meta.require` 做 Node 兼容补丁。
- `package.json` 有 `lint` / `format` / `test` 脚本；测试 runner 不是“没有”，而是 Bun 自带测试，当前只有少量 `src/utils/__tests__`。
- `tsconfig.json` 关闭严格模式，`src/*` 路径别名生效。

## Hot Path Candidates

- 真实入口：`src/entrypoints/cli.tsx`
- 主 CLI 编排：`src/main.tsx`
- 初始化层：`src/entrypoints/init.ts`
- 用户输入预处理：`src/utils/processUserInput/processUserInput.ts`
- 会话引擎：`src/QueryEngine.ts`
- 递归 turn loop：`src/query.ts`
- API streaming / fallback / provider 适配：`src/services/api/claude.ts`
- 工具注册：`src/tools.ts`

## Active Runtime Path Notes

- `src/entrypoints/cli.tsx` 顶部 polyfill 了 `feature()`，返回恒为 `false`，所以很多 Anthropic 内部 feature-gated 分支在这个仓库当前构建里是死路径。
- `cli.tsx` 只保留少数 fast-path；默认路径最终会 dynamic import `../main.jsx` 并执行 `main()`.
- `src/main.tsx` 在 `preAction` 阶段执行 `init()`、加载配置/遥测/sinks，再进入 `setup()`、命令与 agent 定义加载、MCP 配置读取、interactive 或 headless 分支。
- `headless` 路径通过 `src/cli/print.ts` 调 `ask()` / `QueryEngine`；interactive 路径通过 `src/replLauncher.tsx` 挂载 `src/screens/REPL.tsx`，并在 REPL 内直接调用 `query()`.
- `QueryEngine` 负责 headless/SDK 路径的消息状态、transcript、file cache、slash command 预处理、SDK 输出整形；真正的多轮采样/工具循环在 `query.ts`，REPL 与 headless 都依赖它，但只有 headless 明确包了一层 `QueryEngine`。
- `query.ts` 是 `while (true)` 驱动的递归 turn loop：模型流式输出 -> 收集 `tool_use` -> 执行工具 -> 附加 memories/skills/queued commands -> 继续下一轮。

## Extension Point Candidates

- Built-in tools registry: `src/tools.ts`
- Slash command registry: `src/commands.ts`
- Bundled skills registration: `src/skills/bundled/index.ts`
- Local/project skill loading: `src/skills/loadSkillsDir.ts`
- Plugin command/skill loading: `src/utils/plugins/loadPluginCommands.ts`
- MCP transport + tool/resource bridge: `src/services/mcp/client.ts`
- Hooks execution core: `src/utils/hooks.ts`
- Prompt-stage hook integration: `src/utils/processUserInput/processUserInput.ts`

## Documentation Drift Candidates

- `AGENTS.md` / `CLAUDE.md` 说构建是单文件 `bun build ... --outdir dist --target bun`；代码里的 `build.ts` 已经是 `splitting: true` 的多文件构建。
- `AGENTS.md` / `CLAUDE.md` 说 “No test runner / No linter is configured”；`package.json` 已存在 `bun test`、Biome lint/format 脚本，且仓库里已有少量测试。
- `AGENTS.md` / `CLAUDE.md` 说 “Plugins / Marketplace | Removed”；代码里仍存在 `/plugin` 命令、plugin loader、versioned plugin init，只是 built-in plugin 目前为空。
- 同一组文档还把 Voice / LSP 描述成 removed，但代码显示 Voice 仍在 feature gate 后保留，LSP manager 仍在启动阶段初始化，LSPTool 由 `ENABLE_LSP_TOOL` 控制。

## Constraints / Noise

- 反编译噪音明显：类型不可靠、React Compiler 产物冗长、`src/src/*` 等镜像目录存在。
- 很多目录“存在但当前构建不活跃”，原因通常是 `feature()` 恒 false 或 `process.env.USER_TYPE !== "ant"`。
- 不能把 README 的能力表直接视为运行时真相，必须回到入口与 registry 判断。

## Autoresearch Trigger

- 触发原因：文档对 plugin / LSP / Voice 的状态描述和代码树明显冲突，同时需要确认 interactive 分支是否真的经过 `QueryEngine`。
- 追加核验文件：
  - `src/commands/plugin/index.tsx`
  - `src/services/lsp/manager.ts`
  - `src/screens/REPL.tsx`
- 结果：
  - Plugin 不是“已删除”，而是仍有完整命令和加载体系。
  - LSP 不是“移除”，而是运行期初始化 + 工具可选启用。
  - Voice 不是“没有代码”，而是 feature-gated 保留。
  - Interactive REPL 不是先走 `QueryEngine`，而是在 `REPL.tsx` 里直接调用 `query()`；`QueryEngine` 更偏 headless/SDK 包装层。
