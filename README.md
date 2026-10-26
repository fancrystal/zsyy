# 产品券商城

面向手机浏览器的产品券商城，包含用户 H5、独立管理后台和 Express API。沿用参考项目 `D:\work\mskj\backups\project\mskj` 的 Vue 3、Vite、Node.js、Express、MySQL 技术路线，在当前目录独立搭建。

**当前状态（2026-10-25）：默认页面已接入真实 MySQL 业务，支持账号、邀请码、商品、产品券、订单、团队差额返利和每日补查。** 本地开发环境已准备；尚未发布到远程服务器。

## 本地启动

环境：Node.js 22.12+、pnpm 10.15.0、MySQL 8+。本机 Docker 容器名为 `zsyy-mysql`，MySQL 仅本机监听 3308，使用独立开发和测试数据库。

```powershell
docker start zsyy-mysql
pnpm install
pnpm dev
```

本机没有全局 pnpm 时：

```powershell
node .tools/node_modules/pnpm/bin/pnpm.cjs install --store-dir .cache/pnpm
node scripts/dev.mjs
```

新环境可通过 `node scripts/setup-local.mjs` 准备独立 Docker MySQL 及忽略的本地配置；使用已有 MySQL 时，复制 `.env.example` 到 `.env` 并填写连接信息，再运行 `node packages/backend/src/initialize.js`。已有配置和数据不会被初始化脚本清空。

| 入口 | 地址 |
| --- | --- |
| 手机端 | http://localhost:3011/ |
| 独立后台 | http://localhost:3011/admin/ |
| 健康接口 | http://localhost:3011/api/health |
| 后端 API | http://127.0.0.1:3000/api/ |

手机与电脑同一网络时，把 localhost 替换为电脑当前局域网 IP。真实数据存储在数据库，支持多设备访问；正常模式不读取演示余额。

本机管理员和根用户的初始账号密码见忽略文件 `.cache/development-accounts.md`。根用户登录后可分享邀请码，普通用户通过邀请码注册。初始余额为 0，由后台发券。登录凭据使用各自 HttpOnly Cookie，不写入 localStorage。

## 功能

| 模块 | 内容 |
| --- | --- |
| 首页 | 公司介绍、品牌展示图片，后台维护 |
| 商城 | 商品搜索、分类、分页、详情、数量选择、产品券购买 |
| 订单 | 本人订单分页、订单号搜索、商品及下单地址快照 |
| 管理 | 个人资料、默认地址、产品券余额及流水、邀请码与注册链接、团队、返利明细、退出登录 |
| 后台 | 管理员登录、运营概览、商品新增编辑与上下架、图片 URL 和分类、用户查询及详情、指定用户发券、订单筛选、返利查询、公司内容、补查和异常记录 |

产品券仅通过后台发放或开发者维护，不提供充值、线上现金交易、提现、退款、取消订单、确认收货或线上物流。下单扣券即记消费，收货信息用于线下发货。

## 返利规则

- 每人只有一个上线，一个上线可邀请多个下线；用户绑定后不可更换。
- 每个直属下线及其全部后代构成一个子市场。
- 直属下线每次成功购买，直接上级即时获得该订单实际消耗产品券的 20% 直推收益；仅适用于规则上线后的订单，不向更高层级重复发放。
- 最大市场按历史累计消费动态判断，并列只排除一个。
- **累计应得 =（所有子市场累计消费之和 − 最大市场累计消费）× 10%。**
- **本次补发 = 累计应得 − 已发累计**，仅发正差额，以产品券入账。
- 下单事务内逐级更新所有祖先市场并补发；每日北京时间 02:00 再补查，启动时补跑。
- 后台发券、直推收益和团队返利到账本身不是消费，使用产品券购买才计入消费。
- 任务分批持久化进度，来源账务异常会暂停相关账户自动返利，负差额不自动扣回。

## 开发与验证

```powershell
node scripts/test.mjs
node scripts/build.mjs
node scripts/smoke.mjs
```

`test.mjs` 包括模型、组件和独立 MySQL 测试库的接口测试；测试库必须与开发库不同且以 `_test` 结尾。`smoke.mjs` 在开发库保留独立联调用户、一次发券和一次订单，用幂等键支持重跑，不在生产执行。

构建输出：`packages/mobile-h5/dist` 与 `packages/admin/dist`；后台资源前缀 `/admin/`。开发 API 通过两个 Vite 服务代理至 3000。真实业务入口不带 preview 参数；旧演示入口仅在 `/?preview=1` 或 `/admin/?preview=1` 启用，演示数据与 MySQL 隔离。

## 项目结构

```text
packages/backend/     Express、MySQL、账务事务、补查与维护命令
packages/mobile-h5/   手机四页及登录注册
packages/admin/       独立管理后台
packages/shared/      API 客户端、账户状态与公共组件
scripts/              本地准备、启动、构建、测试、HTTP 验收
deploy/               现有服务器的 Nginx 和 systemd 配置示例
docs/                 业务规则、设计与运行文档
```

## 文档

- [运行、真实业务与维护指南](docs/10-fullstack-guide.md)
- [业务与返利规则](docs/02-business-rules.md)
- [需求范围](docs/01-product-requirements.md)
- [框架设计](docs/03-architecture.md)
- [数据库设计](docs/04-database-design.md)
- [API 设计基线](docs/05-api-design.md)
- [UI 设计](docs/08-ui-design.md)
- [历史检查报告](docs/09-local-audit-2026-10-24.md)
- [完整文档索引](docs/README.md)

账务以 MySQL 为准，Redis 不作为必要依赖。首版账务写入采用数据库互斥行保证并发正确性；批次补查释放锁并保存游标，生产高吞吐优化留待实际容量验证。维护 SQL 前备份并停止受影响账务写入，优先使用已提供的维护命令。
