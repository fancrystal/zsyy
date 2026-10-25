<script setup>defineProps({error:String,notice:String})</script>
<template><p v-if="error" class="error" role="alert">{{ error }}</p><p v-if="notice" class="admin-success" role="status">{{ notice }}</p></template>
