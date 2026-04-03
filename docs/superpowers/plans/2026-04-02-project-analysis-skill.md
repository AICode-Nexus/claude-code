# Project Analysis Skill Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repository-local `project-analysis` skill that gives a concise architecture summary, writes a dated report to `docs/analysis/`, and runs a bounded `autoresearch` quality gate before finalizing output.

**Architecture:** The implementation is a pure local-skill package under `.claude/skills/project-analysis/`. The skill body in `SKILL.md` orchestrates the workflow, while `references/` files hold the reusable checklist, quality rubric, report template, and repository-specific notes so the main prompt stays lean. Verification is split into static file checks and manual REPL validation because this repository does not currently have an automated test harness for local skills.

**Tech Stack:** Markdown skill files, local `.claude/skills/` discovery, Bun CLI (`bun run dev`), repository docs, manual REPL verification, `rg`/`find`/`git` shell checks.

---

## File Structure

### New files

- `.claude/skills/project-analysis/SKILL.md`
  Repository-local manual skill entrypoint, frontmatter, workflow steps, output contract, and bounded autoresearch behavior.
- `.claude/skills/project-analysis/references/checklist.md`
  Reusable analysis checklist: repository identity, runtime/build, execution path, extension points, drift, and output completeness.
- `.claude/skills/project-analysis/references/quality-gate.md`
  Self-check rubric for evidence coverage, contradiction handling, confidence reporting, and the one-pass autoresearch retry rule.
- `.claude/skills/project-analysis/references/report-template.md`
  Final report skeleton for `docs/analysis/YYYY-MM-DD-project-analysis.md`.
- `.claude/skills/project-analysis/references/repo-notes.md`
  Repository-specific facts and reading order for this Bun/decompiled CLI project.

### Runtime-generated file

- `docs/analysis/YYYY-MM-DD-project-analysis.md`
  Produced by the skill at invocation time. Do not pre-create a placeholder in the implementation branch.

### Existing files to consult but not modify in v1

- `docs/superpowers/specs/2026-04-02-project-analysis-skill-design.md`
- `AGENTS.md`
- `README.md`
- `docs/extensibility/skills.mdx`
- `src/entrypoints/cli.tsx`
- `src/main.tsx`
- `src/query.ts`
- `src/QueryEngine.ts`
- `src/tools.ts`
- `src/Tool.ts`
- `src/skills/loadSkillsDir.ts`

## Chunk 1: Author the Skill Package

### Task 1: Prepare an isolated workspace and scaffold the skill directory

**Files:**
- Create: `.claude/skills/project-analysis/`
- Create: `.claude/skills/project-analysis/references/`

- [ ] **Step 1: Create or switch to a dedicated worktree**

Run:

```bash
git worktree add ../claude-code-project-analysis -b codex/project-analysis-skill
```

Expected: a new sibling worktree is created for implementation. If the branch or worktree already exists, switch into the existing worktree instead of creating another one.

- [ ] **Step 2: Enter the worktree and create the directory skeleton**

Run:

```bash
mkdir -p .claude/skills/project-analysis/references
```

Expected: `.claude/skills/project-analysis/references` exists.

- [ ] **Step 3: Verify the skeleton before writing files**

Run:

```bash
find .claude/skills/project-analysis -maxdepth 2 -type d | sort
```

Expected:

```text
.claude/skills/project-analysis
.claude/skills/project-analysis/references
```

### Task 2: Create the reusable checklist and quality gate references

**Files:**
- Create: `.claude/skills/project-analysis/references/checklist.md`
- Create: `.claude/skills/project-analysis/references/quality-gate.md`

- [ ] **Step 1: Write `checklist.md` with the exact top-level sections**

Create this structure:

```md
# Project Analysis Checklist

## Repository Identity
- Determine whether the project is a CLI, library, service, web app, monorepo, reverse-engineered project, or a combination.
- Capture runtime, package manager, build tool, and workspace layout.

## Runtime And Build
- Identify the real entrypoint.
- Record runtime assumptions and build pipeline facts from code first, docs second.

## Active Execution Path
- Trace entrypoint -> startup orchestration -> turn loop -> state/session engine -> tool registry -> skill loading.
- Label dead, gated, stubbed, or ant-only paths explicitly.

## Extension Points
- Summarize tools, slash commands, local skills, MCP, hooks, and config-driven behaviors.

## Risks And Drift
- Note feature-flag-disabled branches, stubs, decompilation noise, and doc/code mismatches.

## Output Requirements
- Always produce a one-sentence summary.
- Always include a suggested reading order.
- Always separate facts, inferences, and remaining uncertainty.
```

Expected: the file is specific enough to drive analysis without hardcoding this repository into every line.

- [ ] **Step 2: Write `quality-gate.md` with the bounded autoresearch rubric**

Create this structure:

```md
# Project Analysis Quality Gate

## Pass Criteria
- Each major architectural claim cites a concrete source file or document.
- The hot path is specific, not generic.
- Disabled or stubbed paths are labeled explicitly.
- Required report sections are present.
- Documentation drift is called out when found.

## Retry Trigger
- Trigger autoresearch only when evidence is missing, contradictory, or too vague to support the draft.

## Allowed Autoresearch Actions
- Read missing files.
- Grep for confirming evidence.
- Reconcile contradictions.
- Revise the draft once.

## Hard Limits
- Run at most one autoresearch retry pass.
- If uncertainty remains, keep the final answer but surface the gaps explicitly.

## Final Output Rules
- Do not hide uncertainty.
- Do not silently convert weak inferences into facts.
```

Expected: the retry behavior is capped to one pass and clearly prohibits endless looping.

- [ ] **Step 3: Run a static read-back check on both reference files**

Run:

```bash
sed -n '1,220p' .claude/skills/project-analysis/references/checklist.md
sed -n '1,220p' .claude/skills/project-analysis/references/quality-gate.md
```

Expected: both files render with the expected headings and no placeholder text.

- [ ] **Step 4: Commit the new reference files**

Run:

```bash
git add .claude/skills/project-analysis/references/checklist.md .claude/skills/project-analysis/references/quality-gate.md
git commit -m "feat: add project-analysis checklist and quality gate"
```

Expected: a commit exists containing only the two new reference files.

### Task 3: Create the report template and repository notes

**Files:**
- Create: `.claude/skills/project-analysis/references/report-template.md`
- Create: `.claude/skills/project-analysis/references/repo-notes.md`

- [ ] **Step 1: Write `report-template.md` with the final output shape**

Create this structure:

```md
# Project Analysis Report Template

# {{Project Name}} Analysis

## Project Summary
## What Actually Runs
## Runtime And Build
## Execution Flow
## Core Module Map
## Extension Points
## Known Noise And Constraints
## Documentation Drift
## Confidence And Remaining Gaps
## Suggested Reading Order
## Follow-up Questions
```

Under each heading, add 1-3 instruction bullets telling the skill what belongs there. Include an explicit rule that `Documentation Drift` and `Confidence And Remaining Gaps` must never be omitted when relevant.

- [ ] **Step 2: Write `repo-notes.md` with repository-specific facts**

Create this structure:

```md
# Repository Notes For Claude Code Best

## Key Facts
- `src/entrypoints/cli.tsx` is the effective entrypoint.
- `feature()` is hardcoded to `false` in this build.
- `src/main.tsx` is the startup orchestration layer.
- `src/query.ts` is the main conversational turn loop.
- `src/QueryEngine.ts` manages higher-level session state.
- `src/skills/loadSkillsDir.ts` is central to local skill loading.

## Analysis Warnings
- Do not treat decompilation type noise as proof of runtime failure.
- Prefer code over docs when they disagree, but record the drift.
- Separate active paths from gated or stubbed paths.

## Default Reading Order
- `AGENTS.md`
- `README.md`
- `package.json`
- `src/entrypoints/cli.tsx`
- `src/main.tsx`
- `src/query.ts`
- `src/QueryEngine.ts`
- `src/tools.ts`
- `src/Tool.ts`
- `src/skills/loadSkillsDir.ts`
```

Expected: the notes mention only files that actually exist in this repository.

- [ ] **Step 3: Verify every referenced repository file exists**

Run:

```bash
rg --files | rg '^(AGENTS\.md|README\.md|package\.json|src/entrypoints/cli\.tsx|src/main\.tsx|src/query\.ts|src/QueryEngine\.ts|src/tools\.ts|src/Tool\.ts|src/skills/loadSkillsDir\.ts)$'
```

Expected: all referenced files appear in the command output.

- [ ] **Step 4: Commit the template and repo notes**

Run:

```bash
git add .claude/skills/project-analysis/references/report-template.md .claude/skills/project-analysis/references/repo-notes.md
git commit -m "feat: add project-analysis report template and repo notes"
```

Expected: a commit exists containing only the two new reference files.

## Chunk 2: Wire the Skill and Validate It

### Task 4: Create the `SKILL.md` entrypoint

**Files:**
- Create: `.claude/skills/project-analysis/SKILL.md`

- [ ] **Step 1: Write the frontmatter exactly as planned**

Start the file with:

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

Expected: the frontmatter stays minimal and does not include `context: fork`, `arguments`, or broad shell permissions.

- [ ] **Step 2: Write the workflow body with explicit reference loading rules**

Include these sections and responsibilities:

```md
# Project Analysis

## Goal
- Produce a concise project overview, then write a dated report to `docs/analysis/`.

## Read First
- Read `references/repo-notes.md` at the start of every run.
- Read `references/checklist.md` before drafting the summary.
- Read `references/report-template.md` before producing the final report.
- Read `references/quality-gate.md` before deciding whether to run autoresearch.

## Workflow
1. Load repository context.
2. Map the repository shape.
3. Trace the active execution path.
4. Inspect extension points.
5. Identify noise, constraints, and drift.
6. Draft a terminal summary and in-memory report.
7. Run the quality gate.
8. If needed, run one bounded autoresearch retry.
9. Return the final summary and write `docs/analysis/YYYY-MM-DD-project-analysis.md`.

## Output Rules
- Always include a one-sentence summary.
- Always include suggested reading order.
- Always include `Documentation Drift` and `Confidence And Remaining Gaps` when relevant.
- Never hide residual uncertainty after the quality gate.
```

Expected: the skill body tells the model exactly when to read each reference file and how the autoresearch cap works.

- [ ] **Step 3: Add repository-specific guidance without duplicating the reference files**

Add a short section such as:

```md
## Repository Biases
- This repository is a Bun CLI with reverse-engineered code and disabled feature-flag branches.
- Prefer code over docs when they diverge, but call out the divergence explicitly.
- Treat decompilation type noise as context, not as the main conclusion.
```

Expected: `SKILL.md` stays compact and points to `references/` instead of duplicating them verbatim.

- [ ] **Step 4: Run static metadata validation on `SKILL.md`**

Run:

```bash
rg -n "^(name:|description:|allowed-tools:|disable-model-invocation:|user-invocable:)" .claude/skills/project-analysis/SKILL.md
```

Expected: all required frontmatter keys appear exactly once.

- [ ] **Step 5: Verify that every referenced file path exists**

Run:

```bash
rg -n "references/(repo-notes|checklist|report-template|quality-gate)\\.md" .claude/skills/project-analysis/SKILL.md
find .claude/skills/project-analysis/references -maxdepth 1 -type f | sort
```

Expected: all four reference files are present and named exactly as referenced by `SKILL.md`.

- [ ] **Step 6: Commit the skill entrypoint**

Run:

```bash
git add .claude/skills/project-analysis/SKILL.md
git commit -m "feat: add project-analysis skill entrypoint"
```

Expected: the commit contains only the new `SKILL.md`.

### Task 5: Run static and interactive verification

**Files:**
- Verify: `.claude/skills/project-analysis/**/*`
- Verify runtime output: `docs/analysis/YYYY-MM-DD-project-analysis.md`

- [ ] **Step 1: Verify the repository-local skill is discoverable on disk**

Run:

```bash
find .claude/skills -maxdepth 2 -name SKILL.md | sort
```

Expected: `.claude/skills/project-analysis/SKILL.md` appears in the results.

- [ ] **Step 2: Launch the CLI in this repository**

Run:

```bash
bun run dev
```

Expected: the REPL opens successfully from this repository root.

- [ ] **Step 3: In the REPL, confirm the skill is listed**

Manual action inside the REPL:

```text
/skills
```

Expected: `project-analysis` appears as a local, user-invocable skill.

- [ ] **Step 4: In the REPL, invoke the skill**

Manual action inside the REPL:

```text
/project-analysis
```

Expected: the assistant produces a concise summary and writes `docs/analysis/<today>-project-analysis.md`.

- [ ] **Step 5: Inspect the generated report after the skill runs**

Run:

```bash
rg -n "^(## )" docs/analysis/$(date +%F)-project-analysis.md
```

Expected: the report includes at least `Documentation Drift` and `Confidence And Remaining Gaps`.

- [ ] **Step 6: Handle blocked end-to-end verification honestly**

If the REPL cannot invoke the skill because API credentials or model access are unavailable, do this instead:

```bash
printf "Blocked: missing runtime credentials for end-to-end /project-analysis verification on $(date +%F)\n" >> /tmp/project-analysis-verification.log
```

Expected: the implementation notes clearly distinguish static verification from blocked runtime verification. Do not claim the skill ran successfully if it did not.

### Task 6: Address verification findings and close the loop

**Files:**
- Modify as needed: `.claude/skills/project-analysis/SKILL.md`
- Modify as needed: `.claude/skills/project-analysis/references/checklist.md`
- Modify as needed: `.claude/skills/project-analysis/references/quality-gate.md`
- Modify as needed: `.claude/skills/project-analysis/references/report-template.md`
- Modify as needed: `.claude/skills/project-analysis/references/repo-notes.md`

- [ ] **Step 1: Fix the smallest set of issues found during verification**

Examples of acceptable fixes:

```text
- missing frontmatter key
- wrong reference file path
- unclear autoresearch cap wording
- missing required report section
- incorrect repository note
```

Expected: only verification-driven fixes are made; no scope creep.

- [ ] **Step 2: Re-run the relevant verification step**

Run the minimum necessary command again:

```bash
rg -n "^(name:|description:|allowed-tools:|disable-model-invocation:|user-invocable:)" .claude/skills/project-analysis/SKILL.md
```

and, if runtime access is available, repeat:

```text
/skills
/project-analysis
```

Expected: the specific failure you fixed no longer reproduces.

- [ ] **Step 3: Commit the final polish**

Run:

```bash
git add .claude/skills/project-analysis
git commit -m "feat: finalize project-analysis skill"
```

Expected: the final commit contains only verification-driven changes.

## Notes For The Implementer

- There is no dedicated automated test runner for local skill packages in this repository today. Treat static file validation plus manual REPL validation as the required verification baseline.
- Do not pre-create `docs/analysis/*.md` files in the implementation branch. The skill should create them only when invoked.
- Keep `SKILL.md` concise. Push detailed checklists and templates into `references/`.
- The autoresearch quality gate is intentionally bounded to one retry pass. Preserve that guardrail in wording and behavior.
