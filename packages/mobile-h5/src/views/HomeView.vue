<script setup>
import { state } from '../../../shared/store.js'
import Icon from '../../../shared/Icon.vue'
</script>
<template>
  <section class="hero"><div class="hero-grid" aria-hidden="true"></div><span class="eyebrow light">品质生活，从这里开始</span><h1>{{ state.company.tagline.replace('，', '，\n') }}</h1><p>一份用心的选择<br>让每一天，多一点美好。</p><RouterLink class="hero-button" to="/mall">探索品质好物 <Icon name="arrow" :size="16" /></RouterLink><div class="hero-seal" aria-hidden="true"><Icon name="leaf" :size="52" /><span>用心甄选</span></div><div class="hero-footer"><span>QUALITY FOR EVERYDAY</span><span>01 — 03</span></div></section>
  <div class="notice"><span class="notice-tag">欢迎</span><p>欢迎来到{{ state.company.name }}，发现日常好物。</p></div>
  <section class="section"><div class="section-title"><div><span class="eyebrow">ABOUT US</span><h2>认识我们</h2></div><span class="section-counter">01 / 关于</span></div><div class="about-card"><span class="mini-brand"><Icon name="leaf" :size="18" /> 为生活，用心选择</span><h3>好品质，让日常更值得</h3><p>{{ state.company.intro }}</p><div class="about-sign"><span class="short-line"></span>品质相伴 · 美好日常</div></div></section>
  <section class="values"><div><span class="value-icon"><Icon name="leaf" /></span><h3>用心选品</h3><p>从日常所需出发</p></div><div><span class="value-icon gold"><Icon name="shield" /></span><h3>品质为先</h3><p>关注每一处细节</p></div><div><span class="value-icon blue"><Icon name="ticket" /></span><h3>便捷购买</h3><p>产品券轻松使用</p></div></section>
  <section v-if="state.company.images?.length" class="company-gallery"><img v-for="image in state.company.images" :key="image" :src="image" alt="公司展示" loading="lazy"></section>
  <section class="section"><div class="section-title"><div><span class="eyebrow">OUR PHILOSOPHY</span><h2>让美好走进生活</h2></div></div><p class="company-body">{{ state.company.body }}</p><RouterLink to="/mall" class="shop-banner"><span><small>YOUR EVERYDAY SELECTION</small><strong>下一份心意，在商城等你</strong><span>挑选喜欢的好物</span></span><span class="circle-arrow"><Icon name="arrow" /></span></RouterLink></section>
  <footer class="page-footer"><span class="short-line"></span><span>品质生活，用心之选</span><span class="short-line"></span></footer>
</template>
