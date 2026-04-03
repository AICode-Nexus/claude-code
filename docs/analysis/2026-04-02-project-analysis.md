# Claude Code Repository Analysis

## Project Summary

This repository is a Bun-based, reverse-engineered recreation of Anthropic's Claude Code CLI, centered on a terminal REPL, streaming model/tool loop, and a large prompt-driven extension surface for tools, slash commands, skills, MCP, and hooks.

At a high level, it is neither a generic web app nor a small library. It is a CLI platform codebase with substantial decompilation residue, intentionally disabled feature-flag branches, and a broad “product shell + runtime loop + extensibility” architecture.

## What Actually Runs

For the current build, the effective hot path is:

1. `src/entrypoints/cli.tsx`
2. `src/main.tsx`
3. setup / command and agent loading
4. REPL launch via `launchRepl(...)`
5. conversational turn processing via `src/query.ts`
6. higher-level state management via `src/QueryEngine.ts`

The key runtime fact is that `src/entrypoints/cli.tsx` hardcodes `feature()` to always return `false`, so many Anthropic-internal branches remain present in the tree but are dormant in this build.

## Runtime And Build

- Runtime: Bun with ESM and TS/TSX sources.
- Package manager and workspace model: Bun workspaces, with internal packages under `packages/*` and `packages/@ant/*`.
- Dev entrypoint: `bun run dev` -> `bun run src/entrypoints/cli.tsx`.
- Build entrypoint: `bun run build` -> `bun run build.ts`.
- Build output: current code uses `Bun.build({ entrypoints: ["src/entrypoints/cli.tsx"], outdir: "dist", target: "bun", splitting: true })`, then post-processes emitted `.js` files for Node compatibility.

This means the current build system is code-splitting and multi-file, not the older single-file bundle shape described in some local guidance.

## Execution Flow

### 1. Bootstrap

`src/entrypoints/cli.tsx` sets runtime polyfills and build-time globals, disables auto-pinning via `COREPACK_ENABLE_AUTO_PIN`, and short-circuits several special startup paths before handing off to the full CLI bootstrap.

The most important behavior here is the local `feature()` polyfill:

- feature-gated branches remain in source
- but they are effectively dead in this external build unless some runtime path bypasses that assumption

### 2. Startup Orchestration

`src/main.tsx` is the real startup coordinator:

- starts low-level startup helpers
- initializes auth, telemetry, managed settings, MCP, plugins, skills, and commands
- preloads bundled skills and plugins before `getCommands(...)`
- resolves commands and agent definitions
- eventually launches the REPL via `launchRepl(...)`

This file is the best place to understand product startup behavior, CLI mode branching, and what gets prepared before the first user prompt.

### 3. Turn Loop

`src/query.ts` is the central conversational engine. It normalizes messages, builds and appends context, handles streaming responses, runs tools, manages compact/continuation logic, and turns tool-use interruptions into conversation events.

If you want to understand “what happens on one assistant turn,” this is the core file.

### 4. Session Engine

`src/QueryEngine.ts` wraps the lower-level query loop with longer-lived state:

- mutable conversation history
- prompt/context preparation
- file-read state
- discovered skills
- transcript and session bookkeeping

It is the best entrypoint for understanding how turns compose into a durable interactive session.

## Core Module Map

### CLI And Startup

- `src/entrypoints/cli.tsx`: true executable entrypoint
- `src/main.tsx`: startup orchestrator
- `src/entrypoints/init.ts`: one-time initialization

### Conversation Runtime

- `src/query.ts`: main turn loop
- `src/QueryEngine.ts`: session-scoped orchestration
- `src/context.ts`: system and user context assembly

### Tools And Commands

- `src/tools.ts`: tool registry and environment-dependent tool selection
- `src/Tool.ts`: tool interfaces, permissions context, and shared types
- `src/commands.ts`: built-in slash command registry plus skill/plugin command aggregation

### Skills And Extensibility

- `src/skills/loadSkillsDir.ts`: local skill discovery, frontmatter parsing, and dynamic skill activation
- `src/skills/bundled/*`: bundled skill registration and payloads
- `docs/extensibility/skills.mdx`: one of the best architectural writeups in the repo

### UI And State

- `src/screens/REPL.tsx`: interactive terminal UI
- `src/components/*`: Ink-rendered UI pieces
- `src/state/*`: app state storage and change propagation

## Extension Points

### Tool System

`src/tools.ts` assembles the tool set. The core set includes `AgentTool`, `BashTool`, `FileReadTool`, `FileEditTool`, `FileWriteTool`, `WebFetchTool`, `SkillTool`, and others, with more tools gated by runtime checks, feature flags, or `USER_TYPE`.

This is the main starting point for adding or removing concrete capabilities.

### Slash Commands And Skills

`src/commands.ts` merges:

- built-in commands
- bundled skills
- local skills from `.claude/skills/`
- legacy command-style markdown commands
- plugin-contributed skills and commands

`src/skills/loadSkillsDir.ts` is the critical implementation for local skill support: it resolves skill paths, parses frontmatter, builds command objects, deduplicates by realpath, and supports dynamic discovery from touched file paths.

### MCP, Plugins, Hooks

The codebase has meaningful extension plumbing for:

- MCP servers and resources
- bundled and installed plugins
- hook execution before and after tool use
- environment- and policy-controlled capability loading

This makes the repository feel more like an agent platform shell than a simple CLI wrapper.

## Known Noise And Constraints

### Decompiled And Reverse-Engineered Noise

- There is substantial type noise and duplicated-looking structure from reverse engineering.
- The presence of files or imports is not sufficient evidence that a feature is live.
- `src/src/` and other awkward paths are strong indicators of reconstruction artifacts rather than intentional clean architecture.

### Feature-Gated Dead Branches

Because `feature()` is hardcoded to `false` in `src/entrypoints/cli.tsx`, many branches are effectively parked in source. This matters for reading the code:

- feature presence in tree does not imply runtime behavior
- “disabled but still present” is a first-class reading pattern here

### Validation Reality

The repo now has generic `test`, `lint`, and `format` scripts in `package.json`, but many workflows still rely on runtime validation and targeted manual checks rather than a comprehensive automated quality net.

## Documentation Drift

### AGENTS.md vs current build pipeline

The local `AGENTS.md` in this workspace says the build is:

- `bun build src/entrypoints/cli.tsx --outdir dist --target bun`
- single-file output `dist/cli.js`
- roughly 25 MB

Current code says otherwise:

- `package.json` routes `build` through `bun run build.ts`
- `build.ts` uses `splitting: true`
- `build.ts` post-processes output chunks for Node compatibility

So the current implementation is multi-file and code-split, not the simpler single-file build described in `AGENTS.md`.

### AGENTS.md vs configured scripts

The local `AGENTS.md` says no test runner and no linter are configured.

Current `package.json` includes:

- `test`: `bun test`
- `lint`: `biome lint src/`
- `lint:fix`
- `format`

That does not mean coverage is comprehensive, but it is still a concrete drift between local guidance and the actual configured scripts.

### README vs code

The README’s build description is closer to the current code than `AGENTS.md`:

- it mentions `build.ts`
- it mentions code splitting
- it mentions Node/Bun compatibility

So for build facts, README currently tracks implementation better than the local AGENTS guidance.

## Confidence And Remaining Gaps

### Confidence

High confidence on:

- repository identity as a Bun CLI platform
- active hot path through `cli.tsx -> main.tsx -> query.ts -> QueryEngine.ts`
- tool/command/skill extensibility structure
- the build documentation drift around `build.ts` and code splitting

### What required autoresearch

The biggest targeted follow-up check was on build behavior and startup orchestration:

- `build.ts` confirmed the current code-splitting build
- `src/main.tsx` confirmed bundled skills/plugins are registered before `getCommands(...)`
- targeted command/tool/skill registry scans confirmed the extension surfaces

### Remaining gaps

- I did not trace every REPL UI branch inside `src/screens/REPL.tsx`, so this report is stronger on runtime orchestration than on detailed terminal rendering internals.
- `AGENTS.md` appears to be local workspace guidance rather than obviously committed repository source, so treat that drift as “current workspace guidance vs code” if you need strictly committed-source-only analysis.
- I did not run a full end-to-end authenticated model session from this workspace as part of this report.

## Suggested Reading Order

1. `AGENTS.md` when present
2. `README.md`
3. `package.json`
4. `build.ts`
5. `src/entrypoints/cli.tsx`
6. `src/main.tsx`
7. `src/query.ts`
8. `src/QueryEngine.ts`
9. `src/tools.ts`
10. `src/Tool.ts`
11. `src/commands.ts`
12. `src/skills/loadSkillsDir.ts`

## Follow-up Questions

- Should `AGENTS.md` be updated or committed in a form that matches the current build/test/lint reality?
- Is the `src/src/` duplication intentionally retained, or should there be a future cleanup pass to reduce reverse-engineering noise?
- Which extension surface matters most for future work here: tools, slash commands, skills, or MCP?
- Should the project standardize on one authoritative architecture document so README and local guidance stop drifting apart?
