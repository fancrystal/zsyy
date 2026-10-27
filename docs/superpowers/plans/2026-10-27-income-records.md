# Income Records Implementation Plan

**Goal:** 展示总收益与两类收益明细，统一网站收益用语。

**Architecture:** 从 wallet_ledger 的 direct_referral_reward 和 team_rebate 统计实际到账收益。新增当前用户收益接口，分别分页；共享状态负责会话隔离，个人管理页面消费接口。

**Tech Stack:** Vue 3, Vitest, Node.js, MySQL, node:test.

## Global Constraints

- 邀请链接不改；结算比例和原有数据库标识不变。
- 总收益为全部已到账推荐收益与团队佣金之和。
- 所有用户可见旧称统一为收益；兼容历史流水。

## Steps

- [x] 先添加组件测试：推荐收益20.00 + 团队佣金800.00 = 总收益820.00，分别显示两类记录。
- [x] 添加后端集成测试：`GET /api/me/income` 返回完整汇总、独立分页，过滤发券及消费；未登录请求返回401。
- [x] 运行新增测试并确认因缺少新行为失败。
- [x] 在 queries.js 增加 incomeSummary 和 incomeRecords，app.js 注册身份验证后的接口。
- [x] store.js 增加收益状态与请求版本保护；ProfileView.vue 展示总额与两类明细。
- [x] 同步前后台、演示及历史流水的可见文案，保留账本类型。
- [x] 添加团队弹窗回归断言，覆盖推荐收益 20% 的直接推荐范围，以及团队佣金 10%、最大市场排除和差额补发规则。
- [x] 运行 UI、后端与共享测试、构建，审查差异并请求独立代码审查。

## Validation

2026-10-27: `node scripts/test.mjs` passed: 7 shared tests, 33 UI tests, 16 backend integration tests. `node scripts/build.mjs` built both H5 and admin successfully; `git diff --check` passed. The local Docker database service was started for integration verification. Independent review is tracked in this task conversation. No production deployment performed.
