export const money = units => (units / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const clone = value => structuredClone(value)
const stamp = () => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' })
function positive(value) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('请输入有效的正整数数量或产品券金额')
}
export function createDemoState() {
  return {
    version: 1, balanceUnits: 268000,
    profile: { nickname: '林女士', id: '100086', inviteCode: 'ZS8K26' },
    address: { recipient: '林女士', phone: '13800138000', detail: '上海市 浦东新区 世纪大道 100 号' },
    company: { name: '产品券商城', tagline: '把品质，带进日常', intro: '我们相信，美好的生活藏在每一个用心的选择里。从日常洗护到居家用品，以品质为起点，让每一份产品券都遇见值得的好物。', body: '专注产品本身，认真选择日常所需。我们希望通过简洁便捷的产品券商城，让您轻松发现适合自己的生活好物。产品购买后由线下安排交付，您可以随时在订单中查阅购买记录。' },
    products: [
      { id: 'p1', name: '植萃柔顺洗发露', subtitle: '日常洗护 · 500mL', category: '日常洗护', priceUnits: 12800, image: '/images/shampoo.png', color: 'sage', active: true, description: '为日常洗护准备的植萃系列。简洁瓶身，轻松融入浴室空间。商品信息与图片仅用于界面演示，正式规格以上架资料为准。' },
      { id: 'p2', name: '柔润香氛沐浴露', subtitle: '日常洗护 · 500mL', category: '日常洗护', priceUnits: 9800, image: '/images/bodywash.png', color: 'cream', active: true, description: '为每日沐浴时光增添一份从容。商品信息与图片仅用于界面演示，正式规格以上架资料为准。' },
      { id: 'p3', name: '轻盈滋养护发素', subtitle: '日常洗护 · 500mL', category: '日常洗护', priceUnits: 10800, image: '/images/conditioner.png', color: 'rose', active: true, description: '日常护发系列，与洗发产品搭配使用。商品信息与图片仅用于界面演示，正式规格以上架资料为准。' }
    ],
    orders: [{ id: 'ZS202610220001', key: 'seed-order', product: { id: 'p2', name: '柔润香氛沐浴露', subtitle: '日常洗护 · 500mL', image: '/images/bodywash.png', color: 'cream', priceUnits: 9800 }, quantity: 1, totalUnits: 9800, createdAt: '2026-10-22 09:16:00', address: { recipient: '林女士', phone: '13800138000', detail: '上海市 浦东新区 世纪大道 100 号' } }],
    ledger: [
      { id: 'l3', type: 'order', title: '商品购买', note: '柔润香氛沐浴露 × 1', amountUnits: -9800, createdAt: '2026-10-22 09:16:00' },
      { id: 'l2', type: 'rebate', title: '团队收益', note: '累计差额发放', amountUnits: 80000, createdAt: '2026-10-22 08:30:00' },
      { id: 'l1', type: 'grant', title: '后台发放', note: '演示初始产品券', amountUnits: 197800, createdAt: '2026-10-21 10:00:00' }
    ],
    markets: [{ id: '100101', name: '张先生', members: 12, units: 1000000 }, { id: '100102', name: '陈女士', members: 8, units: 600000 }, { id: '100103', name: '王先生', members: 5, units: 200000 }],
    paidRebateUnits: 80000,
    rebates: [{ id: 'r1', amountUnits: 80000, eligibleUnits: 800000, createdAt: '2026-10-22 08:30:00' }]
  }
}
export function placeDemoOrder(source, { productId, quantity, expectedPriceUnits, key }) {
  positive(quantity)
  if (!key) throw new Error('缺少购买请求编号，请重新打开商品')
  const existing = source.orders.find(o => o.key === key)
  if (existing) {
    if (existing.product.id !== productId || existing.quantity !== quantity || existing.product.priceUnits !== expectedPriceUnits) throw new Error('重复请求内容不一致')
    return clone(source)
  }
  const product = source.products.find(p => p.id === productId)
  if (!product?.active) throw new Error('商品已下架，请选择其他商品')
  if (product.priceUnits !== expectedPriceUnits) throw new Error('商品价格已变化，请重新打开详情确认')
  if (!source.address?.recipient || !source.address?.phone || !source.address?.detail) throw new Error('请先到管理页面填写默认收货地址')
  const totalUnits = product.priceUnits * quantity
  positive(totalUnits)
  if (source.balanceUnits < totalUnits) throw new Error('产品券余额不足')
  const state = clone(source), createdAt = stamp()
  const id = `ZS${Date.now()}${state.orders.length}`
  state.balanceUnits -= totalUnits
  state.orders.unshift({ id, key, product: clone(product), quantity, totalUnits, createdAt, address: clone(source.address) })
  state.ledger.unshift({ id: `order:${id}`, type: 'order', title: '商品购买', note: `${product.name} × ${quantity}`, amountUnits: -totalUnits, createdAt })
  return state
}
export function grantDemoVoucher(source, amountUnits, note, key) {
  positive(amountUnits)
  if (!key) throw new Error('缺少发放请求编号')
  const id = `grant:${key}`, existing = source.ledger.find(item => item.id === id)
  if (existing) {
    if (existing.amountUnits !== amountUnits || existing.note !== note.trim()) throw new Error('重复请求内容不一致')
    return clone(source)
  }
  if (!Number.isSafeInteger(source.balanceUnits + amountUnits)) throw new Error('金额超出可用范围')
  const state = clone(source)
  state.balanceUnits += amountUnits
  state.ledger.unshift({ id, type: 'grant', title: '后台发放', note: note.trim(), amountUnits, createdAt: stamp() })
  return state
}
export function saveDemoAddress(source, address) {
  const recipient = address.recipient?.trim(), phone = address.phone?.trim(), detail = address.detail?.trim()
  if (!recipient || !/^1\d{10}$/.test(phone || '') || !detail) throw new Error('请填写收件人、11 位手机号和完整地址')
  const state = clone(source)
  state.address = { recipient, phone, detail }
  return state
}
export function rebateSummary(markets, paid) {
  const total = markets.reduce((sum, n) => sum + n, 0), largest = Math.max(0, ...markets), eligible = total - largest
  const entitled = Math.floor(eligible / 10)
  return { total, largest, eligible, entitled, paid, pending: entitled - paid }
}
