import test from 'node:test'
import assert from 'node:assert/strict'
import { createDemoState, placeDemoOrder, grantDemoVoucher, saveDemoAddress, rebateSummary } from './demo.mjs'

const request = { productId: 'p1', quantity: 2, expectedPriceUnits: 12800, key: 'purchase-1' }

test('a purchase deducts its exact cost and preserves address and product snapshots', () => {
  const state = createDemoState()
  const next = placeDemoOrder(state, request)
  assert.equal(next.balanceUnits, state.balanceUnits - 25600)
  assert.equal(next.orders.length, state.orders.length + 1)
  state.address.recipient = '修改后的名字'
  state.products[0].name = '修改后的商品'
  assert.equal(next.orders[0].address.recipient, '林女士')
  assert.equal(next.orders[0].product.name, '植萃柔顺洗发露')
  assert.equal(next.ledger[0].amountUnits, -25600)
})
test('retries with the same key do not charge twice, different contents are rejected', () => {
  const once = placeDemoOrder(createDemoState(), request)
  assert.deepEqual(placeDemoOrder(once, request), once)
  assert.throws(() => placeDemoOrder(once, { ...request, quantity: 1 }), /重复请求内容不一致/)
})
test('insufficient balance, address, price or unavailable product leave the source state unchanged', () => {
  for (const alter of [s => s.balanceUnits = 1, s => s.address = null, s => s.products[0].active = false, s => s.products[0].priceUnits = 13000]) {
    const state = createDemoState(); alter(state)
    const before = structuredClone(state)
    assert.throws(() => placeDemoOrder(state, request))
    assert.deepEqual(state, before)
  }
})
test('invalid quantities cannot create negative, fractional or overflowing purchases', () => {
  for (const quantity of [0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => placeDemoOrder(createDemoState(), { ...request, quantity }))
  }
})
test('voucher grants increase balance and create matching ledger entries; zero grants fail', () => {
  const state = createDemoState()
  const next = grantDemoVoucher(state, 10000, '活动发放', 'grant-1')
  assert.equal(next.balanceUnits, state.balanceUnits + 10000)
  assert.equal(next.ledger[0].amountUnits, 10000)
  assert.deepEqual(grantDemoVoucher(next, 10000, '活动发放', 'grant-1'), next)
  assert.throws(() => grantDemoVoucher(state, 0, '', 'grant-2'))
})
test('invalid address is rejected; valid address is trimmed', () => {
  assert.throws(() => saveDemoAddress(createDemoState(), { recipient: '', phone: '123', detail: '' }))
  const next = saveDemoAddress(createDemoState(), { recipient: ' 王先生 ', phone: '13800138000', detail: ' 上海市 测试路 1 号 ' })
  assert.equal(next.address.recipient, '王先生')
})
test('cumulative rebate excludes one maximum market, rounds the cumulative amount, and subtracts paid', () => {
  assert.deepEqual(rebateSummary([1000000, 600000, 400000], 80000), { total: 2000000, largest: 1000000, eligible: 1000000, entitled: 100000, paid: 80000, pending: 20000 })
  assert.equal(rebateSummary([10000, 10000, 2000], 0).entitled, 1200)
  assert.equal(rebateSummary([9, 11], 0).entitled, 0)
  assert.equal(rebateSummary([], 0).entitled, 0)
})
