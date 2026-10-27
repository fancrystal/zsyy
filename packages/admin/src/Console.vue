<script setup>
import {onMounted,ref,reactive} from 'vue'
import {api} from '../../shared/api.js'
import {useTask} from '../../shared/use-task.js'
import Icon from '../../shared/Icon.vue'
import Feedback from './components/Feedback.vue'
import Dashboard from './views/DashboardView.vue'
import Products from './views/ProductsView.vue'
import Orders from './views/OrdersView.vue'
import Users from './views/UsersView.vue'
import Grants from './views/GrantsView.vue'
import Rebates from './views/RebatesView.vue'
import Company from './views/CompanyView.vue'
import Jobs from './views/JobsView.vue'
const {busy,error,run}=useTask(),session=ref(null),checking=ref(true),active=ref('overview'),selectedUser=ref(null),form=reactive({username:'',password:''})
const menus=[{id:'overview',title:'运营概览',icon:'grid'},{id:'products',title:'商品管理',icon:'bag'},{id:'orders',title:'订单管理',icon:'orders'},{id:'users',title:'用户管理',icon:'team'},{id:'grants',title:'产品券发放',icon:'ticket'},{id:'rebates',title:'团队与收益',icon:'chart'},{id:'company',title:'公司介绍',icon:'home'},{id:'jobs',title:'结算与对账',icon:'clock'}]
onMounted(async()=>{try{session.value=await api('/admin/me')}catch(e){if(e.status!==401)error.value=e.message}finally{checking.value=false}})
async function login(){await run(async()=>{session.value=await api('/admin/auth/login',{method:'POST',body:{...form}});form.password=''})}
async function logout(){await run(async()=>{await api('/admin/auth/logout',{method:'POST'});session.value=null;selectedUser.value=null;active.value='overview'})}
function go(id){active.value=id;if(id!=='grants')selectedUser.value=null}
function select(user){selectedUser.value=user;active.value='grants'}
</script>
<template><div v-if="!session" class="admin-login"><section class="panel"><span class="admin-eyebrow">MANAGEMENT CONSOLE</span><h1>产品券商城管理后台</h1><p class="muted">使用管理员账号登录</p><p v-if="checking" class="state-note">正在检查登录状态…</p><form v-else class="form-stack" @submit.prevent="login"><label>管理员用户名<input v-model.trim="form.username" autocomplete="username" required maxlength="50"></label><label>密码<input v-model="form.password" type="password" autocomplete="current-password" required maxlength="72"></label><Feedback :error="error"/><button class="primary full" :disabled="busy" type="submit">登录管理后台</button></form></section></div><div v-else class="admin-shell"><aside class="sidebar"><div class="admin-brand"><span>券</span><div>产品券商城<small>MANAGEMENT CONSOLE</small></div></div><div class="side-section-label">工作空间</div><nav aria-label="后台菜单"><button v-for="item in menus" :key="item.id" :class="{active:active===item.id}" @click="go(item.id)"><Icon :name="item.icon" :size="19"/>{{ item.title }}<span v-if="active===item.id" class="active-dot"></span></button></nav><div class="sidebar-bottom"><Icon name="shield"/><span>简单运营，清晰记录</span></div></aside><div class="admin-main"><header class="admin-topbar"><span>管理后台 / {{ menus.find(m=>m.id===active)?.title }}</span><div><span>{{ session.username }}</span><button class="table-button" :disabled="busy" @click="logout">退出登录</button></div></header><main class="admin-content"><div class="admin-page-heading"><div><span class="admin-eyebrow">WORKSPACE / {{ active.toUpperCase() }}</span><h1>{{ menus.find(m=>m.id===active)?.title }}</h1></div></div><Feedback :error="error"/><Dashboard v-if="active==='overview'" @go="go"/><Products v-else-if="active==='products'"/><Orders v-else-if="active==='orders'"/><Users v-else-if="active==='users'" @grant="select"/><Grants v-else-if="active==='grants'" :key="selectedUser?.id||'all'" :selected-user="selectedUser"/><Rebates v-else-if="active==='rebates'"/><Company v-else-if="active==='company'"/><Jobs v-else-if="active==='jobs'"/><footer class="admin-footer">产品券商城管理后台<span>产品券消费 · 团队收益 · 记录可追溯</span></footer></main></div></div></template>
