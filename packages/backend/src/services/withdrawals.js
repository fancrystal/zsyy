import bcrypt from 'bcryptjs'
import { createCipheriv,createDecipheriv,createHash,randomBytes } from 'node:crypto'
import { one,rows,transaction } from '../db/database.js'
import { fail,safeNumber } from '../errors.js'
import { changeBalance,hash,dateView,accountIntegrity } from './accounting.js'
import { paginate } from './catalog.js'

const keyFor=secret=>createHash('sha256').update(secret).digest()
function encrypt(value,secret){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',keyFor(secret),iv),data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return [iv,cipher.getAuthTag(),data].map(x=>x.toString('base64')).join('.')}
function decrypt(value,secret){const [iv,tag,data]=value.split('.').map(x=>Buffer.from(x,'base64')),cipher=createDecipheriv('aes-256-gcm',keyFor(secret),iv);cipher.setAuthTag(tag);return Buffer.concat([cipher.update(data),cipher.final()]).toString('utf8')}
const view=w=>({id:String(w.id),userId:String(w.user_id),username:w.username,amountUnits:safeNumber(w.amount_units),feeUnits:safeNumber(w.fee_units),netUnits:safeNumber(w.net_units),accountName:w.account_name,accountMasked:`****${w.account_last4}`,status:w.status,reason:w.reason,transferNote:w.transfer_note,hasProof:Number(w.has_proof)===1,createdAt:dateView(w.created_at)})
export async function apply(db,userId,input,idempotencyKey,secret){
  if(input.amountUnits<5000||input.amountUnits%5000!==0)fail(400,'INVALID_AMOUNT','最低提现 50 券，且必须是 50 的整数倍')
  const user=await one(db,'SELECT password_hash FROM users WHERE id=?',[userId]);if(!user||!await bcrypt.compare(input.password,user.password_hash))fail(401,'INVALID_CREDENTIALS','密码错误')
  return transaction(db,async conn=>{
    const fingerprint=hash([input.amountUnits,input.accountName,input.account]),existing=await one(conn,'SELECT * FROM withdrawals WHERE user_id=? AND idempotency_key=?',[userId,idempotencyKey])
    if(existing){if(existing.request_hash!==fingerprint)fail(409,'IDEMPOTENCY_CONFLICT','相同请求编号的内容不一致');return {...view(existing),replayed:true}}
    if(!await accountIntegrity(conn,userId))fail(409,'ACCOUNT_UNDER_REVIEW','账户存在账务异常，请联系管理员')
    const fee=safeNumber(BigInt(input.amountUnits)*6n/100n),net=input.amountUnits-fee
    const result=await rows(conn,'INSERT INTO withdrawals(user_id,amount_units,fee_units,net_units,account_name,account_cipher,account_last4,idempotency_key,request_hash) VALUES(?,?,?,?,?,?,?,?,?)',[userId,input.amountUnits,fee,net,input.accountName,encrypt(input.account,secret),input.account.slice(-4),idempotencyKey,fingerprint])
    const id=String(result.insertId),balanceUnits=await changeBalance(conn,userId,-input.amountUnits,{type:'withdrawal',title:'提现申请',note:`提现申请 #${id}`,sourceKey:`withdrawal:${id}`})
    return {id,feeUnits:fee,netUnits:net,balanceUnits,replayed:false}
  })
}
export async function list(db,query,userId=null){const filter=userId?' WHERE w.user_id=?':'',args=userId?[userId]:[];return paginate(db,`SELECT w.id,w.user_id,w.amount_units,w.fee_units,w.net_units,w.account_name,w.account_last4,w.status,w.reason,w.transfer_note,w.created_at,u.username,(w.proof IS NOT NULL) has_proof FROM withdrawals w JOIN users u ON u.id=w.user_id${filter} ORDER BY w.id DESC`,`SELECT COUNT(*) AS total FROM withdrawals w${filter}`,args,query,view)}
export async function byRequest(db,userId,key){const w=await one(db,'SELECT id FROM withdrawals WHERE user_id=? AND idempotency_key=?',[userId,key]);return {exists:!!w}}
export async function account(db,id,secret){const w=await one(db,'SELECT account_name,account_cipher FROM withdrawals WHERE id=?',[id]);if(!w)fail(404,'NOT_FOUND','提现申请不存在');return {accountName:w.account_name,account:decrypt(w.account_cipher,secret)}}
export async function action(db,id,adminId,action,input){return transaction(db,async conn=>{
  const w=await one(conn,'SELECT id,user_id,amount_units,status,(proof IS NOT NULL) has_proof FROM withdrawals WHERE id=? FOR UPDATE',[id]);if(!w)fail(404,'NOT_FOUND','提现申请不存在')
  if(action==='reject'){if(w.status!=='pending')fail(409,'INVALID_STATUS','仅待审核申请可驳回');await changeBalance(conn,w.user_id,safeNumber(w.amount_units),{type:'withdrawal_refund',title:'提现驳回退券',note:input.reason,sourceKey:`withdrawal:${id}:refund`,adminId});await rows(conn,"UPDATE withdrawals SET status='rejected',reason=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?",[input.reason,adminId,id])}
  else if(action==='approve'){if(w.status!=='pending')fail(409,'INVALID_STATUS','当前状态不可审核');await rows(conn,"UPDATE withdrawals SET status='approved',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?",[adminId,id])}
  else {if(w.status!=='approved'||Number(w.has_proof)!==1)fail(409,'INVALID_STATUS','请先审核并上传转账凭证');await rows(conn,"UPDATE withdrawals SET status='paid',paid_by=?,paid_at=CURRENT_TIMESTAMP,transfer_note=? WHERE id=?",[adminId,input.transferNote,id])}
  await rows(conn,'INSERT INTO audit_logs(admin_id,action,target_id,summary) VALUES(?,?,?,?)',[adminId,`withdrawal.${action}`,id,action]);return {ok:true}
})}
export async function saveProof(db,id,data,type){return transaction(db,async conn=>{const w=await one(conn,'SELECT status FROM withdrawals WHERE id=? FOR UPDATE',[id]);if(!w||w.status!=='approved')fail(409,'INVALID_STATUS','请先审核通过');await rows(conn,'UPDATE withdrawals SET proof=?,proof_type=? WHERE id=?',[data,type,id]);return {ok:true}})}
export async function proof(db,id,userId=null){const w=await one(db,`SELECT proof,proof_type FROM withdrawals WHERE id=? AND status ${userId?"='paid' AND user_id=?":"IN ('approved','paid')"}`,userId?[id,userId]:[id]);if(!w?.proof)fail(404,'NOT_FOUND','凭证不存在');return w}
