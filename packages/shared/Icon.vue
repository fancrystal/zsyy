<script setup>
defineProps({ name: String, size: { type: [String, Number], default: 22 } })
const paths = {
  home: 'M3 10 12 3l9 7v10H5a2 2 0 0 1-2-2Zm6 10v-7h6v7',
  bag: 'M4 7h16l1 14H3L4 7Zm4 0V6a4 4 0 0 1 8 0v1',
  orders: 'M6 3h12a1 1 0 0 1 1 1v17l-3-2-4 2-4-2-3 2V4a1 1 0 0 1 1-1Zm3 5h6m-6 4h6',
  user: 'M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M12 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  arrow: 'm9 5 7 7-7 7', search: 'm21 21-5-5M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z',
  ticket: 'M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4V5Zm12 0v3m0 3v2m0 3v3',
  team: 'M5 21v-3a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v3M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6-8a4 4 0 0 1 0 8m3 4a4 4 0 0 1 2 4v2M6 3a4 4 0 0 0 0 8m-3 4a4 4 0 0 0-2 4v2',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Zm-5 0a3 3 0 1 0-6 0 3 3 0 0 0 6 0Z',
  copy: 'M9 9h12v12H9V9ZM5 15H3V3h12v2',
  chart: 'M4 3v17h17M8 15v-4m5 4V7m5 8v-6',
  check: 'm5 12 4 4L19 6', close: 'm6 6 12 12M6 18 18 6',
  leaf: 'M20 3C8 2 2 8 5 15s15 7 15-12ZM4 21 15 10',
  shield: 'm12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6l9-4Zm-4 9 3 3 5-6',
  clock: 'M12 8v5l3 2M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0Z',
  grid: 'M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7',
  settings: 'M4 7h16M4 17h16M8 4v6m8 4v6',
  plus: 'M12 5v14M5 12h14', back: 'm15 5-7 7 7 7',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Zm-9 12a3 3 0 0 0 6 0',
  logout: 'M9 3H3v18h6m6-14 5 5-5 5m-8-5h13'
}
</script>
<template><svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="paths[name] || paths.grid" /></svg></template>
