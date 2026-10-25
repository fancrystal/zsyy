import { ref, computed } from 'vue'
import { createDemoState, placeDemoOrder, grantDemoVoucher, saveDemoAddress, rebateSummary } from './demo.mjs'
const STORAGE_KEY = 'zsyy-ui-demo-v1'
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (saved?.version === 1 && Array.isArray(saved.products) && Array.isArray(saved.orders) && Array.isArray(saved.ledger) && Array.isArray(saved.markets) && Number.isSafeInteger(saved.balanceUnits)) return saved
  } catch { /* A restricted browser or an obsolete demo starts with seed data. */ }
  return createDemoState()
}
export const state = ref(load())
export const rebate = computed(() => rebateSummary(state.value.markets.map(m => m.units), state.value.paidRebateUnits))
export const largestMarketId = computed(() => {
  const largest = state.value.markets.reduce((best, market) => {
    if (!best || market.units > best.units || (market.units === best.units && BigInt(market.id) < BigInt(best.id))) return market
    return best
  }, null)
  return largest?.id ?? null
})
export function update(next) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) }
  catch { throw new Error('浏览器无法保存演示数据，请允许本地存储后重试') }
  state.value = next
}
const snapshot = () => JSON.parse(JSON.stringify(state.value))
export const purchase = request => update(placeDemoOrder(snapshot(), request))
export const grant = (amount, note, key) => update(grantDemoVoucher(snapshot(), amount, note, key))
export const saveAddress = address => update(saveDemoAddress(snapshot(), address))
export function editProduct(id, changes) {
  const next = snapshot(), p = next.products.find(p => p.id === id)
  if (!p) throw new Error('商品不存在')
  if (!changes.name?.trim() || !Number.isSafeInteger(changes.priceUnits) || changes.priceUnits <= 0) throw new Error('请填写商品名称和有效价格')
  Object.assign(p, changes, { name: changes.name.trim() }); update(next)
}
export function saveCompany(company) {
  if (!company.name?.trim() || !company.tagline?.trim() || !company.intro?.trim()) throw new Error('请填写名称、标题和公司简介')
  const next = snapshot(); next.company = { ...company }; update(next)
}
export const reset = () => update(createDemoState())
window.addEventListener('storage', e => { if (e.key === STORAGE_KEY) state.value = load() })
