import { randomUUID } from 'node:crypto'
import { createDatabase,transaction,one,rows } from './db/database.js'
import { validateConfig } from './config.js'
import { reconcile } from './services/reconcile.js'
import { changeBalance,marketSummary } from './services/accounting.js'
import { auditAccount,marketSource,rebuildMarkets } from './services/audit.js'
validateConfig()
const [command,...args]=process.argv.slice(2),params={}
for(let i=0;i<args.length;i+=2){if(!args[i].startsWith('--')||args[i+1]===undefined)throw new Error('Arguments must use --name value pairs');params[args[i].slice(2)]=args[i+1]}
const db=createDatabase()
try{
  if(command==='reconcile')console.log(JSON.stringify(await reconcile(db,`maintenance:${params.key||randomUUID()}`)))
  else if(command==='adjust'){
    if(!/^\d+$/.test(params.user||'')||!/^[-+]?\d+$/.test(params.units||'')||!params.note?.trim()||!params.key||params.key.length>80)throw new Error('adjust requires --user ID --units signed-minor-units --note reason --key unique-key')
    const units=BigInt(params.units);if(units===0n||units>1000000000000n||units< -1000000000000n)throw new Error('Invalid adjustment amount')
    const result=await transaction(db,async conn=>{
      const source=`manual:${params.key}`,old=await one(conn,'SELECT user_id,amount_units,note FROM wallet_ledger WHERE source_key=?',[source])
      if(old){if(String(old.user_id)!==params.user||BigInt(old.amount_units)!==units||old.note!==params.note)throw new Error('Adjustment key already used for different content');return {replayed:true}}
      const balanceUnits=await changeBalance(conn,params.user,units,{type:'manual_adjustment',title:'开发者调整',note:params.note,sourceKey:source})
      await rows(conn,'INSERT INTO audit_logs(action,target_id,summary) VALUES(?,?,?)',['maintenance.adjust',params.user,params.note]);return {balanceUnits}
    });console.log(JSON.stringify(result))
  }else if(command==='resolve'){
    if(!/^\d+$/.test(params.user||'')||!params.note?.trim())throw new Error('resolve requires --user ID --note reason')
    const result=await transaction(db,async conn=>{
      const all=await rows(conn,'SELECT id FROM users');let valid=true
      for(const user of all)if(!await auditAccount(conn,String(user.id)))valid=false
      if(!valid)return {resolved:false,reason:'Source inconsistencies remain. Correct the source data before unfreezing.'}
      if(!await rebuildMarkets(conn,params.user,await marketSource(conn)))return {resolved:false,reason:'Invalid team relationship'}
      const info=await marketSummary(conn,params.user)
      if(info.summary.pending<0)return {resolved:false,reason:'Entitlement is below the historical paid amount. Manual historical review is required.'}
      await rows(conn,'UPDATE rebate_accounts SET has_anomaly=0 WHERE user_id=?',[params.user])
      await rows(conn,"UPDATE reconciliation_issues SET status='resolved' WHERE user_id=? AND status='open'",[params.user])
      await rows(conn,'INSERT INTO audit_logs(action,target_id,summary) VALUES(?,?,?)',['maintenance.resolve',params.user,params.note]);return {resolved:true}
    });console.log(JSON.stringify(result))
  }else throw new Error('Usage: maintenance.js reconcile | adjust | resolve; see docs/10-fullstack-guide.md')
}catch(error){console.error(error.message);process.exitCode=1}finally{await db.end()}
