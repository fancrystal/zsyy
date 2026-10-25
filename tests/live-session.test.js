import {vi,test,expect,afterEach} from 'vitest'
vi.hoisted(()=>window.history.replaceState({},'','/'))
import {state,refreshSession,signOut,loadOrders} from '../packages/shared/store.js'
afterEach(()=>vi.unstubAllGlobals())
const reply=data=>new Response(JSON.stringify({data}))
test('a late session refresh cannot restore private state after logout',async()=>{
  let complete
  vi.stubGlobal('fetch',async url=>{
    if(url==='/api/me')return new Promise(resolve=>{complete=()=>resolve(reply({id:'1',nickname:'previous-user'}))})
    if(url.endsWith('/me/wallet'))return reply({balanceUnits:1000})
    if(url.endsWith('/me/team'))return reply({markets:[],summary:{paid:0},largestMarketId:null})
    return reply(null)
  })
  const pending=refreshSession();await signOut();complete();await pending
  expect(state.value.profile).toBeNull();expect(state.value.balanceUnits).toBe(0)
})
test('a late private order response is discarded after logout',async()=>{
  let complete
  vi.stubGlobal('fetch',async url=>{
    if(url.startsWith('/api/orders'))return new Promise(resolve=>{complete=()=>resolve(reply({items:[{id:'old-order'}],total:1,totalSpentUnits:1000}))})
    return reply({ok:true})
  })
  const pending=loadOrders();await signOut();complete();await pending
  expect(state.value.orders).toEqual([])
})
