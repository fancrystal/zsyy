import { rows,one } from '../db/database.js'
import { issue,ancestors } from './accounting.js'
export async function auditAccount(conn,userId){
  const ledger=await rows(conn,'SELECT * FROM wallet_ledger WHERE user_id=? ORDER BY id',[userId]),orders=await rows(conn,'SELECT id,user_id,total_units FROM orders WHERE user_id=?',[userId]),grants=await rows(conn,'SELECT id,user_id,amount_units FROM voucher_grants WHERE user_id=?',[userId]),rebates=await rows(conn,'SELECT id,user_id,granted_units FROM rebate_records WHERE user_id=?',[userId]),transfers=await rows(conn,`SELECT t.*,out_ledger.user_id AS out_user_id,out_ledger.amount_units AS out_amount,in_ledger.user_id AS in_user_id,in_ledger.amount_units AS in_amount FROM voucher_transfers t LEFT JOIN wallet_ledger out_ledger ON out_ledger.source_key=CONCAT('transfer:',t.id,':out') LEFT JOIN wallet_ledger in_ledger ON in_ledger.source_key=CONCAT('transfer:',t.id,':in') WHERE t.sender_user_id=? OR t.recipient_user_id=?`,[userId,userId]),directRewards=await rows(conn,'SELECT r.*,o.user_id AS order_buyer_id,o.total_units AS order_total_units_actual,b.parent_id AS buyer_parent_id FROM direct_referral_rewards r JOIN orders o ON o.id=r.order_id JOIN users b ON b.id=r.buyer_user_id WHERE r.beneficiary_user_id=?',[userId])
  let bad=false,balance=0n;const sources=new Map()
  const record=async(type,expected,actual)=>{bad=true;await issue(conn,userId,type,expected,actual)}
  for(const entry of ledger){const after=balance+BigInt(entry.amount_units);if(balance!==BigInt(entry.balance_before_units)||after!==BigInt(entry.balance_after_units))await record('ledger_chain',after,entry.balance_after_units);balance=after}
  const wallet=await one(conn,'SELECT balance_units FROM wallets WHERE user_id=?',[userId])
  if(!wallet||BigInt(wallet.balance_units)!==balance)await record('wallet_balance',balance,wallet?.balance_units??'missing')
  for(const [list,prefix,field,sign,type] of [[orders,'order','total_units',-1n,'order_spend'],[grants,'grant','amount_units',1n,'admin_grant'],[rebates,'rebate','granted_units',1n,'team_rebate']])for(const item of list)sources.set(`${prefix}:${item.id}`,{amount:BigInt(item[field])*sign,type})
  for(const reward of directRewards){
    const expected=BigInt(reward.order_total_units)*BigInt(reward.rate_bps)/10000n
    if(String(reward.order_buyer_id)!==String(reward.buyer_user_id)||BigInt(reward.order_total_units_actual)!==BigInt(reward.order_total_units)||String(reward.buyer_parent_id)!==String(reward.beneficiary_user_id)||Number(reward.rate_bps)!==2000||BigInt(reward.reward_units)!==expected)await record('direct_referral_source','matching order and direct parent',String(reward.id))
    sources.set(`direct-referral:${reward.id}`,{amount:BigInt(reward.reward_units),type:'direct_referral_reward'})
  }
  for(const transfer of transfers){
    if(String(transfer.sender_user_id)===String(transfer.recipient_user_id)||BigInt(transfer.amount_units)<=0n||String(transfer.out_user_id)!==String(transfer.sender_user_id)||String(transfer.in_user_id)!==String(transfer.recipient_user_id)||BigInt(transfer.out_amount)!==-BigInt(transfer.amount_units)||BigInt(transfer.in_amount)!==BigInt(transfer.amount_units))await record('transfer_source','matching two-sided transfer',String(transfer.id))
    if(String(transfer.sender_user_id)===String(userId))sources.set(`transfer:${transfer.id}:out`,{amount:-BigInt(transfer.amount_units),type:'transfer_out'})
    if(String(transfer.recipient_user_id)===String(userId))sources.set(`transfer:${transfer.id}:in`,{amount:BigInt(transfer.amount_units),type:'transfer_in'})
  }
  const found=new Set()
  for(const entry of ledger){const source=sources.get(entry.source_key)
    if(!source){if(entry.type!=='manual_adjustment'||!entry.note?.trim())await record('orphan_ledger','existing business source',entry.source_key);continue}
    found.add(entry.source_key);if(BigInt(entry.amount_units)!==source.amount||entry.type!==source.type)await record('source_ledger',source.amount,entry.amount_units)
  }
  for(const [key,source] of sources)if(!found.has(key))await record('missing_ledger',source.amount,key)
  const paid=rebates.reduce((sum,r)=>sum+BigInt(r.granted_units),0n),account=await one(conn,'SELECT paid_units FROM rebate_accounts WHERE user_id=?',[userId])
  if(!account||BigInt(account.paid_units)!==paid)await record('rebate_paid',paid,account?.paid_units??'missing')
  let chain=[]
  try{chain=await ancestors(conn,userId)}catch{await record('team_relation','acyclic','invalid')}
  if(bad)for(const item of chain)await issue(conn,item.owner,'submarket_source','consistent',userId)
  return !bad
}
export async function marketSource(conn){
  const users=await rows(conn,'SELECT id,parent_id FROM users'),spent=await rows(conn,'SELECT user_id,SUM(total_units) AS total FROM orders GROUP BY user_id'),children=new Map(),totals=new Map(spent.map(s=>[String(s.user_id),BigInt(s.total)]))
  for(const u of users)if(u.parent_id!==null){const parent=String(u.parent_id);if(!children.has(parent))children.set(parent,[]);children.get(parent).push(String(u.id))}
  return {children,totals}
}
export async function rebuildMarkets(conn,ownerId,{children,totals}){
  const seen=new Set([ownerId]),markets=[]
  for(const child of children.get(ownerId)||[]){let sum=0n;const stack=[child]
    while(stack.length){const id=stack.pop();if(seen.has(id)){await issue(conn,ownerId,'team_relation','acyclic','cycle');return false}seen.add(id);sum+=totals.get(id)||0n;stack.push(...(children.get(id)||[]))}
    if(sum>BigInt(Number.MAX_SAFE_INTEGER)){await issue(conn,ownerId,'amount_limit','safe integer',sum);return false}markets.push({child,sum})
  }
  await rows(conn,'DELETE FROM team_market_totals WHERE owner_user_id=?',[ownerId])
  for(const m of markets)await rows(conn,'INSERT INTO team_market_totals(owner_user_id,direct_child_user_id,consumption_units) VALUES(?,?,?)',[ownerId,m.child,m.sum.toString()])
  return true
}
