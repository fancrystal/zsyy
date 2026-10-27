import {vi,test,expect,afterEach} from 'vitest'
vi.hoisted(()=>window.history.replaceState({},'','/'))
import {state,refreshSession,signOut,loadOrders,loadIncome} from '../packages/shared/store.js'
afterEach(()=>vi.unstubAllGlobals())
const reply=data=>new Response(JSON.stringify({data}))

test('income pagination keeps complete totals and discards a late response after logout',async()=>{
  const summary={referralUnits:5000,teamUnits:8000,totalUnits:13000}
  vi.stubGlobal('fetch',async()=>reply({summary,referral:{items:[{id:'r2'}],page:1,total:2},team:{items:[{id:'t1'}],page:1,total:1}}))
  await loadIncome()
  vi.stubGlobal('fetch',async()=>reply({summary,referral:{items:[{id:'r1'}],page:2,total:2},team:{items:[{id:'t1'}],page:1,total:1}}))
  await loadIncome('referral')
  expect(state.value.income.referral.items.map(x=>x.id)).toEqual(['r2','r1'])
  expect(state.value.income.summary.totalUnits).toBe(13000)
  let complete
  vi.stubGlobal('fetch',async url=>url.startsWith('/api/me/income')?new Promise(resolve=>{complete=()=>resolve(reply({summary,referral:{items:[{id:'private'}]},team:{items:[]}}))}):reply({ok:true}))
  const pending=loadIncome();await signOut();complete();await pending
  expect(state.value.income.summary.totalUnits).toBe(0)
  expect(state.value.income.referral.items).toEqual([])
})
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

test('an older account refresh cannot overwrite a newer income total',async()=>{
  let completeTeam
  vi.stubGlobal('fetch',async url=>{
    if(url==='/api/me')return reply({id:'1',nickname:'income-user'})
    if(url==='/api/me/team')return new Promise(resolve=>{completeTeam=()=>resolve(reply({markets:[],summary:{paid:0},largestMarketId:null,incomeSummary:{referralUnits:0,teamUnits:0,totalUnits:0}}))})
    if(url.startsWith('/api/me/income'))return reply({summary:{referralUnits:2000,teamUnits:0,totalUnits:2000},referral:{items:[],page:1,total:0},team:{items:[],page:1,total:0}})
    return reply({balanceUnits:0})
  })
  const pending=refreshSession()
  await vi.waitFor(()=>expect(completeTeam).toBeTypeOf('function'))
  await loadIncome();completeTeam();await pending
  expect(state.value.income.summary.totalUnits).toBe(2000)
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
