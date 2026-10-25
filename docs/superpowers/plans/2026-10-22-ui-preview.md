# UI 预览实施计划

目标：在当前目录提供 mskj 深蓝风格的手机四页和独立后台本地预览。

架构：两个 Vue 3 + Vite 应用，共用纯 JavaScript 演示模型、浏览器状态和图标组件；不连接后端。沿用 pnpm workspace。

## 约束

- 以 [UI 设计](../../08-ui-design.md) 为范围，所有交易和账号标注为演示。
- 不实现线上现金交易、充值、退款、取消、确认收货或物流状态。
- 金额按整数最小单位处理，历史订单保留商品和地址快照。

## 任务一：工程与演示模型

文件：根 package.json、pnpm-workspace.yaml、.gitignore；packages/shared/demo.mjs、demo.test.mjs、store.js、Icon.vue；两个应用的 package.json、index.html、vite.config.js。

- [x] 建立两个前端入口和 workspace，固定从参考项目确认的依赖版本。
- [x] 先写并运行演示模型测试，确认缺少模型时失败。
- [x] 实现 createDemoState、placeDemoOrder、grantDemoVoucher、saveDemoAddress、rebateSummary。
- [x] 测试不足余额、重复请求、正整数数量、上架校验、价格变化、快照冻结、发券和返利展示公式。
- [x] 在 store 中将演示状态持久化为单个 JSON，失败不覆盖当前页面状态。

## 任务二：手机 UI

文件：packages/mobile-h5/src/App.vue、style.css、views/HomeView.vue、MallView.vue、OrdersView.vue、ProfileView.vue、components/Modal.vue、ProductArt.vue。

- [x] 创建四页导航、品牌样式和移动安全区。
- [x] 接入商城搜索、详情、演示下单、订单查询和详情。
- [x] 接入地址、团队、返利、流水和邀请弹层，错误显示在当前操作区域。
- [x] 构建并在 390px 与 320px 宽度检查遮挡和横向溢出。

## 任务三：后台及交付

文件：packages/admin/src/App.vue、style.css；README.md、docs/README.md。

- [x] 创建后台概览及业务菜单，接入可用的本地演示交互。
- [x] 任务页面明确后端未接入，不能显示伪造的任务成功状态。
- [x] 运行模型测试及两个前端构建，检查真实浏览器主要交互。
- [x] 更新 README 的运行方式和演示边界，交付本地地址。

本轮不创建 Git 仓库或提交，当前目录没有 .git。后端实施另按阶段方案推进。

## 首次验证记录（2026-10-22）

当日模型 7 项测试和两个前端构建通过；浏览器验证演示购买、地址编辑、团队展示、商品编辑、上下架与发券同步，保存了预览截图。后续状态以 [2026-10-24 本地检查](../../09-local-audit-2026-10-24.md) 为准。
