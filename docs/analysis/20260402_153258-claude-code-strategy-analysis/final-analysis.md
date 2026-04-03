# Claude Code Strategy Analysis

## Project Summary

这个仓库本质上是一个已经能运行的 Bun 终端 agent CLI，不是纯概念 demo。它已经具备 query loop、工具系统、会话持久化、记忆、cron、resume、以及多 agent/team 的骨架；但同时它也是反编译工程，很多代码路径只是“可读”而不是“当前 external build 可用”。所以围绕你的 10 个问题，最重要的不是凭空设计，而是先识别哪些能力已经在源码里有自然落点。

## What Actually Runs

当前真实热路径是：

- `src/entrypoints/cli.tsx` 注入运行时 polyfill，并把 `feature()` 固定成 `false`
- `src/main.tsx` 解析 CLI、初始化服务、REPL、resume、cron、session persistence
- `src/QueryEngine.ts` 负责回合状态、transcript 写入、恢复与压缩编排
- `src/query.ts` 执行多轮 agentic loop
- `src/services/api/claude.ts` 与 `src/services/api/withRetry.ts` 负责请求构造、重试、fallback、配额与 attribution
- 记忆、team、cron、工具、hooks 作为外围系统接入

下面逐条回答你的 10 个问题。

## 1. 记忆系统，怎么管理记忆

### 仓库里现在有什么

这个仓库其实已经有三层记忆：

- 持久个人记忆：`src/memdir/memdir.ts` + `src/memdir/paths.ts`
  - 结构是 `MEMORY.md` 作为索引，主题文件作为实体内容
  - `getAutoMemPath()` 会把记忆落到按 repo root 归一化后的目录
  - `truncateEntrypointContent()` 明确给 `MEMORY.md` 设了行数和字节上限，避免索引膨胀
- 会话记忆：`src/services/SessionMemory/sessionMemory.ts`
  - 用模板化 session notes 维护“当前状态 / 任务规格 / 文件函数 / 错误修正 / 工作流”等章节
  - `sessionMemoryUtils.ts` 里有初始化阈值、增量更新阈值、tool-call 间隔等控制
  - 还能被 `sessionMemoryCompact.ts` 用于 compaction，而不是只做记录
- 团队共享记忆：`src/services/teamMemorySync/index.ts` + `watcher.ts`
  - repo 维度同步
  - 有 checksum、delta upload、optimistic locking
  - `teamMemSecretGuard.ts` 和 `secretScanner.ts` 明确阻止把 secret 写进 team memory

此外还有一个“夜间蒸馏层”：

- `src/services/autoDream/autoDream.ts` 会在时间和 session 数阈值满足时触发 consolidation
- `src/services/extractMemories/extractMemories.ts` 会在回合末运行一个 memory extraction subagent，把最近消息提炼为记忆

### 这说明什么

这个仓库并不缺“有没有记忆”这一层，而是缺一个统一的记忆治理模型。现在的系统更像：

- session memory 负责当前会话 continuity
- auto memory 负责个人长期偏好和项目知识
- team memory 负责 repo 共享知识
- auto dream 负责定时浓缩

这是一个很好的基础，因为边界已经天然分层了。

### 我建议怎么管理

基于现有源码，最自然的记忆治理方式不是再造一个单体 memory service，而是把它正式定义成四级生命周期：

1. `Session scratchpad`
   - 由 `SessionMemory` 维护，只服务当前会话恢复和压缩
2. `Personal persistent memory`
   - 由 `memdir` 维护，只存未来会复用、且不应进 team scope 的信息
3. `Repo shared memory`
   - 由 `teamMemorySync` 维护，只存团队共享知识，必须过 secret guard
4. `Dream / consolidation`
   - 由 `autoDream` 负责把碎片日志蒸馏成主题知识

如果你要把这套东西产品化，我会把“写什么记忆、写到哪一层、什么时候蒸馏、什么时候淘汰”做成一个单独的 policy 层，而不是让每个子系统自己决定。

## 2. 反蒸馏模式

### 仓库里现在有什么

源码里已经能看到至少三种“反蒸馏/防暴露”思路：

- API 侧 anti-distillation 标记：
  - `src/services/api/claude.ts` 里明确有 `anti_distillation = ['fake_tools']`
  - 但它挂在 `feature('ANTI_DISTILLATION_CC')` 和 runtime gate 后面，当前 external build 基本不会生效
- 输出侧 distillation-resistant 模式：
  - `src/utils/streamlinedTransform.ts` 直接把它命名为 `"distillation-resistant" output format`
  - 它会保留文本，但汇总工具调用、去掉 thinking、去掉 init 里的 tool list/model info
- 对外暴露控制：
  - `src/utils/undercover.ts` 在 commit / PR 场景下隐藏内部模型代号和 attribution
  - `src/utils/fingerprint.ts` + `src/constants/system.ts` 会为请求生成 attribution fingerprint/header

### 这说明什么

这套仓库对“反蒸馏”的理解不是单点防护，而是三层：

- API 请求层告诉服务端“这是 anti-distillation traffic”
- 输出层尽量不给结构化中间信息
- 外部协作层避免在 commit/PR 中泄露模型身份与内部信息

### 我建议怎么做

如果把“反蒸馏模式”当成产品能力，不要把它只做成一个 API flag。基于现有代码，应该把它定义成一个 profile：

- `Ingress control`
  - 沿用 `anti_distillation` 元数据与 attribution header
- `Response shaping`
  - 默认使用 `streamlinedTransform` 风格，禁 thinking、禁完整工具列表、禁模型标识
- `Persistence hygiene`
  - transcript、share、export、PR attribution 都走去敏版本

也就是说，这个仓库里最有价值的不是那一行 `anti_distillation = ['fake_tools']`，而是已经存在的多层拼图。

## 3. 25W 次无效 API 调用

### 仓库里现在有什么

这个仓库已经在很多地方显式防“请求风暴”：

- `src/services/api/withRetry.ts`
  - 不是所有错误都重试
  - 429/529 有区分
  - 非 foreground source 的 529 直接丢弃，注释写得很清楚：避免 capacity cascade 时的 retry amplification
  - `x-should-retry`、subscriber 类型、persistent mode 都会影响策略
- `src/query.ts`
  - 对 blocking token limit、prompt-too-long、invalid_request 都有明确停机/恢复边界
  - `invalid_request` 不是无限重放
- `src/services/teamMemorySync/watcher.ts`
  - 有一个非常有价值的历史注释：某个 `no_oauth` 设备在 2.5 天里打了 167K push events
  - 所以现在它对 permanent failure 会设置 `pushSuppressedReason`，直到 unlink 或 session restart 才恢复

### 这说明什么

这表明仓库作者已经遇到过“本地 watcher / background subsystem 因不可恢复错误而疯狂重试”的真实事故。现在的代码不是没意识到这个问题，而是各处各自打补丁。

### 我建议怎么做

如果你担心的是“25 万次无效 API 调用”这种级别的问题，下一步不该只修某个重试函数，而是补一层统一的 `invalid call governor`：

- 按 subsystem 记录 error budget
  - query loop
  - team memory sync
  - cron/background jobs
  - remote-control / bridge
- 对 permanent failure 做本地熔断
  - 现在 watcher 已经这么做了，应该推广
- 对 transient failure 做分级 backoff
  - foreground 和 background 区别对待
- 对 `invalid_request` 做去重
  - 同类 payload / 同类 error 在时间窗内只记一次，不持续试探

单看源码，我会说：仓库已经有“局部止血”，但还没有“统一的无效调用控制面”。

## 4. 7x24 运行的 demo 版本

### 仓库里现在有什么

7x24 的运行面其实已经散落在多个模块里：

- 调度：
  - `src/utils/cronTasks.ts`
  - `src/hooks/useScheduledTasks.ts`
  - `src/tools/ScheduleCronTool/prompt.ts`
  - 支持 session-only 和 durable 两种 cron task
  - durable task 写到 `.claude/scheduled_tasks.json`
- 后台 housekeeping：
  - `src/utils/backgroundHousekeeping.ts`
  - 会拉起 auto dream、memory extraction、plugin autoupdate、cleanup
- 持久化与恢复：
  - `src/utils/sessionStorage.ts`
  - `src/QueryEngine.ts`
  - `src/main.tsx` 的 `--resume` / `--continue`
- 远程长连接形态：
  - `src/bridge/bridgeMain.ts`
  - 有持续 poll、capacity wake、resume 相关逻辑

### 这说明什么

做一个“7x24 demo 版”不需要从零搭 runtime。这个仓库已经有：

- scheduler
- durable state
- session persistence
- resume
- background chores

但它还不是一个开箱即用的生产常驻服务，因为：

- 一部分 daemon / bridge 能力仍受 feature gate 影响
- 长时运行能力分散在 REPL、cron、bridge、backgroundHousekeeping 几套逻辑里
- 没有一个统一 supervisor 把健康检查、预算、重试、熔断、可观测性串起来

### 我建议怎么做

如果只是 demo，我会基于现有代码拼出一个最小 7x24 版本：

1. durable cron 作为触发入口
2. session persistence + resume 作为 continuity
3. backgroundHousekeeping 负责 memory consolidation / cleanup
4. 单独加一个 watchdog，监控：
   - last successful turn
   - last API error reason
   - current retry budget
   - pending cron backlog

也就是说，这个仓库足够支撑“可跑的 7x24 demo”，但还不算“一体化运维面完整”。

## 5. 小模型做记忆管理

### 仓库里现在有什么

仓库已经有“小模型做辅助任务”的明确先例：

- `src/utils/model/model.ts` 定义了 `getSmallFastModel()`
- `src/services/awaySummary.ts` 直接用 small fast model 生成用户离开后的 recap
- 其他地方也把 Haiku/small-fast model 当成低成本辅助能力

但是记忆主链路并没有完全这么做：

- `SessionMemory` 在 `src/services/SessionMemory/sessionMemory.ts` 中通过 `runForkedAgent()` 跑 forked extraction
- `extractMemories` 也是 `runForkedAgent()` 驱动
- 这些路径继承了主上下文和 cacheSafeParams，但没有像 `awaySummary` 那样显式切到 `getSmallFastModel()`

### 这说明什么

你的第 5 点并不是“能不能做”，而是“现有仓库只做了一半”。源码已经证明：

- 小模型辅助任务这条思路是被接受的
- 但记忆抽取与记忆整理还没系统地下沉到小模型

### 我建议怎么做

如果你要“小模型做记忆管理”，最自然的切分是：

- small model:
  - session recap
  - memory classification
  - memory dedup
  - stale-memory pruning suggestion
  - team-memory conflict triage
- main model:
  - 真正影响主任务正确性的复杂记忆整合
  - 需要理解当前任务深上下文的长期记忆更新

换句话说，仓库里已经有 seam，但还没把记忆管理全面抽象成“cheap model control plane”。

## 6. agent team 模式

### 仓库里现在有什么

这块骨架已经很明显了：

- `src/tools/TeamCreateTool/TeamCreateTool.ts`
  - 可以创建 team，生成 team lead，初始化 task list
- `src/tools/shared/spawnMultiAgent.ts`
  - 统一 spawn teammate，支持 pane backend 或 in-process
- `src/tasks/InProcessTeammateTask/InProcessTeammateTask.tsx`
  - 管理 in-process teammate 生命周期
- `src/utils/swarm/inProcessRunner.ts`
  - 做 teammate context、permission bridge、mailbox、task claiming
- `src/utils/swarm/backends/registry.ts`
  - 决定 tmux / iTerm2 / in-process fallback
- `src/utils/agentSwarmsEnabled.ts`
  - 用 env / CLI flag / GrowthBook gate 控制功能开启

### 这说明什么

当前的 team mode 不是“没有”，而是“偏底层协作基建”：

- 有成员身份
- 有 team file
- 有 task list
- 有 mailbox
- 有 permission sync
- 有多 backend 执行环境

但它还不是一个成熟的 team operating model，因为：

- 角色分工基本靠 prompt，而不是明确的 orchestration policy
- 任务路由、记忆路由、验证职责还没做成固定编排

### 我建议怎么做

基于当前仓库，我会把 team mode 明确成四类角色：

- `Lead`
  - 负责规划、分配、收敛
- `Memory steward`
  - 负责 memory write / dedup / team memory hygiene
- `Executor`
  - 负责具体修改
- `Verifier`
  - 负责测试、review、回归验证

而不是所有 teammate 都共享同一种“通用 worker prompt”。现有 task 系统、mailbox、permission bridge 已经足够承载这个分工。

## 7. 怎么模块划分，做协作

### 仓库里现在有什么

按真实运行面看，仓库已经自然分成几层：

- entry/bootstrap:
  - `src/entrypoints/cli.tsx`
  - `src/main.tsx`
- core loop:
  - `src/QueryEngine.ts`
  - `src/query.ts`
- API/control plane:
  - `src/services/api/*`
  - `src/services/analytics/*`
- tool/runtime surface:
  - `src/tools.ts`
  - `src/tools/*`
- memory:
  - `src/memdir/*`
  - `src/services/SessionMemory/*`
  - `src/services/extractMemories/*`
  - `src/services/teamMemorySync/*`
- swarm/team:
  - `src/tools/TeamCreateTool/*`
  - `src/utils/swarm/*`
  - `src/tasks/*`
- UI and session persistence:
  - `src/screens/*`
  - `src/state/*`
  - `src/utils/sessionStorage.ts`

### 这说明什么

模块边界其实已经有雏形，但还不够“治理化”。最大的问题不是目录不够多，而是一些 cross-cutting concern 分散在多个 subsystem：

- retry / failure suppression
- memory routing
- workload attribution
- background execution
- gating

### 我建议怎么划分

如果为了后续多人协作，我会把这仓库收敛成 6 个一等模块：

1. `runtime-core`
   - CLI entry、main、query engine、query loop
2. `api-control-plane`
   - model selection、retry、quota、headers、telemetry
3. `tool-runtime`
   - tool registry、permission、tool execution
4. `memory-platform`
   - session memory、auto memory、team memory、dream
5. `multi-agent-platform`
   - team file、spawn、mailbox、task orchestration、backend routing
6. `quality-and-ops`
   - CI、health checks、fixtures、prompt dumps、watchdogs

协作上最关键的是让每个模块只有一个 owner surface，而不是多人同时改 `main.tsx`、`query.ts` 这种中心文件。

## 8. 质量管理体系，代码管理体系

### 仓库里现在有什么

源码显示这个仓库并不是完全没有质量体系：

- `package.json`
  - `bun run lint`
  - `bun run format`
  - `bun test`
  - `bun run check:unused`
  - `bun run health`
- `.githooks/pre-commit`
  - 会对 staged `src/` 文件跑 Biome lint
- `.github/workflows/ci.yml`
  - CI 里执行 install、lint、test、build
- `scripts/health-check.ts`
  - 汇总代码规模、lint、test、knip、build 状态

### 但也有明显问题

- `AGENTS.md` 写着 “No test runner is configured. No linter is configured.”
- 实际仓库却已经有 test/lint/CI
- 这意味着文档治理落后于代码治理

### 我建议怎么做

如果把它升级成完整的质量管理体系，我会分三层：

1. `Developer guardrails`
   - pre-commit lint
   - staged-file checks
2. `Repository gates`
   - CI 的 lint/test/build/unused checks
   - PR 必须通过
3. `Behavioral quality`
   - transcript-level regression
   - fixture/VCR-based request stability
   - multi-agent / memory / retry regression cases

也就是说，代码管理的基础件已经有了，真正缺的是：

- 文档同步
- 更强的行为回归门禁
- 对 memory/team/retry 这类复杂系统的专项质量指标

## 9. 怎么做 harness

### 仓库里现在有什么

仓库其实已经有不少 harness 零件：

- `src/services/vcr.ts`
  - 录制/回放 Anthropic API fixtures
- `src/services/api/dumpPrompts.ts`
  - 把请求与响应落到 dump-prompts，适合 prompt/eval 分析
- `src/query/deps.ts`
  - 允许 tests 注入 fake deps，而不是只能全局 spy
- `src/entrypoints/cli.tsx`
  - 有 `ABLATION_BASELINE` 注释和一组用于科学对照的 env 开关
- `src/utils/claudeCodeHints.ts`
  - harness-only side channel，说明仓库接受“模型不可见、框架可见”的测试/控制通道

### 这说明什么

这个仓库不是没有 harness，而是没有一个统一入口。现在是：

- VCR 一套
- prompt dump 一套
- eval/growthbook override 一套
- ablation env 一套
- targeted unit seams 一套

### 我建议怎么做

如果你要做真正可用的 harness，我会把现有碎片统一成四层：

1. `Request harness`
   - VCR fixtures
   - prompt dump
2. `Behavior harness`
   - query loop fake deps
   - tool orchestration replay
3. `Scenario harness`
   - memory extraction
   - team collaboration
   - retry/backoff/failure suppression
4. `Ablation harness`
   - 通过 env/profile 关闭 auto-memory、background、thinking、compact
   - 对比行为和成本

简单说，仓库已经具备做 harness 的 70% 材料，但还缺一个统一 runner 和统一场景集。

## 10. 封禁与设备标识

### 仓库里现在有什么

这块源码给出的结论非常明确：

- `src/utils/config.ts` 的 `getOrCreateUserID()`
  - 只是本地 config 中持久化的随机 32-byte hex
  - 删除 config 就能变
- `src/services/api/claude.ts`
  - 会把这个值作为 `device_id` 放进 metadata
- `src/utils/user.ts` / `src/services/analytics/growthbook.ts`
  - 也把它当 deviceId / deviceID 用于 analytics targeting
- `src/utils/fingerprint.ts`
  - 那个 fingerprint 不是设备指纹
  - 它只是“首条用户消息字符 + 版本号 + salt”算出来的 attribution fingerprint

### 这说明什么

当前仓库里的“device id”更像：

- 一个本地安装实例标识
- 一个 analytics / attribution 键

而不是一个强风控意义上的设备指纹。它没有硬件绑定，也没有抗重装、抗 config 删除、抗多实例伪造的能力。

### 我建议怎么做

如果你的问题是“怎么做封禁与设备标识”，那必须先接受一个事实：当前仓库没有可靠封禁底座。

更合理的设计应该分三层：

1. `Install identity`
   - 当前 `userID` 这种本地随机 ID 可以保留
   - 适合做轻量实例追踪
2. `Account-linked identity`
   - 结合 OAuth account UUID / org UUID
   - 适合账号级限制
3. `Risk identity`
   - 单独的 server-side risk fingerprint
   - 不能等同于本地 config 里的 `userID`

如果直接拿现在的 `device_id` 做封禁，误伤和绕过都会很严重。

## Cross-Cutting Conclusions

把 10 个问题放在一起看，我的判断是：

- 这个仓库最强的不是某个单点功能，而是已经具备一套 agent 平台骨架：
  - query loop
  - memory layers
  - team/mailbox/task
  - durable cron
  - transcript/resume
- 这个仓库最缺的不是“功能点”，而是统一控制面：
  - memory governance
  - invalid-call governor
  - team orchestration policy
  - harness runner
  - risk identity / abuse control

换句话说，如果你后面真的要沿这 10 个方向推进，不建议按 10 个零散需求去做，而应该按 5 个平台面去做：

1. memory platform
2. agent-team platform
3. scheduling/runtime platform
4. quality/harness platform
5. identity/risk platform

## Documentation Drift

- `AGENTS.md` 说没有配置测试和 lint
- 但 `package.json`、`.githooks/pre-commit`、`.github/workflows/ci.yml` 显示这些已经存在
- `AGENTS.md` 说 build 输出是单文件 bundle
- 实际 `build.ts` 启用了 `splitting: true`，README 也描述为 chunked build

## Confidence And Remaining Gaps

- 高置信度：
  - 记忆、team、cron、retry、identity 的核心判断
- 中等置信度：
  - 某些 ant-only / gated 路径在 external build 的可运行程度
- 明确缺口：
  - 我没有把所有 swarm backend 和 assistant-only 路径继续深挖到交互级别，因为这次目标是 10 个战略问题的源码归因，而不是逐模块调试

## Suggested Reading Order

1. `src/entrypoints/cli.tsx`
2. `src/main.tsx`
3. `src/query.ts`
4. `src/services/api/claude.ts`
5. `src/services/api/withRetry.ts`
6. `src/memdir/paths.ts`
7. `src/services/SessionMemory/sessionMemory.ts`
8. `src/services/extractMemories/extractMemories.ts`
9. `src/services/teamMemorySync/index.ts`
10. `src/tools/TeamCreateTool/TeamCreateTool.ts`
11. `src/tools/shared/spawnMultiAgent.ts`
12. `src/utils/cronTasks.ts`
13. `src/services/vcr.ts`
14. `package.json`
15. `.githooks/pre-commit`
16. `.github/workflows/ci.yml`
