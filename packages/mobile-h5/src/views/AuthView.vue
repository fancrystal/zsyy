<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { signIn } from '../../../shared/store.js'
const route=useRoute(),router=useRouter(),register=ref(!!route.query.invite),busy=ref(false),error=ref('')
const form=reactive({username:'',password:'',nickname:'',inviteCode:typeof route.query.invite==='string'?route.query.invite:''})
async function submit(){if(busy.value)return;busy.value=true;error.value=''
  try{const registration={username:form.username,password:form.password,inviteCode:form.inviteCode,nickname:form.nickname};await signIn(register.value?registration:{username:form.username,password:form.password},register.value);const path=typeof route.query.returnTo==='string'&&/^\/(?!\/)/.test(route.query.returnTo)?route.query.returnTo:'/me';await router.replace(path)}
  catch(e){error.value=e.message}finally{busy.value=false}
}
</script>
<template><section class="auth-card"><span class="eyebrow">WELCOME TO YOUR EVERYDAY</span><h1>{{ register?'加入品质生活':'欢迎回来' }}</h1><p class="muted">{{ register?'填写推荐人的邀请码，注册后即可使用产品券购买。':'登录后查看产品券、购买记录与我的团队。' }}</p><div class="auth-tabs"><button :class="{active:!register}" @click="register=false;error=''">手机号登录</button><button :class="{active:register}" @click="register=true;error=''">邀请码注册</button></div><form class="form-stack" @submit.prevent="submit"><label>手机号<input v-model.trim="form.username" type="tel" inputmode="tel" autocomplete="username" required maxlength="11" pattern="1[3-9][0-9]{9}" placeholder="请输入 11 位手机号"></label><label>密码<input v-model="form.password" type="password" :autocomplete="register?'new-password':'current-password'" required :minlength="register?6:1" maxlength="72" :placeholder="register?'至少 6 位密码':'请输入密码'"></label><label v-if="register">用户名<input v-model.trim="form.nickname" autocomplete="nickname" required maxlength="60" placeholder="设置页面显示的用户名"></label><label v-if="register">邀请码<input v-model.trim="form.inviteCode" autocomplete="off" required maxlength="32" placeholder="填写推荐人的邀请码"></label><p v-if="register" class="muted">每人绑定一个上线，注册后不可更换。</p><p v-if="error" class="error" role="alert">{{ error }}</p><button type="submit" class="primary full" :disabled="busy">{{ busy?'正在提交…':register?'注册并登录':'登录' }}</button></form></section></template>
