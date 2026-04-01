# Project Analysis Skill Design

## Status

Approved for implementation after interactive design review on 2026-04-02.

## Summary

Create a repository-local skill named `project-analysis` for this codebase. The skill is manually invoked, runs inline in the current conversation, produces a concise terminal summary, and writes a dated project analysis report into `docs/analysis/`.

This skill is optimized for the realities of this repository:

- Bun-based CLI application
- reverse-engineered / decompiled codebase
- meaningful separation between hot runtime paths and dead or gated paths
- strong existing documentation that should be reconciled against code
- a built-in skill system that already supports directory-based local skills

## Context

The repository is not a generic web app. It is a reverse-engineered implementation of Anthropic's Claude Code CLI with Bun runtime, many feature-gated branches, and decompilation noise that should not be mistaken for active breakage.

Several facts shape the skill design:

- `src/entrypoints/cli.tsx` is the effective entrypoint and hardcodes `feature()` to always return `false`
- `src/main.tsx` is the startup orchestration layer
- `src/query.ts` is the main conversational tool loop
- `src/QueryEngine.ts` manages higher-level conversation and session state
- `src/skills/loadSkillsDir.ts` is the key local skill loading implementation
- `AGENTS.md`, `README.md`, and `docs/extensibility/skills.mdx` already contain high-value architectural context

The skill should help a future agent quickly understand what matters in this repository without getting trapped in decompiled noise or disabled feature paths.

## Goals

- Provide a zero-argument manual command: `/project-analysis`
- Produce a fast, readable project overview first
- Include lightweight deeper analysis as a secondary layer
- Distinguish active runtime paths from dead, stubbed, or feature-disabled paths
- Identify documentation drift between code and docs when present
- Write a dated analysis artifact to the repository by default
- Stay small enough to maintain and expand over time

## Non-Goals

- No automatic invocation by the model
- No code modification beyond writing the analysis report
- No build, test, or runtime execution by default
- No attempt to fix technical debt or reconcile docs automatically
- No repository-agnostic mega-framework in v1
- No helper script in v1 unless the skill later proves too token-heavy or unstable
- No additional generated artifacts in v1 beyond the dated `docs/analysis/*` report

## User Experience

The user invokes `/project-analysis` manually.

The skill runs in the current conversation and returns:

1. A compact terminal summary with the most useful project facts
2. A generated Markdown report at `docs/analysis/YYYY-MM-DD-project-analysis.md`

The skill should feel like a repository orientation workflow, not a generic audit.

## Proposed Structure

The skill will live at:

`.claude/skills/project-analysis/`

Initial file layout:

```text
.claude/skills/project-analysis/
├── SKILL.md
└── references/
    ├── checklist.md
    ├── report-template.md
    └── repo-notes.md
```

### Why this structure

- `SKILL.md` stays focused on workflow and invocation behavior
- `references/checklist.md` holds reusable analysis dimensions
- `references/report-template.md` standardizes output quality
- `references/repo-notes.md` captures repository-specific truths that should shape the analysis

This follows a progressive-disclosure approach and avoids letting `SKILL.md` become a long monolith.

## Frontmatter Design

The skill should use minimal permissions and be user-invocable only.

Planned frontmatter:

```yaml
---
name: project-analysis
description: Manual repository analysis workflow for this project that produces a concise architecture summary and writes a dated analysis report.
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - Bash(pwd)
  - Bash(ls:*)
  - Bash(find:*)
  - Bash(git status:*)
  - Bash(git log:*)
disable-model-invocation: true
user-invocable: true
---
```

### Frontmatter decisions

- No `context: fork`
  The workflow should stay inline so the user can immediately ask follow-up questions about tools, skills, query flow, or specific files.
- No arguments in v1
  `/project-analysis` should work out of the box. Focused modes can be added later if repeated demand appears.
- No broad `Bash(*)`
  The skill should observe the repository, not act as a general shell operator.
- No `Edit`
  The skill writes a fresh Markdown analysis file and does not need diff-based editing for v1.

## Workflow Design

The skill should execute the following sequence:

### 1. Load repository context

Read high-signal project context first:

- `AGENTS.md`
- `README.md`
- relevant architecture or extensibility docs
- `package.json`

Success criteria:

- repository purpose is clear
- runtime and build assumptions are identified
- any project-specific caveats are loaded before code inspection

### 2. Identify repository shape

Map the codebase at a high level:

- top-level directories
- workspace layout
- main source areas
- location of entrypoints and extension systems

Success criteria:

- the repository can be described as a specific kind of system, not just “a codebase”

### 3. Trace the active execution path

Follow the real hot path instead of every possible path:

- entrypoint
- startup orchestration
- query loop
- session engine
- tool registry
- skill loading

Success criteria:

- the skill can explain what actually runs in normal use
- the analysis separates active code from dormant branches

### 4. Inspect extension points

Summarize how the repository is extended:

- tools
- slash commands / skills
- MCP integration
- hooks or config-driven behavior

Success criteria:

- a future contributor knows where to start when extending the system

### 5. Identify noise, constraints, and drift

Explicitly look for:

- feature-disabled branches
- stubs
- decompilation type noise
- doc/code mismatches

Success criteria:

- the analysis names risks without treating every noisy signal as a blocker

### 6. Produce outputs

Return a short terminal summary, then write a full report to `docs/analysis/YYYY-MM-DD-project-analysis.md`.

Success criteria:

- the terminal output is skimmable
- the report is stable, useful, and easy to reference later

## Output Design

### Terminal Summary

The skill should always produce:

- one-sentence project definition
- main execution path in 3 to 6 nodes
- key files and directories
- primary risks or caveats
- suggested reading order
- report path confirmation

This keeps the immediate answer useful even if the user never opens the report.

### Report Template

The default report should contain:

1. `Project Summary`
2. `What Actually Runs`
3. `Runtime And Build`
4. `Execution Flow`
5. `Core Module Map`
6. `Extension Points`
7. `Known Noise And Constraints`
8. `Documentation Drift`
9. `Suggested Reading Order`
10. `Follow-up Questions`

`Documentation Drift` must be a dedicated section whenever docs and code disagree.

## Reference File Responsibilities

### `references/checklist.md`

Purpose:

- reusable analysis checklist
- classification prompts for repository type
- architectural dimensions to inspect
- explicit reminder to separate active runtime flow from dead or gated paths

Expected content:

- repository identity checklist
- runtime/build checklist
- execution-path checklist
- extension-point checklist
- risk/drift checklist
- output requirements checklist

### `references/report-template.md`

Purpose:

- stable Markdown skeleton for report generation
- formatting guidance for section order and depth

Expected content:

- report headings
- short instructions per heading
- constraints on tone and brevity
- rule that drift findings must be explicit

### `references/repo-notes.md`

Purpose:

- repository-specific notes that the skill should preferentially trust while analyzing this repo

Expected content:

- `src/entrypoints/cli.tsx` is the effective entrypoint
- `feature()` is hardcoded to `false` in this build
- `src/main.tsx` is the orchestration layer
- `src/query.ts` is the main turn loop
- `src/QueryEngine.ts` is the higher-level stateful session layer
- `src/skills/loadSkillsDir.ts` is central to local skill loading
- this repository includes decompilation noise and disabled branches that should be labeled, not over-weighted

## Default Reading Order

The skill should recommend this path unless a focused question changes it:

`AGENTS.md -> README.md -> package.json -> src/entrypoints/cli.tsx -> src/main.tsx -> src/query.ts -> src/QueryEngine.ts -> src/tools.ts -> src/Tool.ts -> src/skills/loadSkillsDir.ts`

## Error Handling And Boundaries

The skill should be resilient when:

- some docs are missing
- file structure differs slightly from expectations
- analysis finds contradictory sources

Behavior rules:

- prefer code over docs when they conflict, but record the drift
- do not fail the workflow because one expected file is absent
- do not present speculative conclusions as facts
- do not treat decompilation type noise as proof of runtime failure

## Why Inline Instead Of Fork

Inline execution is preferred because:

- the user wants manual invocation
- the likely next action is a follow-up question in the same thread
- the workflow is interpretive and conversational, not isolated batch work
- the output should stay in the main conversation history

Fork mode would add isolation without meaningful benefit for this use case.

## Why No Script In V1

A helper script is intentionally deferred.

Reasons:

- the current workflow is mostly interpretive synthesis, not deterministic data processing
- the repository already provides enough structure for a prompt-driven workflow
- introducing a script now would increase implementation weight before a clear need exists

If the skill later becomes unstable, repetitive, or token-heavy, a script can be added to collect repository facts while the skill retains synthesis and reporting logic.

## Implementation Success Criteria

Implementation is complete when:

- `/project-analysis` is available as a repository-local skill
- it runs without arguments
- it uses only the planned minimal tool set
- it produces a concise terminal summary
- it writes `docs/analysis/YYYY-MM-DD-project-analysis.md`
- the report contains all required sections
- the report correctly distinguishes active code paths from gated or noisy ones
- the workflow explicitly surfaces documentation drift when found

## Verification Plan

After implementation, verify by invoking the skill inside this repository and checking:

- the skill is discoverable and callable
- the report file is created in the expected path
- the summary references the real project structure
- the report includes at least one concrete runtime-path explanation
- the report does not overstate disabled feature branches as active functionality

## Open Questions

- Should a future v2 support focused modes such as `/project-analysis tools` or `/project-analysis skills`?
- Should later iterations add a lightweight facts-only helper script for stability?
- Should the generated report eventually include clickable file references for every major module?
