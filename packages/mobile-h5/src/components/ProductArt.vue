<script setup>defineProps({ product: Object, large: Boolean })</script>
<template><div class="product-art" :class="[product.color, { large }]"><span class="art-ring" aria-hidden="true"></span><img :src="product.image" :alt="product.name" loading="lazy"><span class="art-caption">日常所需 · 用心甄选</span></div></template>
