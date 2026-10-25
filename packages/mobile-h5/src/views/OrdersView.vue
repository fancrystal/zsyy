<script setup>
import { computed, ref, onMounted, watch, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { state, isDemo, loadOrders } from '../../../shared/store.js'
import { money } from '../../../shared/demo.mjs'
import Icon from '../../../shared/Icon.vue'
import Modal from '../components/Modal.vue'
import ProductArt from '../components/ProductArt.vue'
const route = useRoute(), query = ref(''), selected = ref(null)
const router = useRouter(), createdId = route.query.created
const showSuccess = computed(() => typeof createdId === 'string' && state.value.orders.some(o => o.id === createdId))
onMounted(() => { if (createdId) router.replace({ path: '/orders' }) })
const orders = computed(() => isDemo?state.value.orders.filter(o => `${o.id}${o.product.name}`.includes(query.value.trim())):state.value.orders)
const consumed = computed(() => isDemo?state.value.orders.reduce((sum, o) => sum + o.totalUnits, 0):state.value.orderTotalUnits)
const loadError=ref(''),loading=ref(false)
let searchTimer
async function load(append=false){if(isDemo)return;loading.value=true;loadError.value='';try{await loadOrders({keyword:query.value,page:append?state.value.orderPage.page+1:1},append)}catch(e){loadError.value=e.message}finally{loading.value=false}}
onMounted(()=>load())
watch(query,()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>load(),250)})
onBeforeUnmount(()=>clearTimeout(searchTimer))
</script>
<template>
  <div class="page-heading"><div><span class="eyebrow">MY PURCHASES</span><h1>我的订单</h1></div><Icon name="orders" class="heading-icon" :size="30" /></div>
  <p v-if="showSuccess" class="success-note" role="status"><Icon name="check" :size="17" />{{ isDemo ? '演示购买成功，已保存购买记录。' : '购买成功，已保存订单。' }}</p>
  <div class="order-summary"><div><span>累计购买</span><strong>{{ isDemo ? state.orders.length : state.orderPage.total }}<small>笔</small></strong></div><i></i><div><span>累计消耗产品券</span><strong>{{ money(consumed) }}<small>券</small></strong></div></div>
  <label class="search-box"><Icon name="search" :size="19" /><input v-model="query" type="search" aria-label="搜索订单" placeholder="搜索订单号或商品名称"></label>
  <div class="catalog-heading"><strong>全部订单</strong><span>{{ orders.length }} 条记录</span></div>
  <p v-if="loadError" class="error" role="alert">{{ loadError }}</p><button v-if="!isDemo" class="text-button" :disabled="loading" @click="load()">刷新订单</button>
  <div v-for="order in orders" :key="order.id" class="order-card"><div class="order-top"><span>{{ order.createdAt.slice(0, 16) }}</span><span class="success-text"><Icon name="check" :size="14" />购买成功</span></div><button class="order-product" @click="selected = order"><ProductArt :product="order.product" /><div><h2>{{ order.product.name }}</h2><p>{{ order.product.subtitle }}</p><span>数量 × {{ order.quantity }}</span></div><Icon name="arrow" :size="18" /></button><div class="order-bottom"><span>合计 <strong>{{ money(order.totalUnits) }}</strong> 券</span><button class="small-button" @click="selected = order">查看详情</button></div></div>
  <div v-if="!orders.length" class="empty-state"><Icon name="orders" :size="40" /><h2>{{ query ? '没有找到相关订单' : '还没有购买记录' }}</h2><p>喜欢的生活好物，在商城等你。</p><RouterLink to="/mall" class="primary">去逛商城</RouterLink></div>
  <p class="subtle-note">这里只记录购买结果，商品由线下安排发货。</p>
  <button v-if="!isDemo && state.orders.length < state.orderPage.total" class="secondary full" :disabled="loading" @click="load(true)">加载更多订单</button>
  <Modal v-if="selected" title="订单详情" @close="selected = null"><div class="order-success"><span><Icon name="check" :size="28" /></span><h3>购买成功</h3><p>产品券已扣除，购买记录已保存</p></div><div class="order-product"><ProductArt :product="selected.product" /><div><h3>{{ selected.product.name }}</h3><p>{{ selected.product.subtitle }}</p><span>× {{ selected.quantity }}</span></div></div><dl class="details-list"><div><dt>订单编号</dt><dd>{{ selected.orderNo || selected.id }}</dd></div><div><dt>购买时间</dt><dd>{{ selected.createdAt }}</dd></div><div><dt>产品券消耗</dt><dd>{{ money(selected.totalUnits) }} 券</dd></div></dl><div class="address-preview"><Icon name="pin" /><div><strong>{{ selected.address.recipient }}　{{ selected.address.phone }}</strong><p>{{ selected.address.detail }}</p></div></div><p class="subtle-note">以上为下单时保存的收货信息。</p></Modal>
</template>
