# Quality Review

## Self-Feedback Summary

- Repository identity clarity: strong
  - 仓库被明确定位为“Bun + Ink + query loop + tools/MCP/skills/hooks 的反编译 CLI monorepo”，没有被泛化成普通 app。
- Execution-path specificity: strong
  - 已明确拆开 `cli.tsx -> main.tsx -> REPL.tsx -> query.ts` 与 `cli.tsx -> main.tsx -> print.ts -> QueryEngine -> query.ts` 两条主路。
- Evidence strength: strong
  - 关键结论都落在入口文件、registry、build 脚本和主 loop 上。
- Extension-point usefulness: strong
  - 已把 tools / commands / skills / plugins / MCP / hooks 的修改入口拆开。
- Documentation drift coverage: strong
  - 不仅覆盖了 build、test/lint、plugins、LSP、voice，还补充了 docs 站总览页对 interactive/headless 编排层的误导，并单独整理了 drift matrix。
- State / persistence coverage: strong
  - 已补足 `AppStateStore`、`onChangeAppState`、`messageQueueManager`、`sessionStorage`、task framework 这些第一版还偏薄的横切机制。
- Residual uncertainty honesty: strong
  - 明确声明没有实际跑完整 CLI，也没有逐页审计 docs 站。

## Weak Spots Found Before Finalization

- “Plugins / Marketplace removed” 与代码树冲突最明显，必须补核验，否则报告会在这点上失真。
- “Voice/LSP removed” 也存在类似问题，需要区分“代码不存在”与“feature gate 关闭”。
- 第一版对状态层、消息队列、resume/sidechain、background task 的解释不够像维护 handoff，容易让读者知道主链路但不知道跨模块问题从哪查。

## Bounded Autoresearch Pass

- Trigger:
  - 根级文档对 plugin / LSP / voice 的状态判断和代码现实矛盾，同时需要确认 interactive 分支是否真的经过 `QueryEngine`，以及补全状态/持久化/后台任务这些第一版覆盖不够深的部分。
- Files inspected:
  - `src/commands/plugin/index.tsx`
  - `src/services/lsp/manager.ts`
  - `src/screens/REPL.tsx`
  - `src/main.tsx`
  - `src/state/AppStateStore.ts`
  - `src/state/onChangeAppState.ts`
  - `src/utils/messageQueueManager.ts`
  - `src/utils/sessionStorage.ts`
  - `src/tasks/LocalMainSessionTask.ts`
  - `docs/introduction/architecture-overview.mdx`
- What changed after retry:
  - 将“已移除”修正为更精确的三类：
    - plugin: 仍有命令与加载基础设施
    - LSP: 仍有 manager 与可选 tool
    - voice: 仍有代码，但当前构建默认 gate off
  - 修正执行流描述：
    - interactive: `REPL.tsx` 直接调用 `query()`
    - headless/SDK: `print.ts` 通过 `QueryEngine` 再落到 `query()`
  - 增补横切结构描述：
    - `AppState` 是 session control plane
    - `onChangeAppState` 是 mode/config/env 副作用闸门
    - `messageQueueManager` 是 REPL/print 共用调度器
    - `sessionStorage` 是 transcript/resume/sidechain 基础设施
    - main session backgrounding 复用 task framework，而不是单独旁路实现

## Remaining Uncertainty

- 未执行运行时验证，所以 provider-specific、policy-specific、enterprise-only 行为仍基于静态证据判断。
- feature-gated 分支没有做第二轮广泛调查，报告只把它们作为“非当前构建热路径”处理。
- docs 站只做了抽样页审计，不声称整站文档都已核对完毕。

## Final Verdict

- 质量门通过。
- 这份报告现在不仅能回答“当前构建真正会跑什么”，也能回答“状态/持久化/后台任务出问题时该先看哪一层”。
