<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { signIn } from '../../../shared/store.js'
const route=useRoute(),router=useRouter(),register=ref(!!route.query.invite),busy=ref(false),error=ref('')
const form=reactive({username:'',password:'',nickname:'',inviteCode:typeof route.query.invite==='string'?route.query.invite:''})
async function submit(){if(busy.value)return;busy.value=true;error.value=''
  try{const registration={username:form.username,password:form.password,inviteCode:form.inviteCode,...(form.nickname?{nickname:form.nickname}:{})};await signIn(register.value?registration:{username:form.username,password:form.password},register.value);const path=typeof route.query.returnTo==='string'&&/^\/(?!\/)/.test(route.query.returnTo)?route.query.returnTo:'/me';await router.replace(path)}
  catch(e){error.value=e.message}finally{busy.value=false}
}
</script>
<template><section class="auth-card"><span class="eyebrow">WELCOME TO YOUR EVERYDAY</span><h1>{{ register?'加入品质生活':'欢迎回来' }}</h1><p class="muted">{{ register?'填写推荐人的邀请码，注册后即可使用产品券购买。':'登录后查看产品券、购买记录与我的团队。' }}</p><div class="auth-tabs"><button :class="{active:!register}" @click="register=false;error=''">账号登录</button><button :class="{active:register}" @click="register=true;error=''">邀请码注册</button></div><form class="form-stack" @submit.prevent="submit"><label>用户名<input v-model.trim="form.username" autocomplete="username" required minlength="3" maxlength="50" pattern="[a-zA-Z0-9_-]{3,50}" placeholder="3–50 位字母、数字、下划线或短横线"></label><label>密码<input v-model="form.password" type="password" :autocomplete="register?'new-password':'current-password'" required :minlength="register?10:1" maxlength="72" placeholder="请输入密码（注册至少 10 位）"></label><label v-if="register">昵称<input v-model.trim="form.nickname" autocomplete="nickname" maxlength="60" placeholder="选填，默认使用用户名"></label><label v-if="register">邀请码<input v-model.trim="form.inviteCode" autocomplete="off" required maxlength="32" placeholder="填写推荐人的邀请码"></label><p v-if="register" class="muted">每人绑定一个上线，注册后不可更换。</p><p v-if="error" class="error" role="alert">{{ error }}</p><button type="submit" class="primary full" :disabled="busy">{{ busy?'正在提交…':register?'注册并登录':'登录' }}</button></form></section></template>
