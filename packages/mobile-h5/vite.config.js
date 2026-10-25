import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
export default defineConfig({ plugins: [vue()], cacheDir: '../../.cache/vite-mobile', server: { fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] }, proxy: { '/api':{target:'http://127.0.0.1:3000'}, '/admin': { target: 'http://127.0.0.1:3013', ws: true } } } })
