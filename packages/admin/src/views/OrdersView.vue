<script setup>
import {onMounted,ref,reactive} from 'vue'
import {ElTable,ElTableColumn} from 'element-plus'
import {api,queryString} from '../../../shared/api.js'
import {money} from '../../../shared/demo.mjs'
import {useTask} from '../../../shared/use-task.js'
import Dialog from '../../../shared/Dialog.vue'
import Feedback from '../components/Feedback.vue'
import Pager from '../components/Pager.vue'
const {busy,error,run}=useTask(),list=ref({items:[],page:1,total:0}),detail=ref(null),filter=reactive({keyword:'',userId:'',startDate:'',endDate:''})
const load=async(page=1)=>list.value=await api(`/admin/orders${queryString({...filter,page})}`)
onMounted(()=>run(()=>load()))
</script>
<template><section class="panel"><Feedback :error="error"/><form class="filter-bar" @submit.prevent="run(()=>load())"><input v-model.trim="filter.keyword" aria-label="搜索订单" placeholder="订单号 / 商品名称"><input v-model.trim="filter.userId" aria-label="订单用户ID" placeholder="用户 ID" inputmode="numeric"><label>开始日期<input v-model="filter.startDate" type="date"></label><label>结束日期<input v-model="filter.endDate" type="date"></label><button class="secondary" :disabled="busy">查询订单</button></form><ElTable :data="list.items" empty-text="没有匹配的订单"><ElTableColumn prop="orderNo" label="订单编号" min-width="230"/><ElTableColumn prop="userId" label="用户 ID" width="90"/><ElTableColumn prop="product.name" label="商品" min-width="150"/><ElTableColumn prop="quantity" label="数量" width="70"/><ElTableColumn label="消耗产品券" min-width="120"><template #default="{row}">{{ money(row.totalUnits) }} 券</template></ElTableColumn><ElTableColumn prop="createdAt" label="购买时间" min-width="170"/><ElTableColumn label="操作" width="100"><template #default="{row}"><button class="table-button" @click="run(async()=>detail=await api(`/admin/orders/${row.id}`))">查看详情</button></template></ElTableColumn></ElTable><Pager :page="list.page" :total="list.total" :disabled="busy" @change="page=>run(()=>load(page))"/></section><Dialog v-if="detail" title="订单详情" @close="detail=null"><div class="admin-product dialog-product"><img :src="detail.product.image" :alt="detail.product.name"><span><strong>{{ detail.product.name }}</strong><small>{{ detail.product.subtitle }} × {{ detail.quantity }}</small></span></div><dl class="order-detail-list"><div><dt>订单号</dt><dd>{{ detail.orderNo }}</dd></div><div><dt>用户 ID</dt><dd>{{ detail.userId }}</dd></div><div><dt>购买时间</dt><dd>{{ detail.createdAt }}</dd></div><div><dt>消耗产品券</dt><dd>{{ money(detail.totalUnits) }} 券</dd></div><div><dt>收件人</dt><dd>{{ detail.address.recipient }} · {{ detail.address.phone }}</dd></div><div><dt>收货地址</dt><dd>{{ detail.address.detail }}</dd></div></dl><p class="state-note">保留下单时的商品和地址，线下安排发货。订单不支持取消或退款。</p></Dialog></template>
