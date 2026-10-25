import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
export default defineConfig({ base: '/admin/', plugins: [vue()], resolve: { dedupe: ['vue'] }, cacheDir: '../../.cache/vite-admin', server: { fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] },proxy:{'/api':{target:'http://127.0.0.1:3000'}} } })
