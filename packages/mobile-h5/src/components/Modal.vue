<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import Icon from '../../../shared/Icon.vue'
defineProps({ title: String, wide: Boolean })
const emit = defineEmits(['close'])
const dialog = ref(null)
const previous = document.activeElement
onMounted(() => dialog.value.showModal())
onBeforeUnmount(() => { dialog.value?.close(); previous?.focus() })
</script>
<template><Teleport to="body"><dialog ref="dialog" class="sheet" aria-labelledby="sheet-title" @cancel.prevent="emit('close')" @click="e => { if (e.target === dialog) emit('close') }"><div class="sheet-top"><h2 id="sheet-title">{{ title }}</h2><button type="button" class="icon-btn" aria-label="关闭" @click="emit('close')"><Icon name="close" /></button></div><div class="sheet-body"><slot /></div></dialog></Teleport></template>
