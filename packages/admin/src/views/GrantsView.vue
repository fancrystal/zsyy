<script setup>
import {onMounted,reactive,ref} from 'vue'
import {ElTable,ElTableColumn} from 'element-plus'
import {api,queryString} from '../../../shared/api.js'
import {money} from '../../../shared/demo.mjs'
import {createRequestId} from '../../../shared/request-id.mjs'
import {useTask} from '../../../shared/use-task.js'
import Feedback from '../components/Feedback.vue'
import Pager from '../components/Pager.vue'
const props=defineProps({selectedUser:Object})
const {busy,error,notice,run}=useTask(),keyword=ref(''),users=ref({items:[],page:1,total:0}),selected=ref(null),history=ref({items:[],page:1,total:0}),form=reactive({amount:'',note:''})
let requestKey=createRequestId(),lastFingerprint=''
const search=async(page=1)=>users.value=await api(`/admin/users${queryString({keyword:keyword.value,page})}`)
async function choose(user){selected.value=await api(`/admin/users/${user.id}`);history.value=await api(`/admin/users/${user.id}/wallet/ledger?type=admin_grant`)}
onMounted(()=>run(async()=>{await search();if(props.selectedUser)await choose(props.selectedUser)}))
async function issue(){await run(async()=>{
  if(!selected.value)throw new Error('请先选择用户')
  if(!/^\d+(\.\d{1,2})?$/.test(form.amount)||Number(form.amount)<=0)throw new Error('请输入大于零且最多两位小数的产品券数量')
  if(!form.note.trim())throw new Error('请填写发放备注')
  const body={amountUnits:Math.round(Number(form.amount)*100),note:form.note.trim()},fingerprint=JSON.stringify([selected.value.id,body])
  if(lastFingerprint&&lastFingerprint!==fingerprint)requestKey=createRequestId()
  lastFingerprint=fingerprint
  await api(`/admin/users/${selected.value.id}/voucher-grants`,{method:'POST',body,key:requestKey})
  requestKey=createRequestId();lastFingerprint='';form.amount='';form.note='';await choose(selected.value)
},'产品券已发放，账户流水已更新')}
</script>
<template><Feedback :error="error" :notice="notice"/><div class="form-layout"><section class="panel"><div class="panel-heading"><h2>选择发放用户</h2></div><form class="filter-bar" @submit.prevent="run(()=>search())"><input v-model.trim="keyword" placeholder="用户名 / 昵称 / ID" aria-label="发券用户搜索"><button class="secondary" :disabled="busy">查找用户</button></form><ElTable :data="users.items"><ElTableColumn prop="id" label="ID" width="70"/><ElTableColumn prop="nickname" label="昵称"/><ElTableColumn prop="username" label="用户名"/><ElTableColumn label="操作" width="90"><template #default="{row}"><button class="table-button" :disabled="busy" @click="run(()=>choose(row))">选择用户</button></template></ElTableColumn></ElTable><Pager :page="users.page" :total="users.total" :disabled="busy" @change="page=>run(()=>search(page))"/></section><section class="panel"><div class="panel-heading"><h2>发放产品券</h2></div><form class="form-stack" @submit.prevent="issue"><label>目标用户<input readonly :value="selected?`${selected.nickname} · ID ${selected.id}`:'请从左侧列表选择用户'"></label><p v-if="selected" class="state-note">当前余额：{{ money(selected.balanceUnits) }} 券</p><label>发放数量 / 券<input v-model.trim="form.amount" inputmode="decimal" required placeholder="请输入正数，最多两位小数"></label><label>发放备注<textarea v-model="form.note" rows="3" required maxlength="500"></textarea></label><button class="primary" type="submit" :disabled="busy||!selected">确认发放产品券</button></form></section></div><section v-if="selected" class="panel"><div class="panel-heading"><h2>{{ selected.nickname }}的发券记录</h2></div><ElTable :data="history.items"><ElTableColumn prop="createdAt" label="发放时间" min-width="170"/><ElTableColumn label="发放数量" min-width="130"><template #default="{row}">+{{ money(row.amountUnits) }} 券</template></ElTableColumn><ElTableColumn prop="note" label="备注" min-width="200"/><ElTableColumn prop="adminId" label="操作管理员 ID" width="120"/></ElTable><Pager :page="history.page" :total="history.total" :disabled="busy" @change="page=>run(async()=>history=await api(`/admin/users/${selected.id}/wallet/ledger?type=admin_grant&page=${page}`))"/></section></template>
