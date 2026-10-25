import { vi, test, expect, afterEach } from 'vitest'
vi.hoisted(()=>window.history.replaceState({},'', '/'))
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import AuthView from '../packages/mobile-h5/src/views/AuthView.vue'
import { state } from '../packages/shared/store.js'
let wrapper
afterEach(()=>{wrapper?.unmount();document.body.innerHTML='';vi.unstubAllGlobals()})
test('real login form establishes a server session and follows an internal return path',async()=>{
  vi.stubGlobal('fetch',async url=>{
    const data=url.endsWith('/me/wallet')?{balanceUnits:12000}:url.endsWith('/me/address')?null:url.endsWith('/me/team')?{markets:[],summary:{paid:0},largestMarketId:null}:{id:'7',nickname:'真实用户',inviteCode:'REAL7'}
    return new Response(JSON.stringify({data}),{status:200})
  })
  const router=createRouter({history:createMemoryHistory(),routes:[{path:'/login',component:AuthView},{path:'/orders',component:{template:'<p>orders</p>'}}]})
  await router.push('/login?returnTo=/orders');wrapper=mount(AuthView,{attachTo:document.body,global:{plugins:[router]}})
  await wrapper.get('input[autocomplete="username"]').setValue('real-user')
  await wrapper.get('input[type="password"]').setValue('valid-password-2026')
  await wrapper.get('form').trigger('submit');await flushPromises()
  expect(state.value.profile.nickname).toBe('真实用户');expect(state.value.balanceUnits).toBe(12000);expect(router.currentRoute.value.path).toBe('/orders')
})
test('registration form exposes invitation input and server rejection keeps the form open',async()=>{
  vi.stubGlobal('fetch',async()=>new Response(JSON.stringify({error:{code:'INVALID_INVITE',message:'邀请码无效'}}),{status:400}))
  const router=createRouter({history:createMemoryHistory(),routes:[{path:'/login',component:AuthView}]});await router.push('/login?invite=INV123')
  wrapper=mount(AuthView,{attachTo:document.body,global:{plugins:[router]}})
  expect(wrapper.get('input[autocomplete="off"]').element.value).toBe('INV123')
  await wrapper.get('input[autocomplete="username"]').setValue('new-user');await wrapper.get('input[type="password"]').setValue('valid-password-2026')
  await wrapper.get('form').trigger('submit');await flushPromises();expect(wrapper.get('[role="alert"]').text()).toContain('邀请码无效')
})
