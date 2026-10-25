<script setup>
import { onMounted, ref } from 'vue'
import Icon from '../../shared/Icon.vue'
import { state, isDemo, bootstrap } from '../../shared/store.js'
const error=ref('')
async function load(){error.value='';try{await bootstrap()}catch(e){error.value=e.message}}
onMounted(load)
const tabs = [{ to: '/', label: '首页', icon: 'home' }, { to: '/mall', label: '商城', icon: 'bag' }, { to: '/orders', label: '订单', icon: 'orders' }, { to: '/me', label: '管理', icon: 'user' }]
</script>
<template>
  <div class="app-shell">
    <div v-if="isDemo" class="preview-label"><span class="status-dot"></span>界面预览 · 演示数据</div>
    <header class="brand-header"><RouterLink to="/" class="brand"><span class="brand-mark">券</span><span>{{ state.company.name }}<small>品质生活 · 用心之选</small></span></RouterLink><span class="brand-note">品质相伴<br>美好日常</span></header>
    <main class="page"><div v-if="error" class="error" role="alert">{{ error }} <button class="text-button" @click="load">重新加载</button></div><RouterView /></main>
    <nav class="tabbar" aria-label="底部导航"><RouterLink v-for="tab in tabs" :key="tab.to" :to="tab.to" :class="{ selected: $route.path === tab.to }" :aria-current="$route.path === tab.to ? 'page' : undefined"><span class="tab-icon"><Icon :name="tab.icon" /></span><span>{{ tab.label }}</span></RouterLink></nav>
  </div>
</template>
