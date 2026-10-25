import { defineConfig } from 'vitest/config'
import vue from './packages/mobile-h5/node_modules/@vitejs/plugin-vue/dist/index.mjs'
import { fileURLToPath } from 'node:url'
const local = path => fileURLToPath(new URL(path, import.meta.url))
export default defineConfig({
  plugins: [vue()],
  resolve: { alias: {
    vue: local('./packages/shared/node_modules/vue/dist/vue.runtime.esm-bundler.js'),
    'vue-router': local('./packages/mobile-h5/node_modules/vue-router/dist/vue-router.mjs')
  } },
  test: { environment: 'jsdom', environmentOptions: { jsdom: { url: 'http://localhost:3011/?preview=1' } }, include: ['tests/**/*.test.js'], setupFiles: ['tests/setup.js'], pool: 'forks', poolOptions: { forks: { singleFork: true } } }
})
