<script setup>
import {onMounted,ref} from 'vue'
import { ElTable,ElTableColumn } from 'element-plus'
import {api} from '../../../shared/api.js'
import {money} from '../../../shared/demo.mjs'
import {useTask} from '../../../shared/use-task.js'
import Feedback from '../components/Feedback.vue'
defineEmits(['go'])
const {busy,error,run}=useTask(),summary=ref({users:0,orders:0,products:0,spentUnits:0,rebateUnits:0}),orders=ref([])
async function load(){const [s,o]=await Promise.all([api('/admin/overview'),api('/admin/orders?pageSize=5')]);summary.value=s;orders.value=o.items}
onMounted(()=>run(load))
</script>
<template><Feedback :error="error"/><section class="welcome-banner"><div><span>把品质带进日常，把运营做得简单。</span><h2>每一份产品券，都有清晰的去向</h2><p>商品、用户、订单与团队返利，统一记录。</p></div><button class="secondary" :disabled="busy" @click="run(load)">刷新概览</button></section><div class="stats-grid"><div v-for="item in [{label:'用户数量',value:summary.users,unit:'人'},{label:'购买订单',value:summary.orders,unit:'笔'},{label:'累计产品券消费',value:money(summary.spentUnits),unit:'券'},{label:'累计已发返利',value:money(summary.rebateUnits),unit:'券'}]" :key="item.label" class="stat-card"><span>{{ item.label }}</span><strong>{{ item.value }}<small>{{ item.unit }}</small></strong></div></div><section class="panel"><div class="panel-heading"><h2>最近购买</h2><button class="text-link" @click="$emit('go','orders')">全部订单</button></div><ElTable :data="orders"><ElTableColumn prop="orderNo" label="订单编号" min-width="230"/><ElTableColumn prop="product.name" label="商品" min-width="150"/><ElTableColumn label="消耗产品券" min-width="130"><template #default="{row}">{{ money(row.totalUnits) }} 券</template></ElTableColumn><ElTableColumn prop="createdAt" label="购买时间" min-width="180"/></ElTable></section><section class="panel"><div class="quick-actions"><button @click="$emit('go','products')">商品管理</button><button @click="$emit('go','grants')">产品券发放</button><button @click="$emit('go','company')">公司介绍</button></div></section></template>
