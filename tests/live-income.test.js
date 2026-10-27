import { vi, test, expect, afterEach } from 'vitest'
vi.hoisted(()=>window.history.replaceState({},'', '/'))
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import ProfileView from '../packages/mobile-h5/src/views/ProfileView.vue'
import { state } from '../packages/shared/store.js'

let wrapper
afterEach(()=>{wrapper?.unmount();document.body.innerHTML='';vi.unstubAllGlobals()})
test('live income records keep category totals through paging and report a failed next page',async()=>{
  const summary={referralUnits:5000,teamUnits:80000,totalUnits:85000}
  let failNext=false
  vi.stubGlobal('fetch',async url=>{
    let data
    if(url.startsWith('/api/me/income')){
      const page=new URL(url,'http://localhost').searchParams.get('referralPage')
      if(failNext)return new Response(JSON.stringify({error:{message:'收益加载失败'}}),{status:503})
      data={summary,referral:{items:[{id:page==='2'?'r1':'r2',amountUnits:page==='2'?2000:3000,createdAt:'2026-10-27 10:00:00'}],page:Number(page),total:3},team:{items:[{id:'t1',amountUnits:80000,createdAt:'2026-10-27 09:00:00'}],page:1,total:1}}
    }else if(url==='/api/me')data={id:'1',nickname:'收益用户',inviteCode:'TEST'}
    else if(url==='/api/me/team')data={markets:[],summary:{total:0,paid:80000},incomeSummary:summary,largestMarketId:null}
    else if(url==='/api/me/wallet')data={balanceUnits:85000}
    else if(url.startsWith('/api/me/wallet/ledger'))data={items:[],page:1,total:0}
    else if(url==='/api/me/address')data=null
    else throw new Error(`unexpected request ${url}`)
    return new Response(JSON.stringify({data}))
  })
  state.value.profile={id:'1',nickname:'收益用户',inviteCode:'TEST'}
  const router=createRouter({history:createMemoryHistory(),routes:[{path:'/me',component:ProfileView},{path:'/orders',component:{template:'<p>orders</p>'}}]})
  await router.push('/me');wrapper=mount(ProfileView,{attachTo:document.body,global:{plugins:[router]}});await flushPromises()
  const screen=new DOMWrapper(document.body)
  expect(wrapper.get('.wallet-bottom').text()).toContain('850.00')
  await wrapper.findAll('.menu-group button')[2].trigger('click');await flushPromises()
  expect(screen.get('[aria-label="推荐收益记录"]').text()).toContain('50.00')
  await screen.get('[aria-label="推荐收益记录"] button').trigger('click');await flushPromises()
  expect(screen.findAll('[aria-label="推荐收益记录"] .ledger-row')).toHaveLength(2)
  expect(screen.findAll('[aria-label="团队佣金记录"] .ledger-row')).toHaveLength(1)
  expect(screen.get('dialog .stat-highlight').text()).toContain('850.00')
  failNext=true
  await screen.get('[aria-label="推荐收益记录"] button').trigger('click');await flushPromises()
  expect(screen.get('dialog [role="alert"]').text()).toContain('收益加载失败')
  expect(screen.findAll('[aria-label="推荐收益记录"] .ledger-row')).toHaveLength(2)
  expect(wrapper.text()).not.toContain('返利')
})
