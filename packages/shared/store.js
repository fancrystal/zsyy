import { ref, computed } from 'vue'
import * as demo from './demo-store.js'
import { api, queryString } from './api.js'
export const isDemo=new URLSearchParams(window.location.search).get('preview')==='1'
const emptySummary=()=>({total:0,largest:0,eligible:0,entitled:0,paid:0,pending:0})
const live=ref({company:{name:'产品券商城',tagline:'把品质，带进日常',intro:'',body:'',images:[]},profile:null,balanceUnits:0,address:null,products:[],categories:[],orders:[],ledger:[],markets:[],rebates:[],paidRebateUnits:0,summary:emptySummary(),largestMarketId:null,orderTotalUnits:0,productPage:{page:1,total:0,pageSize:20},orderPage:{page:1,total:0,pageSize:20},ledgerPage:{page:1,total:0,pageSize:20},rebatePage:{page:1,total:0,pageSize:20}})
export const state=isDemo?demo.state:live
export const rebate=isDemo?demo.rebate:computed(()=>state.value.summary)
export const largestMarketId=isDemo?demo.largestMarketId:computed(()=>state.value.largestMarketId)
export const update=demo.update
export const reset=demo.reset
export const editProduct=demo.editProduct
export const saveCompany=demo.saveCompany
export const grant=demo.grant
let productSequence=0,orderSequence=0,sessionVersion=0
function clearPersonal(){sessionVersion++;Object.assign(state.value,{profile:null,balanceUnits:0,address:null,orders:[],ledger:[],markets:[],rebates:[],paidRebateUnits:0,summary:emptySummary(),largestMarketId:null,orderTotalUnits:0,orderPage:{page:1,total:0,pageSize:20},ledgerPage:{page:1,total:0,pageSize:20},rebatePage:{page:1,total:0,pageSize:20}})}
export async function loadProducts(params={},append=false){if(isDemo)return;const seq=++productSequence,data=await api(`/products${queryString(params)}`);if(seq!==productSequence)return;state.value.products=append?[...state.value.products,...data.items]:data.items;state.value.productPage=data}
export async function loadOrders(params={},append=false){if(isDemo)return;const seq=++orderSequence,version=sessionVersion,data=await api(`/orders${queryString(params)}`);if(seq!==orderSequence||version!==sessionVersion)return;state.value.orders=append?[...state.value.orders,...data.items]:data.items;state.value.orderPage=data;state.value.orderTotalUnits=data.totalSpentUnits}
export async function loadLedger(page=1){if(isDemo)return;const version=sessionVersion,data=await api(`/me/wallet/ledger?page=${page}`);if(version!==sessionVersion)return;state.value.ledger=page===1?data.items:[...state.value.ledger,...data.items];state.value.ledgerPage=data}
export async function loadRebates(page=1){if(isDemo)return;const version=sessionVersion,data=await api(`/me/rebates?page=${page}`);if(version!==sessionVersion)return;state.value.rebates=page===1?data.items:[...state.value.rebates,...data.items];state.value.rebatePage=data;state.value.summary=data.summary;state.value.paidRebateUnits=data.summary.paid}
export async function refreshSession(){
  if(isDemo)return
  const version=sessionVersion
  try{const profile=await api('/me');if(version!==sessionVersion)return;state.value.profile=profile}catch(error){if(error.status!==401)throw error;if(version===sessionVersion)clearPersonal();return}
  const [wallet,address,team]=await Promise.all([api('/me/wallet'),api('/me/address'),api('/me/team')])
  if(version!==sessionVersion)return
  Object.assign(state.value,{balanceUnits:wallet.balanceUnits,address,markets:team.markets,summary:team.summary,paidRebateUnits:team.summary.paid,largestMarketId:team.largestMarketId})
}
export async function loadCategories(){if(isDemo)return;state.value.categories=await api('/categories')}
export async function bootstrap(){if(isDemo)return;const [company,categories]=await Promise.all([api('/company'),api('/categories')]);Object.assign(state.value,{company,categories});await refreshSession()}
export async function signIn(input,register=false){const profile=await api(register?'/auth/register':'/auth/login',{method:'POST',body:input});clearPersonal();state.value.profile=profile;await refreshSession()}
export async function signOut(){await api('/auth/logout',{method:'POST'});clearPersonal()}
export async function saveProfile(nickname){const version=sessionVersion,profile=await api('/me',{method:'PATCH',body:{nickname}});if(version===sessionVersion)state.value.profile=profile}
export async function saveAddress(address){if(isDemo)return demo.saveAddress(address);const version=sessionVersion,saved=await api('/me/address',{method:'PUT',body:address});if(version===sessionVersion)state.value.address=saved}
export async function purchase(request){
  if(isDemo)return demo.purchase(request)
  const version=sessionVersion
  const data=await api('/orders',{method:'POST',key:request.key,body:{productId:request.productId,quantity:request.quantity,expectedPriceUnits:request.expectedPriceUnits}})
  if(version!==sessionVersion)return data.order
  state.value.orders=[data.order,...state.value.orders.filter(o=>o.id!==data.order.id)]
  if(data.balanceUnits!==undefined)state.value.balanceUnits=data.balanceUnits
  refreshSession().catch(()=>{})
  return data.order
}
