import {vi,test,expect,afterEach} from 'vitest'
vi.hoisted(()=>window.history.replaceState({},'','/'))
import {mount,flushPromises} from '@vue/test-utils'
import {createRouter,createMemoryHistory} from 'vue-router'
import Orders from '../packages/mobile-h5/src/views/OrdersView.vue'
import Mall from '../packages/mobile-h5/src/views/MallView.vue'
import {state} from '../packages/shared/store.js'
let wrapper
afterEach(()=>{wrapper?.unmount();document.body.innerHTML='';vi.unstubAllGlobals()})
const product={id:'12',name:'Sample商品',active:true,category:'日常洗护',priceUnits:12800,image:'/images/shampoo.png',color:'sage'}
test('a server-matched public order number is not discarded by local numeric-id filtering',async()=>{
  const order={id:'5',orderNo:'ZS202610250001',product,quantity:1,totalUnits:12800,createdAt:'2026-10-25 09:00:00'}
  vi.stubGlobal('fetch',async()=>new Response(JSON.stringify({data:{items:[order],page:1,total:1,totalSpentUnits:12800}})))
  const router=createRouter({history:createMemoryHistory(),routes:[{path:'/orders',component:Orders},{path:'/mall',component:{template:'<p>mall</p>'}}]});await router.push('/orders')
  wrapper=mount(Orders,{attachTo:document.body,global:{plugins:[router]}});await flushPromises()
  await wrapper.get('[aria-label="搜索订单"]').setValue('ZS202610250001');await new Promise(resolve=>setTimeout(resolve,280));await flushPromises()
  expect(document.querySelectorAll('.order-card')).toHaveLength(1)
})
test('entering the mall reloads the default catalog instead of preserving a stale empty search',async()=>{
  state.value.products=[];state.value.productPage={page:1,total:0,pageSize:20}
  vi.stubGlobal('fetch',async url=>{
    if(url==='/api/categories')return new Response(JSON.stringify({data:['日常洗护']}))
    if(url==='/api/me')return new Response(JSON.stringify({error:{message:'请登录'}}),{status:401})
    return new Response(JSON.stringify({data:{items:[product],page:1,total:1,pageSize:20}}))
  })
  const router=createRouter({history:createMemoryHistory(),routes:[{path:'/mall',component:Mall},{path:'/login',component:{template:'<p>login</p>'}},{path:'/me',component:{template:'<p>profile</p>'}}]});await router.push('/mall')
  wrapper=mount(Mall,{attachTo:document.body,global:{plugins:[router]}});await flushPromises()
  expect(document.querySelectorAll('.product-card')).toHaveLength(1)
  document.querySelector('.product-open').click();await flushPromises()
  expect(document.querySelector('dialog')).not.toBeNull()
  document.querySelector('dialog .primary').click();await flushPromises()
  expect(router.currentRoute.value.path).toBe('/login')
})
