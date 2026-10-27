import { beforeEach, afterEach, test, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { nextTick } from 'vue'
import Mobile from '../packages/mobile-h5/src/App.vue'
import Admin from '../packages/admin/src/App.vue'
import Home from '../packages/mobile-h5/src/views/HomeView.vue'
import Mall from '../packages/mobile-h5/src/views/MallView.vue'
import Orders from '../packages/mobile-h5/src/views/OrdersView.vue'
import Profile from '../packages/mobile-h5/src/views/ProfileView.vue'
import { state, update } from '../packages/shared/store.js'
import { createDemoState } from '../packages/shared/demo.mjs'
import { webcrypto } from 'node:crypto'

let wrapper, router
const tick = async () => { await nextTick(); await flushPromises(); await nextTick() }
const button = text => [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent.trim()) === text)
async function click(text) { const target = button(text); expect(target, `missing button: ${text}`).toBeTruthy(); target.click(); await tick() }
async function fill(selector, value) { const el = document.querySelector(selector); expect(el, `missing input: ${selector}`).toBeTruthy(); el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); await tick() }
async function mountMobile(path = '/') {
  router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: Home }, { path: '/mall', component: Mall }, { path: '/orders', component: Orders }, { path: '/me', component: Profile }] })
  await router.push(path)
  wrapper = mount(Mobile, { attachTo: document.body, global: { plugins: [router] } })
  await router.isReady(); await tick()
}
async function mountAdmin() { wrapper = mount(Admin, { attachTo: document.body }); await tick() }
async function openFirstProduct() { document.querySelector('.product-open').click(); await tick() }
async function submit(selector = 'dialog form') { document.querySelector(selector).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await tick() }
beforeEach(() => { localStorage.clear(); update(createDemoState()); vi.restoreAllMocks() })
afterEach(() => { wrapper?.unmount(); wrapper = null; document.body.innerHTML = ''; vi.restoreAllMocks(); vi.unstubAllGlobals() })

test('mobile navigation and both home shopping links lead to the intended pages', async () => {
  await mountMobile()
  for (const [label, path, heading] of [['商城', '/mall', '品质商城'], ['订单', '/orders', '我的订单'], ['管理', '/me', '林女士'], ['首页', '/', '把品质']]) {
    const link = [...document.querySelectorAll('.tabbar a')].find(a => a.textContent.trim() === label)
    link.click(); await tick(); expect(router.currentRoute.value.path).toBe(path); expect(document.body.textContent).toContain(heading)
  }
  document.querySelector('.hero-button').click(); await tick(); expect(router.currentRoute.value.path).toBe('/mall')
  await router.push('/'); await tick(); document.querySelector('.shop-banner').click(); await tick(); expect(router.currentRoute.value.path).toBe('/mall')
})
test('mall search, category tabs and empty result reset actually filter products', async () => {
  await mountMobile('/mall'); expect(document.querySelectorAll('.product-card')).toHaveLength(3)
  await fill('[aria-label="搜索商品"]', '护发素'); expect(document.querySelectorAll('.product-card')).toHaveLength(1)
  await fill('[aria-label="搜索商品"]', '不存在'); expect(document.querySelectorAll('.product-card')).toHaveLength(0)
  await click('查看全部好物'); expect(document.querySelectorAll('.product-card')).toHaveLength(3)
  await click('日常洗护'); expect(document.querySelectorAll('.product-card')).toHaveLength(3)
  await click('居家生活'); expect(document.querySelectorAll('.product-card')).toHaveLength(0)
  await click('全部好物'); expect(document.querySelectorAll('.product-card')).toHaveLength(3)
})
test('quantity controls and purchase create one correctly priced order and debit entry', async () => {
  await mountMobile('/mall'); await openFirstProduct()
  expect(document.querySelector('[aria-label="减少数量"]').disabled).toBe(true)
  document.querySelector('[aria-label="增加数量"]').click(); await tick()
  expect(document.querySelector('[aria-label="购买数量"]').value).toBe('2')
  document.querySelector('[aria-label="减少数量"]').click(); await tick()
  expect(document.querySelector('[aria-label="购买数量"]').value).toBe('1')
  await fill('[aria-label="购买数量"]', '2'); await click('确认演示购买 · 256.00 券')
  expect(state.value.balanceUnits).toBe(242400); expect(state.value.orders).toHaveLength(2); expect(state.value.ledger[0].amountUnits).toBe(-25600)
  expect(router.currentRoute.value.path).toBe('/orders'); expect(document.querySelector('[role="status"]').textContent).toContain('购买成功')
  expect(router.currentRoute.value.query.created).toBeUndefined()
})
test('insufficient balance and invalid quantity show an error without changing the wallet', async () => {
  await mountMobile('/mall'); await openFirstProduct(); await fill('[aria-label="购买数量"]', '999'); await click('确认演示购买 · 127,872.00 券')
  expect(document.querySelector('[role="alert"]').textContent).toContain('余额不足'); expect(state.value.balanceUnits).toBe(268000)
  await fill('[aria-label="购买数量"]', '0'); await click('确认演示购买 · 0.00 券')
  expect(document.querySelector('[role="alert"]').textContent).toContain('正整数'); expect(state.value.orders).toHaveLength(1)
})
test('missing address prevents purchase and offers the personal management link', async () => {
  const seed = createDemoState(); seed.address = null; update(seed)
  await mountMobile('/mall'); await openFirstProduct(); await click('确认演示购买 · 128.00 券')
  expect(document.querySelector('[role="alert"]').textContent).toContain('收货地址')
  document.querySelector('dialog a').click(); await tick(); expect(router.currentRoute.value.path).toBe('/me')
})
test('order detail button and product row show the frozen address; search has an empty state', async () => {
  await mountMobile('/orders'); await click('查看详情')
  expect(document.querySelector('dialog').textContent).toContain('世纪大道 100 号')
  document.querySelector('dialog').dispatchEvent(new Event('cancel', { cancelable: true })); await tick(); expect(document.querySelector('dialog')).toBeNull()
  document.querySelector('.order-product').click(); await tick(); expect(document.querySelector('dialog').textContent).toContain('ZS202610220001')
  await click('关闭'); await fill('[aria-label="搜索订单"]', '不存在'); expect(document.querySelectorAll('.order-card')).toHaveLength(0)
  document.querySelector('.empty-state a').click(); await tick(); expect(router.currentRoute.value.path).toBe('/mall')
})
test('address validation and save button preserve the historical order address', async () => {
  await mountMobile('/me'); document.querySelector('.menu-group button').click(); await tick()
  await fill('input[autocomplete="tel"]', '123'); await submit(); expect(document.querySelector('[role="alert"]').textContent).toContain('11 位')
  await fill('input[autocomplete="name"]', '检查用户'); await fill('input[autocomplete="tel"]', '13900139000'); await fill('textarea', '上海市 测试地址 2 号'); await submit()
  expect(state.value.address.recipient).toBe('检查用户'); expect(state.value.orders[0].address.recipient).toBe('林女士'); expect(document.querySelector('dialog')).toBeNull()
})
test('personal ledger, team, rebate and invitation controls open their actual content', async () => {
  await mountMobile('/me')
  await click('收支明细'); expect(document.querySelector('dialog').textContent).toContain('后台发放'); await click('关闭')
  await click('查看团队'); expect(document.querySelectorAll('.market-row')).toHaveLength(3); expect(document.querySelector('dialog').textContent).toContain('最大市场'); expect(document.querySelector('dialog').textContent).toContain('直属推荐用户完成订单后，推荐人获得该订单金额的 20%'); expect(document.querySelector('dialog').textContent).toContain('仅限直接推荐关系'); expect(document.querySelector('dialog').textContent).toContain('排除累计消费最高的一个子市场，其余子市场累计消费的 10%'); expect(document.querySelector('dialog').textContent).toContain('扣除已发收益后补发差额'); await click('关闭')
  document.querySelector('.team-summary').click(); await tick(); expect(document.querySelector('dialog h2').textContent).toBe('我的团队'); await click('关闭')
  document.querySelectorAll('.menu-group button')[2].click(); await tick(); expect(document.querySelector('dialog').textContent).toContain('10%'); await click('关闭')
  document.querySelectorAll('.menu-group button')[1].click(); await tick(); expect(document.querySelector('.invite-code').textContent).toBe('ZS8K26'); await click('关闭')
  document.querySelector('.menu-group a').click(); await tick(); expect(router.currentRoute.value.path).toBe('/orders')
})
test('income records total both rewards and show separate referral and team histories', async () => {
  const seed=createDemoState()
  seed.ledger.unshift({id:'direct-referral-1',type:'direct_referral_reward',title:'直推收益',note:'直属下线订单 20% 收益',amountUnits:2000,beforeUnits:268000,afterUnits:270000,createdAt:'2026-10-27 10:00:00'})
  update(seed)
  await mountMobile('/me')
  expect(document.querySelector('.wallet-bottom').textContent).toContain('累计总收益')
  expect(document.querySelector('.wallet-bottom').textContent).toContain('820.00')
  document.querySelectorAll('.menu-group button')[2].click();await tick()
  const dialog=document.querySelector('dialog')
  expect(dialog.querySelector('.stat-highlight').textContent).toContain('820.00')
  expect(dialog.textContent).toContain('推荐收益（直接推荐20%）')
  expect(dialog.textContent).toContain('团队佣金（团队收益10%）')
  expect(dialog.querySelector('[aria-label="推荐收益记录"]').textContent).toContain('20.00')
  expect(dialog.querySelector('[aria-label="团队佣金记录"]').textContent).toContain('800.00')
  expect(document.body.textContent).not.toContain('返利')
  await click('关闭')
  await click('收支明细')
  expect(document.querySelector('dialog').textContent).toContain('推荐收益')
})
test('all eight admin navigation entries open their intended view and overview shortcuts work', async () => {
  await mountAdmin()
  for (const item of [...document.querySelectorAll('nav[aria-label="后台菜单"] button')]) {
    const title = item.textContent.trim(); item.click(); await tick(); expect(document.querySelector('main h1').textContent).toBe(title)
  }
  await click('运营概览'); document.querySelector('.text-link').click(); await tick(); expect(document.querySelector('main h1').textContent).toBe('订单管理')
  for (const index of [0, 1, 2]) { await click('运营概览'); const action = document.querySelectorAll('.quick-actions button')[index]; const title=action.textContent.trim(); action.click(); await tick(); expect(document.querySelector('main h1').textContent).toBe(title) }
})
test('admin product editing validates price and leaves old order snapshots unchanged', async () => {
  await mountAdmin(); await click('商品管理'); await click('编辑')
  await fill('dialog input[inputmode="decimal"]', '0'); await submit(); expect(document.querySelector('dialog [role="alert"]').textContent).toContain('有效价格')
  await fill('dialog input[inputmode="decimal"]', '130'); await fill('dialog input[maxlength="60"]', '检查商品'); await submit()
  expect(state.value.products[0].name).toBe('检查商品'); expect(state.value.products[0].priceUnits).toBe(13000); expect(document.querySelector('dialog')).toBeNull()
  expect(state.value.orders[0].product.name).toBe('柔润香氛沐浴露')
})
test('admin shelf controls hide and restore a product in the mobile catalog', async () => {
  await mountAdmin(); await click('商品管理'); await click('下架'); expect(state.value.products[0].active).toBe(false)
  wrapper.unmount(); wrapper=null; await mountMobile('/mall'); expect(document.querySelectorAll('.product-card')).toHaveLength(2)
  wrapper.unmount(); wrapper=null; await mountAdmin(); await click('商品管理'); await click('上架'); expect(state.value.products[0].active).toBe(true)
})
test('admin order search and detail expose the saved recipient and can be closed', async () => {
  await mountAdmin(); await click('订单管理'); await fill('[aria-label="搜索订单"]', '不存在'); expect(document.body.textContent).toContain('没有匹配的订单')
  await fill('[aria-label="搜索订单"]', 'ZS202610220001'); await click('查看详情'); expect(document.querySelector('dialog').textContent).toContain('林女士')
  await click('关闭'); expect(document.querySelector('dialog')).toBeNull()
})
test('admin user grant shortcut and grant validation produce a matching balance and ledger', async () => {
  await mountAdmin(); await click('用户管理'); await click('发放产品券'); expect(document.querySelector('main h1').textContent).toBe('产品券发放')
  await fill('input[inputmode="decimal"]', '0'); await fill('textarea', '检查发放'); await submit('main form'); expect(document.querySelector('[role="alert"]').textContent).toContain('正整数')
  await fill('input[inputmode="decimal"]', '100.25'); await submit('main form'); expect(state.value.balanceUnits).toBe(278025); expect(state.value.ledger[0].amountUnits).toBe(10025); expect(document.body.textContent).toContain('检查发放')
})
test('company content saving updates the mobile homepage', async () => {
  await mountAdmin(); await click('公司介绍'); await fill('input[maxlength="20"]', '检查商城'); await submit('main form')
  expect(state.value.company.name).toBe('检查商城'); wrapper.unmount(); wrapper=null; await mountMobile('/'); expect(document.querySelector('.brand').textContent).toContain('检查商城')
})
test('reset confirmation cancellation preserves data, confirmation restores the seed', async () => {
  await mountAdmin(); const seed=createDemoState(); seed.balanceUnits=500; update(seed); await tick()
  vi.spyOn(window, 'confirm').mockReturnValue(false); await click('重置演示'); expect(state.value.balanceUnits).toBe(500)
  window.confirm.mockReturnValue(true); await click('重置演示'); expect(state.value.balanceUnits).toBe(268000)
})
test('rebate and job views describe their scope without pretending to execute settlement', async () => {
  await mountAdmin(); await click('团队与收益'); expect(document.body.textContent).toContain('800.00'); expect(document.body.textContent).toContain('最大市场 · 排除')
  await click('结算与对账'); expect(document.body.textContent).toContain('当前没有真实调度器'); expect(button('立即结算')).toBeUndefined()
})
test('product opening and voucher grant still work when an HTTP phone browser has no randomUUID', async () => {
  vi.stubGlobal('crypto', { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) })
  const errors = []
  await mountMobile('/mall'); wrapper.vm.$.appContext.config.errorHandler = e => errors.push(e.message)
  await openFirstProduct(); expect(errors).toEqual([]); expect(document.querySelector('dialog')).not.toBeNull()
  wrapper.unmount(); wrapper=null; await mountAdmin(); await click('产品券发放')
  await fill('input[inputmode="decimal"]', '10'); await fill('textarea', 'HTTP兼容检查'); await submit('main form')
  expect(state.value.balanceUnits).toBe(269000)
})
test('largest market badges follow cumulative consumption rather than the first row', async () => {
  const seed=createDemoState(); seed.markets[1].units=2000000; update(seed)
  await mountMobile('/me'); await click('查看团队')
  const rows=[...document.querySelectorAll('.market-row')]
  expect(rows.find(row => row.textContent.includes('陈女士')).textContent).toContain('最大市场')
  expect(rows.find(row => row.textContent.includes('张先生')).textContent).not.toContain('最大市场')
  wrapper.unmount(); wrapper=null; await mountAdmin(); await click('团队与收益')
  const adminRows=[...document.querySelectorAll('.el-table__body tr')]
  expect(adminRows.find(row => row.textContent.includes('陈女士')).textContent).toContain('最大市场 · 排除')
})
test('copy invitation reports success or a manual-copy fallback according to clipboard availability', async () => {
  // Only the browser API boundary is simulated, not the component or store.
  // This verifies feedback, not actual system clipboard permission.
  const previous=Object.getOwnPropertyDescriptor(navigator, 'clipboard')
  const writeText=vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable:true, value:{ writeText } })
  try {
    await mountMobile('/me'); document.querySelectorAll('.menu-group button')[1].click(); await tick()
    await click('复制邀请码'); expect(document.querySelector('dialog [role="status"]').textContent).toContain('已复制')
    await click('关闭'); document.querySelectorAll('.menu-group button')[1].click(); await tick()
    writeText.mockRejectedValue(new Error('denied')); await click('复制邀请码')
    expect(document.querySelector('dialog [role="alert"]').textContent).toContain('手动复制')
  } finally { if (previous) Object.defineProperty(navigator, 'clipboard', previous); else delete navigator.clipboard }
})
