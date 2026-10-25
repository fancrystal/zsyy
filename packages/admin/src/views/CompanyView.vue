<script setup>
import {onMounted,ref,reactive} from 'vue'
import {api} from '../../../shared/api.js'
import {useTask} from '../../../shared/use-task.js'
import Feedback from '../components/Feedback.vue'
const {busy,error,notice,run}=useTask(),ready=ref(false),images=ref(''),form=reactive({name:'',tagline:'',intro:'',body:''})
onMounted(()=>run(async()=>{const data=await api('/admin/company');Object.assign(form,{name:data.name,tagline:data.tagline,intro:data.intro,body:data.body});images.value=(data.images||[]).join('\n');ready.value=true}))
async function save(){await run(async()=>{await api('/admin/company',{method:'PUT',body:{...form,images:images.value.split('\n').map(s=>s.trim()).filter(Boolean)}})},'公司介绍已保存，手机首页刷新后生效')}
</script>
<template><section class="panel content-editor"><Feedback :error="error" :notice="notice"/><div class="panel-heading"><h2>首页展示内容</h2></div><form v-if="ready" class="form-stack" @submit.prevent="save"><label>商城名称<input v-model.trim="form.name" required maxlength="40"></label><label>品牌主标题<input v-model.trim="form.tagline" required maxlength="60"></label><label>公司简介<textarea v-model="form.intro" rows="4" required maxlength="2000"></textarea></label><label>品牌理念<textarea v-model="form.body" rows="5" maxlength="10000"></textarea></label><label>公司展示图片（每行一个地址，最多 10 张）<textarea v-model="images" rows="4" placeholder="https://... 或 /images/..."></textarea></label><p class="muted">使用已有图片网址；当前不需要额外图片上传服务。</p><button class="primary" :disabled="busy">保存公司介绍</button></form></section></template>
