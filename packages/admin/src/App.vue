<script setup>
import Console from './Console.vue'
import DemoConsole from './DemoConsole.vue'
const preview=new URLSearchParams(window.location.search).get('preview')==='1'
</script>
<template><DemoConsole v-if="preview"/><Console v-else/></template>
