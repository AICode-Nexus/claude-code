# Topic Analysis

## Topic

围绕当前仓库源码，逐一回答以下 10 个问题：

1. 记忆系统，怎么管理记忆
2. 反蒸馏模式
3. 25W 次无效 API 调用
4. 7x24 运行的 demo 版本
5. 小模型做记忆管理
6. agent team 模式
7. 怎么模块划分，做协作
8. 质量管理体系，代码管理体系
9. 怎么做 harness
10. 封禁与设备标识

## Target Audience

- 需要基于仓库现状讨论产品路线或工程路线的人
- 不是要立刻写代码，而是要看清“仓库已经有什么、还缺什么、最自然的演进路径是什么”

## Depth Levers

- Mechanism: 每个主题都要落到真实源码机制
- Tradeoff: 区分“当前能用”和“只是骨架”
- Failure mode: 指出仓库里已经显式防过的失控模式
- Implementation boundary: 明确哪些建议可以直接接在现有模块上，哪些需要新增控制面
- Decision checklist: 每个主题给出源码归因后的判断

## Success Metrics

- 每个问题都有明确的源码锚点
- 结论能区分事实、推断、建议
- 不把 feature-gated / stubbed 路径误判成现成能力
- 能让后续路线讨论直接复用
