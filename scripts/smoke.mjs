import fs from 'node:fs'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import '../packages/backend/src/config.js'
const base=process.env.SMOKE_BASE_URL||'http://localhost:3011',jar=new Map()
if(process.env.NODE_ENV==='production'||!['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname))throw new Error('Smoke tests are restricted to local development services')
async function call(path,{method='GET',body,key}={}){
  const response=await fetch(`${base}/api${path}`,{method,headers:{'Content-Type':'application/json','Origin':new URL(base).origin,'Cookie':[...jar.values()].join('; '),...(key?{'Idempotency-Key':key}:{})},body:body===undefined?undefined:JSON.stringify(body)})
  for(const cookie of response.headers.getSetCookie()){const item=cookie.split(';')[0],name=item.split('=')[0];jar.set(name,item)}
  const result=await response.json();if(!response.ok)throw new Error(`${method} ${path}: ${response.status} ${result.error?.message}`);return result.data
}
assert.equal((await call('/health')).database,'connected')
await call('/admin/auth/login',{method:'POST',body:{username:process.env.INIT_ADMIN_USERNAME,password:process.env.INIT_ADMIN_PASSWORD}})
await call('/auth/login',{method:'POST',body:{username:process.env.INIT_ROOT_USERNAME,password:process.env.INIT_ROOT_PASSWORD}})
const parent=await call('/me')
fs.mkdirSync('.cache',{recursive:true})
let account
if(fs.existsSync('.cache/smoke-account.json')){account=JSON.parse(fs.readFileSync('.cache/smoke-account.json','utf8'));await call('/auth/login',{method:'POST',body:{username:account.username,password:account.password}})}
else{account={username:`qa-${Date.now()}`,password:randomBytes(16).toString('hex')};const user=await call('/auth/register',{method:'POST',body:{...account,nickname:'本地联调用户',inviteCode:parent.inviteCode}});account.id=user.id;fs.writeFileSync('.cache/smoke-account.json',JSON.stringify(account,null,2))}
await call('/me/address',{method:'PUT',body:{recipient:'联调用户',phone:'13800138000',detail:'本地测试地址（不用于实际发货）'}})
await call('/me',{method:'PATCH',body:{nickname:'本地联调用户'}})
await call(`/admin/users/${account.id}/voucher-grants`,{method:'POST',key:`smoke-grant-v1-${account.id}`,body:{amountUnits:50000,note:'本地联调发放（非生产）'}})
if(!account.product){const list=await call('/products');assert.ok(list.items.length);account.product={productId:list.items[0].id,quantity:1,expectedPriceUnits:list.items[0].priceUnits};fs.writeFileSync('.cache/smoke-account.json',JSON.stringify(account,null,2))}
const order=await call('/orders',{method:'POST',key:`smoke-order-v1-${account.id}`,body:account.product})
const retry=await call('/orders',{method:'POST',key:`smoke-order-v1-${account.id}`,body:account.product})
assert.equal(order.order.id,retry.order.id)
function maintenance(args){const result=spawnSync(process.execPath,['packages/backend/src/maintenance.js',...args],{encoding:'utf8'});if(result.status!==0)throw new Error(result.stderr||'Maintenance failed');return JSON.parse(result.stdout)}
const adjustment=(units,key)=>maintenance(['adjust','--user',account.id,'--units',String(units),'--note','Local acceptance check','--key',`${key}-${account.id}`])
adjustment(-1,'smoke-minus-v1');assert.equal(adjustment(-1,'smoke-minus-v1').replayed,true);adjustment(1,'smoke-plus-v1')
assert.equal(maintenance(['resolve','--user',account.id,'--note','Local acceptance source check']).resolved,true)
const wallet=await call('/me/wallet'),orders=await call(`/orders?keyword=${encodeURIComponent(order.order.orderNo)}`)
assert.equal(orders.total,1);assert.equal(wallet.balanceUnits,50000-account.product.expectedPriceUnits)
const job=await call('/admin/jobs/reconcile',{method:'POST',key:`smoke-reconcile-v1-${account.id}`,body:{}});assert.equal(job.status,'succeeded')
const result={health:'connected',userId:account.id,orderNo:order.order.orderNo,walletUnits:wallet.balanceUnits,replayedOrderMatched:true,reconciliation:job.status}
fs.writeFileSync('.cache/acceptance-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2))
await call('/auth/logout',{method:'POST'});await call('/admin/auth/logout',{method:'POST'})
