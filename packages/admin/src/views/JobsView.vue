<script setup>
import {onMounted,ref} from 'vue'
import {ElTable,ElTableColumn,ElTag} from 'element-plus'
import {api} from '../../../shared/api.js'
import {createRequestId} from '../../../shared/request-id.mjs'
import {money} from '../../../shared/demo.mjs'
import {useTask} from '../../../shared/use-task.js'
import Pager from '../components/Pager.vue'
import Feedback from '../components/Feedback.vue'
const {busy,error,notice,run}=useTask(),jobs=ref({items:[],page:1,total:0}),issues=ref({items:[],page:1,total:0})
let requestKey=createRequestId()
async function load(){[jobs.value,issues.value]=await Promise.all([api('/admin/job-runs'),api('/admin/reconciliation-issues')])}
onMounted(()=>run(load))
async function reconcile(){await run(async()=>{const result=await api('/admin/jobs/reconcile',{method:'POST',body:{},key:requestKey});requestKey=createRequestId();await load();if(result.status==='anomalies')throw new Error('补查完成，发现账务异常，请查看下方异常记录')},'补查完成，重复运行不会重复发券')}
const statuses={running:'运行中',succeeded:'成功',failed:'失败',anomalies:'存在异常'}
</script>
<template><Feedback :error="error" :notice="notice"/><section class="panel"><div class="panel-heading"><div><h2>结算与对账</h2><p>每天北京时间 02:00 自动补查；服务启动时补跑最近应执行任务。</p></div><button class="primary" :disabled="busy" @click="reconcile">{{ busy?'执行中…':'立即补查' }}</button></div><p class="state-note">消费时实时补发累计差额。补查核对订单、钱包、流水与收益，并重建派生市场汇总。负差额不会自动扣回，异常由开发者核对处理。</p></section><section class="panel"><div class="panel-heading"><h2>任务运行记录</h2><button class="text-link" :disabled="busy" @click="run(load)">刷新记录</button></div><ElTable :data="jobs.items" empty-text="暂无任务"><ElTableColumn prop="runKey" label="任务编号" min-width="260"/><ElTableColumn label="状态" min-width="110"><template #default="{row}"><ElTag :type="row.status==='succeeded'?'success':'warning'">{{ statuses[row.status]||row.status }}</ElTag></template></ElTableColumn><ElTableColumn prop="scanned" label="检查用户" width="100"/><ElTableColumn label="补发产品券" min-width="130"><template #default="{row}">{{ money(row.grantedUnits) }} 券</template></ElTableColumn><ElTableColumn prop="startedAt" label="开始时间" min-width="170"/><ElTableColumn prop="error" label="失败原因" min-width="150"/></ElTable><Pager :page="jobs.page" :total="jobs.total" :disabled="busy" @change="page=>run(async()=>jobs=await api(`/admin/job-runs?page=${page}`))"/></section><section class="panel"><div class="panel-heading"><h2>账务异常记录</h2></div><ElTable :data="issues.items" empty-text="暂无账务异常"><ElTableColumn prop="userId" label="用户 ID" width="90"/><ElTableColumn prop="type" label="问题类型" min-width="180"/><ElTableColumn prop="expected" label="期望值（最小单位）" min-width="140"/><ElTableColumn prop="actual" label="实际值（最小单位）" min-width="140"/><ElTableColumn prop="status" label="状态" width="90"/><ElTableColumn prop="createdAt" label="发现时间" min-width="170"/></ElTable><Pager :page="issues.page" :total="issues.total" :disabled="busy" @change="page=>run(async()=>issues=await api(`/admin/reconciliation-issues?page=${page}`))"/></section></template>
