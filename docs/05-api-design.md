# API 与页面交互约定

以下为计划接口，不代表已实现。统一前缀 `/api`，JSON 响应。金额输出为券数十进制字符串，大整数 ID 输出字符串。分页默认 20 条，上限 100 条。

成功响应使用 `{ "data": ... }`；分页返回 `{ "data": { "items": [], "page": 1, "pageSize": 20, "total": 0 } }`。失败返回 `{ "error": { "code": "INSUFFICIENT_BALANCE", "message": "产品券余额不足", "requestId": "..." } }`。

## 公开及认证接口

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/health` | 基础健康状态，不泄露连接信息 |
| GET | `/company` | 公司介绍 |
| GET | `/products` | 上架商品分页 |
| GET | `/products/:id` | 上架商品详情 |
| POST | `/auth/register` | 用户名、密码、邀请码注册 |
| POST | `/auth/login` | 用户登录 |
| POST | `/admin/auth/login` | 管理员登录 |

注册输入 `username`、`password`、`inviteCode`，用户及钱包创建在同一事务。密码哈希、邀请码有效性和用户名唯一性均由服务端校验。

## 用户接口

以下接口需用户身份，只作用于当前用户，不接受客户端传入任意 userId 作为授权依据。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/me` | 用户资料及邀请码 |
| PATCH | `/me` | 修改昵称 |
| GET | `/me/address` | 默认地址，没有时返回 null |
| PUT | `/me/address` | 保存收件人、电话、地区、详细地址 |
| GET | `/me/wallet` | 当前产品券余额 |
| GET | `/me/wallet/ledger` | 收支流水分页 |
| GET | `/me/team` | 直属市场分页、总消费、最大市场摘要 |
| GET | `/me/rebates` | 累计应得、已发及返利明细分页 |
| POST | `/orders` | 使用产品券下单 |
| GET | `/orders` | 本人订单分页 |
| GET | `/orders/:id` | 本人订单详情 |

### 下单请求

请求头 `Idempotency-Key` 必填，客户端首次确认购买时生成并在网络重试时复用。请求体：

```json
{
  "productId": "123",
  "quantity": 2,
  "expectedUnitPrice": "50.00"
}
```

`expectedUnitPrice` 仅用于发现价格变化，实际计价以服务端为准。服务端读取当前默认地址并写入订单快照。商品价格变化返回 `PRICE_CHANGED`，页面展示新价格并要求重新确认后使用新幂等键提交，不能静默按新价扣券。

首次成功返回 HTTP 201，包含订单和余额；同键同内容重试返回原订单 HTTP 200，不再扣券。同键不同内容返回 HTTP 409。事务失败的请求可使用原键重试。

## 后台接口

所有 `/admin` 业务接口均需管理员身份，与手机用户身份隔离。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET / PUT | `/admin/company` | 查询和更新公司介绍 |
| GET / POST | `/admin/products` | 查询全部商品、创建商品 |
| PATCH | `/admin/products/:id` | 编辑及上下架 |
| GET | `/admin/users` | 用户分页和精确筛选 |
| GET | `/admin/users/:id` | 用户详情、余额和关系 |
| POST | `/admin/users/:id/voucher-grants` | 发放正数产品券，必须带幂等键和备注 |
| GET | `/admin/users/:id/wallet/ledger` | 用户账务记录 |
| GET | `/admin/users/:id/team` | 用户直属市场统计 |
| GET | `/admin/orders` | 订单查询，支持订单号、用户及时间区间 |
| GET | `/admin/orders/:id` | 订单及收货地址快照 |
| GET | `/admin/rebates` | 返利记录查询 |
| GET | `/admin/job-runs` | 每日补查记录 |
| GET | `/admin/reconciliation-issues` | 对账异常查询 |

首版不提供改上线、改余额、删流水、手动退款或任意 SQL 执行接口。数据库维护由开发者使用独立命令或受控 SQL 完成。

## 失败语义

| HTTP | code 示例 | 页面行为 |
| --- | --- | --- |
| 400 | `INVALID_INPUT` | 标注输入问题 |
| 401 | `UNAUTHENTICATED` | 跳转对应登录页 |
| 403 | `FORBIDDEN` | 显示无权操作 |
| 404 | `NOT_FOUND` | 显示记录不存在，不泄露他人记录 |
| 409 | `INSUFFICIENT_BALANCE` / `PRICE_CHANGED` / `PRODUCT_UNAVAILABLE` / `ADDRESS_REQUIRED` / `IDEMPOTENCY_CONFLICT` | 明确业务原因，保留页面输入 |
| 429 | `RATE_LIMITED` | 提示稍后重试 |
| 500 / 503 | `INTERNAL_ERROR` / `TEMPORARILY_UNAVAILABLE` | 显示请求编号；重试下单复用原幂等键 |

前端提交时禁用重复按钮，但最终防重必须由后端实现。前端不计算权威余额或返利，成功后刷新余额、订单和团队摘要。
