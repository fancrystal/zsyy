import { rows, one } from '../db/database.js'
import { safeNumber } from '../errors.js'
import { publicUser, me, getAddress } from './accounts.js'
import { paginate } from './catalog.js'
import { marketSummary, dateView, wallet, ledgerView } from './accounting.js'
export async function incomeSummary(db,userId){
  const sums=await one(db,"SELECT COALESCE(SUM(CASE WHEN type='direct_referral_reward' THEN amount_units ELSE 0 END),0) AS referral,COALESCE(SUM(CASE WHEN type='team_rebate' THEN amount_units ELSE 0 END),0) AS team FROM wallet_ledger WHERE user_id=? AND type IN ('direct_referral_reward','team_rebate')",[userId])
  return {referralUnits:safeNumber(sums.referral),teamUnits:safeNumber(sums.team),totalUnits:safeNumber(BigInt(sums.referral)+BigInt(sums.team))}
}
export async function incomeRecords(db,userId,query={}){
  const category=(type,page)=>paginate(db,'SELECT * FROM wallet_ledger WHERE user_id=? AND type=? ORDER BY id DESC','SELECT COUNT(*) AS total FROM wallet_ledger WHERE user_id=? AND type=?',[userId,type],{page,pageSize:query.pageSize},ledgerView)
  const [summary,referral,team]=await Promise.all([incomeSummary(db,userId),category('direct_referral_reward',query.referralPage),category('team_rebate',query.teamPage)])
  return {summary,referral,team}
}
export async function teamInfo(db,id){
  const info=await marketSummary(db,id),users=await rows(db,'SELECT id,parent_id FROM users')
  const children=new Map()
  for(const u of users){const parent=String(u.parent_id);if(!children.has(parent))children.set(parent,[]);children.get(parent).push(String(u.id))}
  for(const market of info.markets){const stack=[market.id],seen=new Set();while(stack.length){const next=stack.pop();if(seen.has(next))continue;seen.add(next);stack.push(...(children.get(next)||[]))}market.members=seen.size}
  return {...info,incomeSummary:await incomeSummary(db,id)}
}
export async function users(db,query={}){
  const args=[],filter=query.keyword?' WHERE (u.username LIKE ? OR u.nickname LIKE ? OR CAST(u.id AS CHAR)=?)':''
  if(query.keyword)args.push(`%${String(query.keyword).slice(0,60)}%`,`%${String(query.keyword).slice(0,60)}%`,String(query.keyword))
  return paginate(db,`SELECT u.*,w.balance_units FROM users u JOIN wallets w ON w.user_id=u.id${filter} ORDER BY u.id DESC`,`SELECT COUNT(*) AS total FROM users u${filter}`,args,query,u=>({...publicUser(u),balanceUnits:safeNumber(u.balance_units)}))
}
export async function userDetail(db,id){return {...await me(db,id),...await wallet(db,id),address:await getAddress(db,id),team:await teamInfo(db,id)}}
export async function rebates(db,query={},userId=null){
  const target=userId||query.userId,filter=target?' WHERE r.user_id=?':'',args=target?[target]:[]
  const page=await paginate(db,`SELECT r.*,u.nickname FROM rebate_records r JOIN users u ON u.id=r.user_id${filter} ORDER BY r.id DESC`,`SELECT COUNT(*) AS total FROM rebate_records r${filter}`,args,query,r=>({id:String(r.id),userId:String(r.user_id),nickname:r.nickname,amountUnits:safeNumber(r.granted_units),eligibleUnits:safeNumber(r.eligible_units),entitledUnits:safeNumber(r.entitled_units),triggerType:r.trigger_type,createdAt:dateView(r.created_at)}))
  if(userId)return {...page,...await marketSummary(db,userId)}
  return page
}
export async function overview(db){
  const result=await one(db,`SELECT (SELECT COUNT(*) FROM users) AS users,(SELECT COUNT(*) FROM orders) AS orders,(SELECT COALESCE(SUM(total_units),0) FROM orders) AS spent,(SELECT COALESCE(SUM(granted_units),0) FROM rebate_records) AS rebates,(SELECT COUNT(*) FROM products WHERE is_active=1) AS products`)
  return {users:safeNumber(result.users),orders:safeNumber(result.orders),spentUnits:safeNumber(result.spent),rebateUnits:safeNumber(result.rebates),products:safeNumber(result.products)}
}
export async function jobRuns(db,query){return paginate(db,'SELECT * FROM job_runs ORDER BY id DESC','SELECT COUNT(*) AS total FROM job_runs',[],query,r=>({id:String(r.id),runKey:r.run_key,businessDate:r.business_date,status:r.status,phase:r.phase,cursorId:String(r.cursor_id),attempts:r.attempts,scanned:r.scanned,grantedUnits:safeNumber(r.granted_units),error:r.error_message,startedAt:dateView(r.started_at),finishedAt:dateView(r.finished_at)}))}
export async function issues(db,query){return paginate(db,'SELECT * FROM reconciliation_issues ORDER BY id DESC','SELECT COUNT(*) AS total FROM reconciliation_issues',[],query,r=>({id:String(r.id),userId:r.user_id===null?null:String(r.user_id),type:r.type,expected:r.expected_value,actual:r.actual_value,status:r.status,createdAt:dateView(r.created_at)}))}
