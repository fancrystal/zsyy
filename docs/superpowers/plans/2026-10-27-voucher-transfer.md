# Voucher Transfer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let authenticated users transfer product vouchers by recipient phone number and view inbound/outbound transfer records.

**Architecture:** A `voucher_transfers` record is the immutable source of one transfer. The backend writes it plus exactly two linked wallet-ledger entries in the existing global accounting transaction; the user H5 consumes scoped transfer APIs in the personal-management page.

**Tech Stack:** Node.js, Express, MySQL 8, Vue 3, Vitest, Node test runner, pnpm.

## Global Constraints

- Transfer is immediate, fee-free, irreversible, and only moves product-voucher balances.
- Recipient is an existing 11-digit phone user; self-transfer is rejected.
- Amount uses positive integer smallest units; no transfer can make a balance negative.
- Transfer does not create an order, consumption, direct-referral reward, team rebate, or reconciliation payout.
- Every transfer has one `transfer_out` and one `transfer_in` ledger entry linked by a unique transfer ID.

---

### Task 1: Transfer persistence, transaction, and API

**Files:**
- Modify: `packages/backend/src/db/schema.js`
- Modify: `packages/backend/src/services/accounting.js`
- Modify: `packages/backend/src/app.js`
- Test: `packages/backend/tests/api.test.mjs`

**Interfaces:**
- Produces `transfer(db, senderId, {recipientPhone, amountUnits, note}, idempotencyKey)`.
- Produces `voucher_transfers` with unique `(sender_user_id,idempotency_key)` and ledger source keys `transfer:<id>:out|in`.
- Produces `POST /api/transfers`, returning 201 for a new transfer and 200 for same-key replay.

- [ ] Add failing integration coverage using real registered users: successful 10,005-unit transfer, sender/recipient balances, both ledger types/source keys, same-key replay, different-key concurrent overdraw, self recipient, unknown phone, and no team-market or rebate change.
- [ ] Run `npm.cmd run test:backend -- -t "voucher transfer"` and confirm it fails before the table/route exists.
- [ ] Add the `voucher_transfers` table with sender/recipient foreign keys, transfer number, amount, note, idempotency fingerprint and uniqueness constraints.
- [ ] Implement `transfer` inside `transaction()`: validate both accounts with `accountIntegrity`, resolve recipient phone, insert transfer, debit sender through `changeBalance`, credit recipient through `changeBalance`, and return a normalized transfer view. Never call market or rebate settlement helpers.
- [ ] Register the protected route with Zod validation (`recipientPhone`, positive `amountUnits`, optional trimmed 500-character note) and mandatory idempotency key.
- [ ] Run the focused test, then all backend tests, and commit the backend task.

### Task 2: Transfer list and account auditing

**Files:**
- Modify: `packages/backend/src/services/accounting.js`
- Modify: `packages/backend/src/services/audit.js`
- Modify: `packages/backend/src/app.js`
- Test: `packages/backend/tests/api.test.mjs`

**Interfaces:**
- Produces `listTransfers(db, userId, query)` and `GET /api/transfers` scoped to the authenticated participant.
- Transfer list item exposes `transferNo`, `direction`, `counterparty` `{phone,nickname}`, `amountUnits`, `note`, `createdAt`.

- [ ] Add a failing API assertion that each side sees only their own transfer with opposite directions and other users see no record.
- [ ] Add pagination query filtering `(sender_user_id=? OR recipient_user_id=?)`, joining counterparty details without exposing unrelated accounts.
- [ ] Extend `auditAccount` expected source map with transfers where the user is sender or recipient; verify counterparties, amounts and matching out/in ledger source keys, recording `transfer_source` anomalies on mismatch.
- [ ] Run backend suite and commit the auditing/list task.

### Task 3: H5 transfer form and transfer history

**Files:**
- Modify: `packages/shared/store.js`
- Modify: `packages/mobile-h5/src/views/ProfileView.vue`
- Test: `tests/ui-audit.test.js`

**Interfaces:**
- Produces `loadTransfers(page, append)` and `submitTransfer({recipientPhone,amountUnits,note,key})` in shared state.
- Adds Profile panels `transfer` and `transfers`; existing wallet ledger remains unchanged.

- [ ] Add a failing component test proving the personal-management menu opens the transfer form and a transfer-history panel that shows both “转出” and “转入” entries.
- [ ] Add request helpers that call `/transfers`, refresh the wallet/session and retain pagination only for the current signed-in user.
- [ ] Add phone, amount and optional-note form validation; disable duplicate submit; show server errors; reset fields and refresh history after success.
- [ ] Render transfer records with direction, counterparty nickname/phone, signed amount, note, transfer number, time, and a load-more control.
- [ ] Run UI suite and production build; commit the H5 task.

### Task 4: Documentation, verification, release

**Files:**
- Modify: `README.md`
- Modify: `docs/02-business-rules.md`
- Modify: `docs/04-database-design.md`
- Modify: `docs/05-api-design.md`

- [ ] Document irreversible phone-based voucher transfers, double-entry ledger types, non-consumption treatment, and APIs.
- [ ] Run `npm.cmd test`, `npm.cmd run build`, and `git diff --check`.
- [ ] Commit, push `main`, package the source and static builds, atomically release `/opt/zsyy/current` and `/var/www/zsyy/current`, restart only `zsyy-api`.
- [ ] Use existing test accounts for one labeled production-acceptance transfer; verify both wallets, both user histories, no market/reward delta, reconciliation no duplicate transfer, public H5/API health, then report the retained test transfer.
