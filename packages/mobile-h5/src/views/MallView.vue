<script setup>
import { computed, ref, watch, onBeforeUnmount, onMounted } from 'vue'
import { state, purchase, isDemo, loadProducts, loadCategories, refreshSession } from '../../../shared/store.js'
import { money } from '../../../shared/demo.mjs'
import { createRequestId } from '../../../shared/request-id.mjs'
import Icon from '../../../shared/Icon.vue'
import Modal from '../components/Modal.vue'
import ProductArt from '../components/ProductArt.vue'
import { useRouter } from 'vue-router'
const router = useRouter(), query = ref(''), category = ref('全部好物'), selected = ref(null), quantity = ref(1), error = ref(''), busy = ref(false)
let key = ''
const products = computed(() => isDemo?state.value.products.filter(p => p.active && p.name.includes(query.value.trim()) && (category.value === '全部好物' || p.category === category.value)):state.value.products)
const categories=computed(()=>isDemo?['全部好物','日常洗护','居家生活']:['全部好物',...state.value.categories])
const loadError=ref(''),loading=ref(false)
let searchTimer
async function load(append=false){if(isDemo)return;loading.value=true;loadError.value='';try{await loadProducts({keyword:query.value,category:category.value==='全部好物'?'':category.value,page:append?state.value.productPage.page+1:1},append)}catch(e){loadError.value=e.message}finally{loading.value=false}}
watch([query,category],()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>load(),250)})
onMounted(async()=>{await load();if(!isDemo)try{await Promise.all([loadCategories(),refreshSession()])}catch(e){loadError.value=e.message}})
onBeforeUnmount(()=>clearTimeout(searchTimer))
function open(product) { selected.value = { ...product }; quantity.value = 1; error.value = ''; key = createRequestId() }
async function buy() {
  if(!isDemo&&!state.value.profile){selected.value=null;router.push({path:'/login',query:{returnTo:'/mall'}});return}
  if (busy.value) return
  busy.value = true; error.value = ''
  try { const order=await purchase({ productId: selected.value.id, quantity: quantity.value, expectedPriceUnits: selected.value.priceUnits, key }); selected.value = null; router.push({ path: '/orders', query: { created: order?.id||state.value.orders[0]?.id } }) }
  catch (e) { error.value = e.message }
  finally { busy.value = false }
}
</script>
<template>
  <div class="page-heading"><div><span class="eyebrow">CURATED FOR YOU</span><h1>品质商城</h1></div><span class="heading-note">日常所需 · 用心甄选</span></div>
  <RouterLink v-if="!isDemo && !state.profile" class="state-note guest-login" to="/login">登录 / 注册，查看产品券余额</RouterLink><div v-if="isDemo || state.profile" class="balance-strip"><span><Icon name="ticket" :size="20" />可用产品券</span><strong>{{ money(state.balanceUnits) }}<small>券</small></strong></div>
  <label class="search-box"><Icon name="search" :size="19" /><input v-model="query" type="search" aria-label="搜索商品" placeholder="搜索喜欢的商品"><kbd>搜索</kbd></label>
  <div class="category-tabs" aria-label="商品分类"><button v-for="item in categories" :key="item" :class="{ active: category === item }" :aria-pressed="category === item" @click="category = item">{{ item }}</button></div>
  <div class="catalog-heading"><strong>{{ category }}</strong><span>{{ products.length }} 件商品</span></div>
  <p v-if="loadError" class="error" role="alert">{{ loadError }}</p><p v-if="loading" class="muted">正在加载商品…</p><div v-if="products.length" class="product-grid"><article v-for="p in products" :key="p.id" class="product-card"><button class="product-open" @click="open(p)"><ProductArt :product="p" /><div class="product-body"><span class="product-tag">品质精选</span><h2>{{ p.name }}</h2><p>{{ p.subtitle }}</p><div class="product-price"><strong>{{ money(p.priceUnits) }}<small>券</small></strong><span class="product-add"><Icon name="plus" :size="18" /></span></div></div></button></article></div>
  <div v-else class="empty-state"><Icon name="search" :size="36" /><h2>暂时没有相关商品</h2><p>试试其他关键词，或看看全部好物。</p><button class="secondary" @click="query = ''; category = '全部好物'">查看全部好物</button></div>
  <p class="subtle-note">产品券购买 · 线下安排发货 · 下单后不支持取消或退款</p>
  <button v-if="!isDemo && state.products.length < state.productPage.total" class="secondary full" :disabled="loading" @click="load(true)">加载更多商品</button>
  <Modal v-if="selected" :title="'商品详情'" @close="selected = null"><ProductArt :product="selected" large /><div class="detail-title"><div><h3>{{ selected.name }}</h3><p class="muted">{{ selected.subtitle }}</p></div><strong class="price">{{ money(selected.priceUnits) }}<small>券</small></strong></div><p class="detail-description">{{ selected.description }}</p><div class="quantity-line"><span>购买数量</span><div class="stepper"><button aria-label="减少数量" :disabled="quantity <= 1" @click="quantity--">−</button><input v-model.number="quantity" aria-label="购买数量" type="number" min="1" max="999" step="1"><button aria-label="增加数量" :disabled="quantity >= 999" @click="quantity++">+</button></div></div><div class="address-preview"><Icon name="pin" :size="20" /><div v-if="state.address"><strong>{{ state.address.recipient }}　{{ state.address.phone }}</strong><p>{{ state.address.detail }}</p></div><RouterLink v-else to="/me" @click="selected = null">请先填写默认收货地址</RouterLink></div><p class="subtle-note">下单即扣除产品券，不支持取消或退款。<span v-if="isDemo">当前为演示购买。</span></p><p v-if="error" class="error" role="alert">{{ error }}</p><button class="primary full" :disabled="busy" @click="buy">{{ isDemo ? '确认演示购买' : '确认购买' }} · {{ money(selected.priceUnits * (Number(quantity) || 0)) }} 券</button></Modal>
</template>
