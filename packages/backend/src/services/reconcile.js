import { randomUUID } from 'node:crypto'
import { setImmediate as yieldLoop } from 'node:timers/promises'
import { rows,one,transaction } from '../db/database.js'
import { settle } from './accounting.js'
import { auditAccount,marketSource,rebuildMarkets } from './audit.js'
import { safeNumber,fail } from '../errors.js'
export const businessDate=(date=new Date())=>date.toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'})
export async function reconcile(db,runKey,{batchSize=10,signal}={}){
  if(!Number.isInteger(batchSize)||batchSize<1||batchSize>100)throw new Error('Invalid reconciliation batch size')
  const owner=randomUUID()
  const acquired=await transaction(db,async conn=>{
    const old=await one(conn,'SELECT * FROM job_runs WHERE run_key=? FOR UPDATE',[runKey])
    if(old&&['succeeded','anomalies'].includes(old.status))return {id:String(old.id),status:old.status,replayed:true,scanned:old.scanned,grantedUnits:safeNumber(old.granted_units)}
    if(old?.status==='running'&&old.lease_until&&Date.parse(old.lease_until.replace(' ','T')+'Z')>Date.now())fail(409,'JOB_RUNNING','相同补查任务正在执行，请稍后重试')
    if(old){await rows(conn,"UPDATE job_runs SET status='running',error_message=NULL,owner_token=?,lease_until=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 60 SECOND),attempts=attempts+1 WHERE id=?",[owner,old.id]);return {id:String(old.id)}}
    const max=await one(conn,'SELECT COALESCE(MAX(id),0) AS id FROM users')
    const result=await rows(conn,"INSERT INTO job_runs(run_key,business_date,status,max_user_id,owner_token,lease_until,attempts) VALUES(?,?,'running',?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 60 SECOND),1)",[runKey,businessDate(),max.id,owner])
    return {id:String(result.insertId)}
  })
  if(acquired.replayed)return acquired
  try{
    while(true){
      signal?.throwIfAborted()
      const result=await transaction(db,async conn=>{
        const job=await one(conn,'SELECT * FROM job_runs WHERE id=? FOR UPDATE',[acquired.id])
        if(job.owner_token!==owner)fail(409,'JOB_LEASE_LOST','任务已由另一个进程继续执行')
        const batch=await rows(conn,`SELECT id FROM users WHERE id>? AND id<=? ORDER BY id LIMIT ${batchSize}`,[job.cursor_id,job.max_user_id])
        if(!batch.length){
          if(job.phase==='verify'&&job.source_issues===0){await rows(conn,"UPDATE job_runs SET phase='settle',cursor_id=0,lease_until=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 60 SECOND) WHERE id=?",[job.id]);return null}
          const open=await one(conn,"SELECT COUNT(*) AS total FROM reconciliation_issues WHERE status='open'")
          const status=job.source_issues>0||Number(open.total)>0?'anomalies':'succeeded'
          await rows(conn,"UPDATE job_runs SET status=?,phase='complete',finished_at=CURRENT_TIMESTAMP,lease_until=NULL WHERE id=?",[status,job.id])
          return {id:String(job.id),status,scanned:job.scanned,grantedUnits:safeNumber(job.granted_units)}
        }
        let issues=0,granted=0
        if(job.phase==='verify'){
          for(const user of batch)if(!await auditAccount(conn,String(user.id)))issues++
        }else{
          const source=await marketSource(conn)
          for(const user of batch)if(await rebuildMarkets(conn,String(user.id),source))granted+=await settle(conn,String(user.id),runKey.startsWith('daily:')?'daily':'maintenance',String(job.id))
        }
        await rows(conn,'UPDATE job_runs SET cursor_id=?,scanned=scanned+?,source_issues=source_issues+?,granted_units=granted_units+?,lease_until=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 60 SECOND) WHERE id=?',[batch.at(-1).id,job.phase==='verify'?batch.length:0,issues,granted,job.id])
        return null
      })
      if(result)return result
      await yieldLoop()
    }
  }catch(error){
    await rows(db,"UPDATE job_runs SET status='failed',error_message=?,lease_until=NULL,finished_at=CURRENT_TIMESTAMP WHERE id=? AND owner_token=?",[String(error.code||error.name||'RECONCILIATION_FAILED').slice(0,500),acquired.id,owner]);throw error
  }
}
export function startScheduler(db){
  let running=false;const controller=new AbortController()
  const run=async()=>{if(running||controller.signal.aborted)return;running=true
    try{const now=new Date(),hour=Number(now.toLocaleString('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',hourCycle:'h23'}));const target=hour>=2?now:new Date(now.getTime()-86400000);await reconcile(db,`daily:${businessDate(target)}`,{signal:controller.signal})}
    catch(error){if(error.name!=='AbortError')console.error('Scheduled reconciliation:',error.code||error.name)}finally{running=false}}
  run();const timer=setInterval(run,60000);timer.unref();return ()=>{controller.abort();clearInterval(timer)}
}
