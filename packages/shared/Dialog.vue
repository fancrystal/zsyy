<script setup>
import { onMounted,onBeforeUnmount,ref } from 'vue'
import Icon from './Icon.vue'
defineProps({title:String})
const emit=defineEmits(['close']),dialog=ref(null),previous=document.activeElement
onMounted(()=>dialog.value.showModal())
onBeforeUnmount(()=>{dialog.value?.close();previous?.focus()})
</script>
<template><Teleport to="body"><dialog ref="dialog" class="sheet dialog-centered" aria-labelledby="shared-dialog-title" @cancel.prevent="emit('close')"><div class="sheet-top"><h2 id="shared-dialog-title">{{ title }}</h2><button class="icon-btn" aria-label="关闭" type="button" @click="emit('close')"><Icon name="close" /></button></div><div class="sheet-body"><slot /></div></dialog></Teleport></template>
