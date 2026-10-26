# Direct Referral Reward Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Credit the direct parent with an immediate, non-retroactive 20% product-voucher reward for every successful child order, while preserving the existing 10% team-market rebate.

**Architecture:** Store direct rewards separately from cumulative team rebates. The purchase transaction inserts one `direct_referral_rewards` row per order and a corresponding wallet ledger entry for the direct parent, then continues the existing ancestor-market and team-rebate flow. Reconciliation audits the immutable direct-reward record and ledger but never recomputes or reissues it.

**Tech Stack:** Node.js, Express, MySQL 8, Vue 3, Vitest, Node test runner, pnpm.

## Global Constraints

- New 20% rewards apply only to orders created after this release; no historical backfill.
- The beneficiary is only the buyer's direct parent; higher ancestors receive no 20% direct reward.
- All rewards are product vouchers in smallest units, calculated as `floor(total_units * 20 / 100)`.
- One order has exactly one direct-reward record and one corresponding wallet ledger entry, including a zero-unit ledger entry if rounding produces zero.
- Existing 10% cumulative, largest-market-excluded team rebate semantics remain unchanged.
- Do not alter production company content or product catalogue as part of validation.

---

### Task 1: Persist and audit direct rewards

**Files:**
- Modify: `packages/backend/src/db/schema.js`
- Modify: `packages/backend/src/services/audit.js`
- Test: `packages/backend/tests/api.test.mjs`

**Interfaces:**
- Produces table `direct_referral_rewards(id, order_id, beneficiary_user_id, buyer_user_id, order_total_units, rate_bps, reward_units, created_at)`.
- Produces audit source key format `direct-referral:<rewardId>` and wallet type `direct_referral_reward`.
- Consumes the existing `issue(conn, userId, type, expected, actual)` anomaly mechanism.

- [ ] **Step 1: Write failing integration coverage for immutable direct rewards**

Add a test before the existing anomaly-injection tests. Build a new `parent -> directBuyer -> grandchild` invitation chain, grant balances and addresses, then purchase a 10,005-unit product with `directBuyer`. Assert parent wallet increases by 2,001, root and grandchild do not receive a 20% payment, and exactly one direct-reward row and matching ledger source exist. Re-send the identical order idempotency request and run reconciliation; assert the parent balance and reward row count do not change.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `pnpm test:backend -- --test-name-pattern "direct parent receives"`

Expected: FAIL because `direct_referral_rewards` does not exist and the parent balance has no direct reward.

- [ ] **Step 3: Add the schema migration**

Append this table to `tables` in `schema.js`, before `audit_logs`:

```js
`CREATE TABLE IF NOT EXISTS direct_referral_rewards (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL UNIQUE,
  beneficiary_user_id BIGINT UNSIGNED NOT NULL,
  buyer_user_id BIGINT UNSIGNED NOT NULL,
  order_total_units BIGINT NOT NULL,
  rate_bps INT NOT NULL,
  reward_units BIGINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(order_id) REFERENCES orders(id),
  FOREIGN KEY(beneficiary_user_id) REFERENCES users(id),
  FOREIGN KEY(buyer_user_id) REFERENCES users(id),
  INDEX(beneficiary_user_id,id),
  CHECK(order_total_units>0), CHECK(rate_bps=2000), CHECK(reward_units>=0)
) ENGINE=InnoDB`
```

Extend `auditAccount` to query rewards where `beneficiary_user_id=?`, derive expected sources as `direct-referral:${id}`, and validate each record against its order (`orders.user_id`, `orders.total_units`) and buyer's current `parent_id`. Record `direct_referral_source` when those values differ. Include these source records in the existing missing/orphan/type/amount ledger checks with expected type `direct_referral_reward`.

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run: `pnpm test:backend -- --test-name-pattern "direct parent receives"`

Expected: PASS after the purchase implementation in Task 2 is complete; schema-only failures are expected until then.

- [ ] **Step 5: Commit the persistence and audit work**

```bash
git add packages/backend/src/db/schema.js packages/backend/src/services/audit.js packages/backend/tests/api.test.mjs
git commit -m "feat: audit direct referral rewards"
```

### Task 2: Make order purchase credit the direct parent atomically

**Files:**
- Modify: `packages/backend/src/services/accounting.js`
- Test: `packages/backend/tests/api.test.mjs`

**Interfaces:**
- Produces `directReferralReward(conn, orderId, buyerId, orderTotalUnits)` called only inside `purchase`'s transaction.
- Returns the inserted reward ID or `null` for a root buyer.
- Uses source key `direct-referral:<id>`, type `direct_referral_reward`, title `直推收益`, and note `直属下线订单 20% 收益`.

- [ ] **Step 1: Keep the direct-reward integration test failing for the correct behavior**

Confirm the test from Task 1 fails only because no direct reward is paid, not because registration, grant, address, or order setup failed.

- [ ] **Step 2: Implement the minimal transaction helper**

In `accounting.js`, add a helper that:

```js
const buyer = await one(conn, 'SELECT parent_id FROM users WHERE id=? FOR UPDATE', [buyerId])
if (buyer.parent_id === null) return null
const rewardUnits = safeNumber(BigInt(orderTotalUnits) * 20n / 100n)
const result = await rows(conn,
  'INSERT INTO direct_referral_rewards(order_id,beneficiary_user_id,buyer_user_id,order_total_units,rate_bps,reward_units) VALUES(?,?,?,?,2000,?)',
  [orderId, buyer.parent_id, buyerId, orderTotalUnits, rewardUnits])
await changeBalance(conn, buyer.parent_id, rewardUnits, {
  type: 'direct_referral_reward', title: '直推收益', note: '直属下线订单 20% 收益', sourceKey: `direct-referral:${result.insertId}`
})
return String(result.insertId)
```

Call it immediately after the order-spend ledger entry and before the existing ancestor-market loop. Do not call it from reconciliation or from an idempotent replay branch.

- [ ] **Step 3: Run focused transaction tests**

Run: `pnpm test:backend -- --test-name-pattern "direct parent receives|purchase rejects missing address|parallel orders"`

Expected: PASS; retry yields one reward, failed purchase yields no reward, and concurrent spend remains protected.

- [ ] **Step 4: Add a root-buyer assertion**

Extend the direct-reward test with a funded root order and assert no `direct_referral_rewards` record is created for it.

- [ ] **Step 5: Run the backend suite**

Run: `pnpm test:backend`

Expected: all integration tests pass, including the original 10% team-rebate scenarios.

- [ ] **Step 6: Commit the transaction behavior**

```bash
git add packages/backend/src/services/accounting.js packages/backend/tests/api.test.mjs
git commit -m "feat: credit direct referral order rewards"
```

### Task 3: Surface the distinct reward in existing account views and documents

**Files:**
- Modify: `packages/mobile-h5/src/views/ProfileView.vue`
- Modify: `packages/admin/src/views/UsersView.vue`
- Modify: `README.md`
- Modify: `docs/02-business-rules.md`
- Modify: `docs/04-database-design.md`
- Modify: `docs/05-api-design.md`
- Test: `tests/live-auth.test.js` or the existing relevant Vitest view test

**Interfaces:**
- Consumes the existing wallet ledger API, whose `title` already returns `直推收益`.
- Leaves `/api/me/rebates` and `/api/admin/rebates` as 10% team-rebate-only APIs.

- [ ] **Step 1: Write a failing view test**

Add a focused assertion that a wallet-ledger item `{ type: 'direct_referral_reward', title: '直推收益', amountUnits: 2000 }` renders its title and positive amount in the profile ledger. If no component test can mount this view without disproportionate setup, add a small formatter/helper test in the existing UI test convention instead.

- [ ] **Step 2: Run the UI test and confirm RED**

Run: `pnpm test:ui -- --runInBand`

Expected: the new direct-reward display assertion fails until the view presentation is added or corrected.

- [ ] **Step 3: Update presentation and documentation**

Keep “累计返利” cards and the Team Rebate page labeled as the 10% team rule. In the wallet-ledger modal, render `direct_referral_reward` as a positive voucher line titled “直推收益”; use the ticket icon just as other wallet income does. In the admin user ledger table, preserve the returned title and add a visible “直推收益” explanation only where helpful.

Update product rules, database design, and API design with the non-retroactive direct-parent 20% rule, separate table, ledger type, and audit behavior. Update README's return rules to state that the 20% direct reward coexists with the 10% team-market rebate.

- [ ] **Step 4: Run UI tests and both frontend builds**

Run: `pnpm test:ui; pnpm build`

Expected: UI tests and mobile/admin Vite builds pass.

- [ ] **Step 5: Commit user-facing changes**

```bash
git add packages/mobile-h5/src/views/ProfileView.vue packages/admin/src/views/UsersView.vue README.md docs/02-business-rules.md docs/04-database-design.md docs/05-api-design.md tests
git commit -m "feat: show direct referral voucher rewards"
```

### Task 4: Verify, release, and validate production without backfill

**Files:**
- Modify only release artifacts generated by the documented deployment procedure.
- Verify: `deploy/zsyy-api.service`, `deploy/zsyy.production.conf`, `/opt/zsyy/current`, `/var/www/zsyy/current`.

**Interfaces:**
- Uses the existing isolated production service on `127.0.0.1:3020`, public H5, public admin site, and `zsyy_prod` database.
- Production `initialize()` migration is safe and idempotent; it creates the new empty table without backfilling old orders.

- [ ] **Step 1: Run the full fresh verification suite**

Run: `pnpm test; pnpm build; git diff --check`

Expected: all model, UI, and backend tests pass; both builds pass; no whitespace errors.

- [ ] **Step 2: Commit and push the release**

Commit any remaining release-safe source/docs changes, inspect `git status --short`, and push `main` to `https://github.com/fancrystal/zsyy.git`. Do not include unrelated uncommitted Nginx changes unless separately reviewed.

- [ ] **Step 3: Deploy source and static release atomically**

Create a timestamped `/opt/zsyy/releases/<timestamp>` source release and `/var/www/zsyy/releases/<timestamp>` static release. Install production dependencies with the lockfile, switch both `current` symlinks only after builds are present, then restart only `zsyy-api`.

- [ ] **Step 4: Apply and verify the production migration**

Run the deployed initialization command under `/etc/zsyy/zsyy.env`; verify `direct_referral_rewards` exists and its row count remains zero before the first post-release order. Do not run a historical reward script.

- [ ] **Step 5: Run a controlled production acceptance order**

Use only approved test users. Select a direct parent/child pair, grant only the child enough vouchers, place one new order, and verify exactly one 20% reward to the parent, no 20% reward to the grandparent, the original 10% market calculation still matches, and manual reconciliation does not issue a duplicate reward. Label the grant and order notes as production acceptance and report that the offline test order must not be shipped.

- [ ] **Step 6: Verify public health and UI**

Verify both HTTPS roots return 200, `/api/health` reports connected, all six test phone accounts still log in, and the child parent’s wallet ledger displays “直推收益”.

- [ ] **Step 7: Commit release metadata if changed**

```bash
git add docs deploy
git commit -m "docs: record direct referral reward release"
git push origin main
```
