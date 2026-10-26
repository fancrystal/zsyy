# 数据库设计

本文是逻辑模型，后续迁移负责创建具体 DDL、索引、外键和初始数据。数据库采用 MySQL 8+、InnoDB、utf8mb4。金额字段统一为整数最小券单位，字段名以 `_units` 结尾。时间统一存 UTC，业务日期按 Asia/Shanghai 换算。

## 用户与关系

### `users`

`id` 主键；`username` 唯一；`password_hash`；`nickname`；`invite_code` 唯一；`parent_id` 可空且引用 users；`created_at`、`updated_at`。普通注册的 parent_id 必填，根用户通过初始化创建。禁止自关联及环形关系，由服务及维护工具校验。索引 `(parent_id, id)` 支持直属市场查询。

### `user_addresses`

`id`；`user_id` 唯一；`recipient_name`；`phone`；`region_text`；`detail_address`；时间字段。首版一人一条默认地址，允许编辑。历史订单不关联读取当前地址，而读取快照。

### `admin_users`

`id`；唯一 `username`；`password_hash`；`enabled`；时间字段。与普通用户身份分离，由维护命令创建。

## 内容及商品

### `company_profile`

单条配置，保存名称、简介、正文文本、展示图片地址及更新时间。

### `products`

`id`；`name`；`description`；`image_urls`（JSON）；`price_units`（正整数）；`is_active`；`sort_order`；时间字段。索引 `(is_active, sort_order, id)`。首版无库存和规格表。图片首版通过可信图片 URL 配置，不额外建设上传平台。

## 钱包及流水

### `wallets`

`user_id` 主键；`balance_units`；时间字段。用户创建时同时创建钱包，余额不小于 0。采用行锁和条件更新保护扣减。

### `wallet_ledger`

`id`；`user_id`；`type`（admin_grant / order_spend / direct_referral_reward / team_rebate / manual_adjustment）；`amount_units`（有符号）；`balance_before_units`；`balance_after_units`；`source_key`；`admin_id` 可空；`note`；`created_at`。

`source_key` 全局唯一，如 `order:123:spend`、`rebate:456`、`grant:789`。索引 `(user_id, id)`。流水只追加，不覆盖或删除；合法调整以新流水表达。每条流水须满足前余额加变动等于后余额。

### `voucher_grants`

`id`；`user_id`；正数 `amount_units`；`admin_id`；`note`；`idempotency_key`；`created_at`。唯一 `(admin_id, idempotency_key)`，避免后台双击重复发券。发券和对应流水在同一事务写入。

## 订单

### `orders`

`id`；唯一 `order_no`；`user_id`；`product_id`；`product_snapshot`（名称、图片、单价）；`quantity`；`total_units`；`address_snapshot`；`idempotency_key`；`request_hash`；`created_at`。

唯一 `(user_id, idempotency_key)`；索引 `(user_id, id)` 和 `(created_at, id)`。快照使用 JSON，快照内金额使用整数字符串。首版一单一商品，不设状态机或订单明细表；成功事务才保留订单，失败整体回滚。`total_units` 必须等于快照单价乘数量。

### `direct_referral_rewards`

`id`；唯一 `order_id`；`beneficiary_user_id`（购买人的直接上级）；`buyer_user_id`；`order_total_units`；固定 `rate_bps=2000`；`reward_units`；`created_at`。每条记录对应一条 `direct_referral_reward` 正向钱包流水，金额为 `floor(order_total_units × 20 / 100)`；用于订单创建后即时入账，不由每日补查重算或追溯历史订单。

## 团队消费与返利

### `team_market_totals`

`owner_user_id`：受益上级；`direct_child_user_id`：其直属下线；`consumption_units`：该分支所有成功订单累计；`updated_at`。

复合主键 `(owner_user_id, direct_child_user_id)`。注册直属下线时建立零消费市场记录。只记录真实的直属子市场，祖先链逐级定位归属。汇总可由订单和关系重建，不作为手工消费录入入口。

### `rebate_accounts`

`user_id` 主键；`paid_units`（累计成功发放）；`entitled_units`（最近计算的累计应得）；`largest_market_child_id` 可空；`calculation_base_units`；`has_anomaly`；`updated_at`。

用于锁定每个受益人的结算状态，不以该表替代返利明细。`paid_units` 必须等于其成功返利记录的累计值。

### `rebate_records`

`id`；`user_id`；`trigger_type`（order / daily / maintenance）；`trigger_ref`；`total_market_units`；`largest_market_units`；`largest_market_child_id`；`eligible_units`；`entitled_units`；`paid_before_units`；正数 `granted_units`；`rate_bps`（1000，即 10%）；`created_at`。

唯一 `(user_id, entitled_units)` 作为累计目标防重，配合账户行锁；索引 `(user_id, id)`。每条记录对应唯一钱包流水，且 `granted_units = entitled_units - paid_before_units`。只有实际正差额发放才创建记录，零差额由任务统计体现。正常业务不撤回返利，因此累计目标单调增加；历史纠错不通过删除记录绕过唯一约束。

## 运营与任务

### `audit_logs`

管理员或维护者、操作类型、目标 ID、脱敏摘要、请求 ID、时间。记录内容修改、商品修改、发券及维护动作，不存密码和令牌。

### `job_runs`

任务名、业务日期、状态、尝试次数、游标、开始结束时间、扫描数、补发数和错误摘要。唯一 `(job_name, business_date)`；同一行追踪重试进度。任务提交游标不能早于对应业务事务成功提交。

### `reconciliation_issues`

用户或市场 ID、问题类型、期望值、实际值、首次及最近发现时间、处理状态、维护备注。用于余额、市场消费、返利累计不一致和负差额，不能用静默覆盖掩盖问题。

## 必须保持的不变量

1. 钱包余额等于全部账务流水净额，初始化余额为 0。
2. 每个成功订单对应且仅对应一条负向消费流水。
3. 每条成功团队返利记录和直推收益记录分别对应且仅对应一条正向钱包流水。
4. 已发返利累计等于返利明细之和。
5. 每个市场累计消费等于所属全部用户的成功订单金额之和。
6. 团队无环，订单快照完整，所有账务关联可追溯。
