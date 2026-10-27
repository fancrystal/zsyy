import { incomeText, incomeTitle } from '../../../shared/income.js'
import { createHash, randomUUID } from 'node:crypto'
import { rows, one, transaction } from '../db/database.js'
import { fail, safeNumber, parseJson } from '../errors.js'
import { productView, paginate } from './catalog.js'
import { getAddress } from './accounts.js'
export const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
export const dateView=value=>value?new Date(String(value).replace(' ','T')+'Z').toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'}):null
export const orderView=o=>({id:String(o.id),orderNo:o.order_no,userId:String(o.user_id),product:parseJson(o.product_snapshot),address:parseJson(o.address_snapshot),quantity:o.quantity,totalUnits:safeNumber(o.total_units),createdAt:dateView(o.created_at)})
export const ledgerView=l=>({id:String(l.id),type:l.type,title:incomeTitle(l),note:incomeText(l.note),amountUnits:safeNumber(l.amount_units),beforeUnits:safeNumber(l.balance_before_units),afterUnits:safeNumber(l.balance_after_units),adminId:l.admin_id===null?null:String(l.admin_id),createdAt:dateView(l.created_at)})
export const transferView=t=>({id:String(t.id),transferNo:t.transfer_no,direction:t.direction,amountUnits:safeNumber(t.amount_units),note:t.note,counterparty:{id:String(t.counterparty_id),phone:t.counterparty_phone,nickname:t.counterparty_nickname},createdAt:dateView(t.created_at)})
export async function changeBalance(conn,userId,amount,{type,title,note,sourceKey,adminId=null}){
  const wallet=await one(conn,'SELECT balance_units FROM wallets WHERE user_id=? FOR UPDATE',[userId]);if(!wallet)fail(404,'NOT_FOUND','用户钱包不存在')
  const before=BigInt(wallet.balance_units),after=before+BigInt(amount)
  if(after<0n)fail(409,'INSUFFICIENT_BALANCE','产品券余额不足')
  safeNumber(after)
  await rows(conn,'UPDATE wallets SET balance_units=? WHERE user_id=?',[after.toString(),userId])
  await rows(conn,'INSERT INTO wallet_ledger(user_id,type,title,note,amount_units,balance_before_units,balance_after_units,source_key,admin_id) VALUES(?,?,?,?,?,?,?,?,?)',[userId,type,title,note,String(amount),before.toString(),after.toString(),sourceKey,adminId])
  return safeNumber(after)
}
export async function grant(db,adminId,userId,input,key){return transaction(db,async conn=>{
  const fingerprint=hash([userId,input.amountUnits,input.note]),existing=await one(conn,'SELECT * FROM voucher_grants WHERE admin_id=? AND idempotency_key=?',[adminId,key])
  if(existing){if(existing.request_hash!==fingerprint)fail(409,'IDEMPOTENCY_CONFLICT','相同请求编号的内容不一致');return {replayed:true,id:String(existing.id)}}
  const result=await rows(conn,'INSERT INTO voucher_grants(user_id,admin_id,amount_units,note,idempotency_key,request_hash) VALUES(?,?,?,?,?,?)',[userId,adminId,input.amountUnits,input.note,key,fingerprint])
  const balanceUnits=await changeBalance(conn,userId,input.amountUnits,{type:'admin_grant',title:'后台发放',note:input.note,sourceKey:`grant:${result.insertId}`,adminId})
  await rows(conn,'INSERT INTO audit_logs(admin_id,action,target_id,summary) VALUES(?,?,?,?)',[adminId,'voucher.grant',userId,`${input.amountUnits} 最小券单位`])
  return {id:String(result.insertId),balanceUnits,replayed:false}
})}
export async function marketSummary(conn,userId){
  const markets=await rows(conn,`SELECT m.direct_child_user_id AS id,m.consumption_units,u.nickname AS name FROM team_market_totals m JOIN users u ON u.id=m.direct_child_user_id WHERE m.owner_user_id=? ORDER BY m.direct_child_user_id`,[userId])
  let total=0n,largest=0n,largestId=null
  for(const m of markets){const n=BigInt(m.consumption_units);total+=n;if(largestId===null||n>largest){largest=n;largestId=String(m.id)}}
  const account=await one(conn,'SELECT * FROM rebate_accounts WHERE user_id=?',[userId]);if(!account)fail(404,'NOT_FOUND','收益账户不存在')
  const entitled=(total-largest)/10n,paid=BigInt(account.paid_units)
  return {markets:markets.map(m=>({id:String(m.id),name:m.name,units:safeNumber(m.consumption_units)})),largestMarketId:largestId,summary:{total:safeNumber(total),largest:safeNumber(largest),eligible:safeNumber(total-largest),entitled:safeNumber(entitled),paid:safeNumber(paid),pending:safeNumber(entitled-paid)},hasAnomaly:!!account.has_anomaly}
}
export async function settle(conn,userId,triggerType,triggerRef){
  const info=await marketSummary(conn,userId),s=info.summary
  if(info.hasAnomaly||!await accountIntegrity(conn,userId))return 0
  await rows(conn,'UPDATE rebate_accounts SET entitled_units=? WHERE user_id=?',[s.entitled,userId])
  if(s.pending<0){await rows(conn,'UPDATE rebate_accounts SET has_anomaly=1 WHERE user_id=?',[userId]);await issue(conn,userId,'negative_rebate',s.entitled,s.paid);return 0}
  if(info.hasAnomaly||s.pending===0)return 0
  const result=await rows(conn,'INSERT INTO rebate_records(user_id,trigger_type,trigger_ref,total_units,largest_units,largest_child_id,eligible_units,entitled_units,paid_before_units,granted_units) VALUES(?,?,?,?,?,?,?,?,?,?)',[userId,triggerType,triggerRef,s.total,s.largest,info.largestMarketId,s.eligible,s.entitled,s.paid,s.pending])
  await changeBalance(conn,userId,s.pending,{type:'team_rebate',title:'团队佣金',note:'累计差额发放',sourceKey:`rebate:${result.insertId}`})
  await rows(conn,'UPDATE rebate_accounts SET paid_units=? WHERE user_id=?',[s.entitled,userId]);return s.pending
}
export async function issue(conn,userId,type,expected,actual){
  if(userId!==null)await rows(conn,'UPDATE rebate_accounts SET has_anomaly=1 WHERE user_id=?',[userId])
  if(!await one(conn,"SELECT id FROM reconciliation_issues WHERE user_id <=> ? AND type=? AND status='open'",[userId,type]))await rows(conn,'INSERT INTO reconciliation_issues(user_id,type,expected_value,actual_value) VALUES(?,?,?,?)',[userId,type,String(expected),String(actual)])
}
export async function accountIntegrity(conn,userId){
  const account=await one(conn,'SELECT paid_units,has_anomaly FROM rebate_accounts WHERE user_id=?',[userId]);if(!account||account.has_anomaly)return false
  const paid=await one(conn,'SELECT COALESCE(SUM(granted_units),0) AS total FROM rebate_records WHERE user_id=?',[userId])
  if(BigInt(account.paid_units)!==BigInt(paid.total)){await issue(conn,userId,'rebate_paid',paid.total,account.paid_units);return false}
  const wallet=await one(conn,'SELECT balance_units FROM wallets WHERE user_id=?',[userId]),ledger=await one(conn,'SELECT COALESCE(SUM(amount_units),0) AS total FROM wallet_ledger WHERE user_id=?',[userId])
  if(!wallet||BigInt(wallet.balance_units)!==BigInt(ledger.total)){await issue(conn,userId,'wallet_balance',ledger.total,wallet?.balance_units??'missing');return false}
  const bad=await one(conn,`SELECT COUNT(*) AS total FROM rebate_records r LEFT JOIN wallet_ledger l ON l.source_key=CONCAT('rebate:',r.id) WHERE r.user_id=? AND (l.id IS NULL OR l.user_id<>r.user_id OR l.amount_units<>r.granted_units OR l.type<>'team_rebate')`,[userId])
  if(Number(bad.total)){await issue(conn,userId,'rebate_ledger','matching',bad.total);return false}
  return true
}
export async function ancestors(conn,buyerId){
  const chain=[],seen=new Set();let child=String(buyerId)
  while(true){if(seen.has(child))fail(409,'TEAM_CYCLE','上下线关系存在循环，请联系管理员');seen.add(child)
    const u=await one(conn,'SELECT parent_id FROM users WHERE id=?',[child]);if(!u)fail(409,'TEAM_INVALID','上下线数据不完整')
    if(u.parent_id===null)break
    chain.push({owner:String(u.parent_id),child});child=String(u.parent_id)
  }return chain
}
async function directReferralReward(conn,orderId,buyerId,orderTotalUnits){
  const buyer=await one(conn,'SELECT parent_id FROM users WHERE id=? FOR UPDATE',[buyerId])
  if(buyer.parent_id===null)return null
  if(!await accountIntegrity(conn,String(buyer.parent_id)))return null
  const rewardUnits=safeNumber(BigInt(orderTotalUnits)*20n/100n)
  const result=await rows(conn,'INSERT INTO direct_referral_rewards(order_id,beneficiary_user_id,buyer_user_id,order_total_units,rate_bps,reward_units) VALUES(?,?,?,?,2000,?)',[orderId,buyer.parent_id,buyerId,orderTotalUnits,rewardUnits])
  await changeBalance(conn,buyer.parent_id,rewardUnits,{type:'direct_referral_reward',title:'推荐收益',note:'直属下线订单 20% 收益',sourceKey:`direct-referral:${result.insertId}`})
  return String(result.insertId)
}
export async function purchase(db,userId,input,key){const outcome=await transaction(db,async conn=>{
  const fingerprint=hash([input.productId,input.quantity,input.expectedPriceUnits]),existing=await one(conn,'SELECT * FROM orders WHERE user_id=? AND idempotency_key=?',[userId,key])
  if(existing){if(existing.request_hash!==fingerprint)fail(409,'IDEMPOTENCY_CONFLICT','相同请求编号的内容不一致');return {order:orderView(existing),replayed:true}}
  if(!await accountIntegrity(conn,userId))return {blocked:true}
  const raw=await one(conn,'SELECT * FROM products WHERE id=? FOR UPDATE',[input.productId]);if(!raw?.is_active)fail(409,'PRODUCT_UNAVAILABLE','商品不存在或已下架')
  const product=productView(raw);if(product.priceUnits!==input.expectedPriceUnits)fail(409,'PRICE_CHANGED','商品价格已变化，请重新打开详情')
  const address=await getAddress(conn,userId);if(!address)fail(409,'ADDRESS_REQUIRED','请先填写默认收货地址')
  const total=safeNumber(BigInt(product.priceUnits)*BigInt(input.quantity)),chain=await ancestors(conn,userId)
  const result=await rows(conn,'INSERT INTO orders(order_no,user_id,product_id,product_snapshot,address_snapshot,quantity,total_units,idempotency_key,request_hash) VALUES(?,?,?,?,?,?,?,?,?)',[`ZS${Date.now()}${randomUUID().slice(0,8)}`,userId,input.productId,JSON.stringify(product),JSON.stringify(address),input.quantity,total,key,fingerprint])
  const id=String(result.insertId)
  const balanceUnits=await changeBalance(conn,userId,-total,{type:'order_spend',title:'商品购买',note:`${product.name} × ${input.quantity}`,sourceKey:`order:${id}`})
  await directReferralReward(conn,id,userId,total)
  for(const item of chain){
    await rows(conn,'INSERT INTO team_market_totals(owner_user_id,direct_child_user_id,consumption_units) VALUES(?,?,?) ON DUPLICATE KEY UPDATE consumption_units=consumption_units+VALUES(consumption_units)',[item.owner,item.child,total])
    await settle(conn,item.owner,'order',id)
  }
  return {order:orderView(await one(conn,'SELECT * FROM orders WHERE id=?',[id])),balanceUnits,replayed:false}
})
  if(outcome.blocked)fail(409,'ACCOUNT_UNDER_REVIEW','账户存在账务异常，请联系管理员核对')
  return outcome
}
export async function transfer(db,senderId,input,key){return transaction(db,async conn=>{
  const fingerprint=hash([input.recipientPhone,input.amountUnits,input.note]),existing=await one(conn,'SELECT * FROM voucher_transfers WHERE sender_user_id=? AND idempotency_key=?',[senderId,key])
  if(existing){if(existing.request_hash!==fingerprint)fail(409,'IDEMPOTENCY_CONFLICT','相同请求编号的内容不一致');return {id:String(existing.id),replayed:true}}
  const recipient=await one(conn,'SELECT id FROM users WHERE username=? FOR UPDATE',[input.recipientPhone])
  if(!recipient)fail(404,'RECIPIENT_NOT_FOUND','未找到该手机号对应的用户')
  if(String(recipient.id)===String(senderId))fail(409,'TRANSFER_SELF','不能向自己转账')
  if(!await accountIntegrity(conn,senderId)||!await accountIntegrity(conn,String(recipient.id)))fail(409,'ACCOUNT_UNDER_REVIEW','账户存在账务异常，请联系管理员核对')
  const result=await rows(conn,'INSERT INTO voucher_transfers(transfer_no,sender_user_id,recipient_user_id,amount_units,note,idempotency_key,request_hash) VALUES(?,?,?,?,?,?,?)',[`ZT${Date.now()}${randomUUID().slice(0,8)}`,senderId,recipient.id,input.amountUnits,input.note,key,fingerprint])
  const id=String(result.insertId),note=input.note||'产品券转账'
  const balanceUnits=await changeBalance(conn,senderId,-input.amountUnits,{type:'transfer_out',title:'转出产品券',note,sourceKey:`transfer:${id}:out`})
  await changeBalance(conn,recipient.id,input.amountUnits,{type:'transfer_in',title:'转入产品券',note,sourceKey:`transfer:${id}:in`})
  return {id,balanceUnits,replayed:false}
})}
export async function wallet(db,id){const w=await one(db,'SELECT balance_units FROM wallets WHERE user_id=?',[id]);if(!w)fail(404,'NOT_FOUND','钱包不存在');return {balanceUnits:safeNumber(w.balance_units)}}
export async function ledger(db,id,query={}){const filter=query.type==='admin_grant'?' AND type=\'admin_grant\'':'';return paginate(db,`SELECT * FROM wallet_ledger WHERE user_id=?${filter} ORDER BY id DESC`,`SELECT COUNT(*) AS total FROM wallet_ledger WHERE user_id=?${filter}`,[id],query,ledgerView)}
export async function listOrders(db,query={},userId=null){
  const where=[],args=[]
  if(userId){where.push('user_id=?');args.push(userId)}else if(query.userId){where.push('user_id=?');args.push(query.userId)}
  if(query.keyword){where.push('(order_no LIKE ? OR product_snapshot->>\'$.name\' LIKE ?)');args.push(`%${String(query.keyword).slice(0,100)}%`,`%${String(query.keyword).slice(0,100)}%`)}
  for(const [name,operator] of [['startDate','>='],['endDate','<']])if(query[name]){
    const date=String(query[name]);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(`${date}T00:00:00+08:00`)))fail(400,'INVALID_DATE','日期参数无效')
    const time=new Date(Date.parse(`${date}T00:00:00+08:00`)+(name==='endDate'?86400000:0));where.push(`created_at${operator}?`);args.push(time.toISOString().slice(0,19).replace('T',' '))
  }
  const filter=where.length?' WHERE '+where.join(' AND '):''
  const page=await paginate(db,`SELECT * FROM orders${filter} ORDER BY id DESC`,`SELECT COUNT(*) AS total FROM orders${filter}`,args,query,orderView)
  return {...page,totalSpentUnits:safeNumber((await one(db,`SELECT COALESCE(SUM(total_units),0) AS total FROM orders${filter}`,args)).total)}
}
export async function getOrder(db,id,userId=null){const o=await one(db,`SELECT * FROM orders WHERE id=?${userId?' AND user_id=?':''}`,userId?[id,userId]:[id]);if(!o)fail(404,'NOT_FOUND','订单不存在');return orderView(o)}
