# Claude Code Documentation Drift Matrix

## How To Read This

这张表不是在说“文档都不能信”，而是在区分：

- 哪些文档已经和代码脱节
- 哪些文档大体可信但有关键误导
- 维护者应该优先修哪里的说明

## Drift Matrix

| Area | Current doc claim | Code reality | Evidence | Maintainer impact | Suggested correction |
|---|---|---|---|---|---|
| Build output | 根级 `AGENTS.md` / `CLAUDE.md` 把构建描述成单文件 bundle | 当前构建来自 `build.ts`，`Bun.build({ splitting: true, target: "bun" })`，是多文件输出 | `build.ts` | 新人会误判 dist 形态、调试产物和打包约束 | 改成“多文件 split build，并在构建后修补 `import.meta.require` 兼容层” |
| Test / lint | 根级文档称没有 test runner / linter | `package.json` 已有 `bun test`、Biome `lint` / `format`，仓库里也有少量测试 | `package.json`, `src/utils/__tests__` | 新人会误以为仓库完全没有验证入口 | 改成“已有基础 runner，但覆盖面薄” |
| Plugin system | 根级文档称 plugins / marketplace removed | 插件基础设施仍在：命令入口、loader、versioned plugin init 都存在 | `src/commands/plugin/index.tsx`, `src/utils/plugins/loadPluginCommands.ts`, `src/main.tsx` | 会让维护者错过真正的扩展装载链路 | 改成“内建 marketplace 内容很少，但插件体系仍存在” |
| LSP | 根级文档称 LSP Server removed | LSP manager 仍初始化，`LSPTool` 仍可被 env 启用 | `src/main.tsx`, `src/services/lsp/manager.ts`, `src/tools.ts` | 容易误删或误判 LSP 相关代码为死代码 | 改成“不是默认热路径，但未移除” |
| Voice | 根级文档称 Voice Mode removed | voice 代码仍保留，只是被 `feature('VOICE_MODE')` gate 住 | `src/screens/REPL.tsx`, `src/commands/voice/*`, `src/voice/*` | 会把“保留但禁用”和“已删除”混为一谈 | 改成“当前外部构建默认关闭” |
| Interactive orchestration | `docs/introduction/architecture-overview.mdx` 把 `QueryEngine` 写成 REPL 与 `query()` 的统一中间层 | interactive 路径是 `REPL.tsx` 直接调用 `query()`；`QueryEngine` 主要在 headless/print 分支 | `src/replLauncher.tsx`, `src/screens/REPL.tsx`, `src/cli/print.ts`, `src/QueryEngine.ts` | 维护者会在 REPL 行为排查时从错误层次入手 | 改成显式双分支：interactive vs headless |

## Sampled Docs Trust Ranking

基于这次抽样，更实用的信任排序是：

1. 源码入口与 registry
   - `src/entrypoints/cli.tsx`
   - `src/main.tsx`
   - `src/query.ts`
   - `src/tools.ts`
   - `src/utils/sessionStorage.ts`
2. docs 站中偏源码讲解的章节
   - `docs/conversation/the-loop.mdx`
   - `docs/extensibility/mcp-protocol.mdx`
   - `docs/extensibility/hooks.mdx`
   - `docs/extensibility/skills.mdx`
3. docs 站的总览型章节
   - `docs/introduction/architecture-overview.mdx`
4. 根级项目说明
   - `AGENTS.md`
   - `CLAUDE.md`

## Recommended Repair Order

如果只修最值钱的漂移，建议顺序如下：

1. 修根级 `AGENTS.md` / `CLAUDE.md` 的 build、test/lint、plugin、LSP、voice 描述
2. 修 `docs/introduction/architecture-overview.mdx` 对 interactive/headless 编排层的表述
3. 给 docs 站补一页“状态/持久化/后台任务”说明，减少大家只盯 `query.ts`

## Bottom Line

当前仓库不是“所有文档都失效”，而是：

- 根级运维说明最容易误导
- docs 站的 conversation/extensibility 章节整体更接近源码
- 总览型架构图文档需要一次针对 interactive/headless 分叉的修订
