import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { createDatabase } from '../src/db/database.js'
import { initialize } from '../src/initialize.js'
import { config } from '../src/config.js'

let db, app, admin, root, invite, productId
const pass='test-password-2026'
const key=()=>crypto.randomUUID()
async function register(name, inviteCode=invite) {
  const agent=request.agent(app)
  const r=await agent.post('/api/auth/register').send({username:name,password:pass,nickname:name,inviteCode})
  assert.equal(r.status,201,JSON.stringify(r.body)); return {agent,user:r.body.data}
}
async function grant(userId, amountUnits, idempotencyKey=key()) {
  return admin.post(`/api/admin/users/${userId}/voucher-grants`).set('Idempotency-Key',idempotencyKey).send({amountUnits,note:'integration test'})
}
async function address(agent) { assert.equal((await agent.put('/api/me/address').send({recipient:'测试用户',phone:'13800138000',detail:'上海市 测试路1号'})).status,200) }
async function buy(agent, amountUnits, idempotencyKey=key()) {
  const p=await admin.post('/api/admin/products').send({name:`商品${key()}`,subtitle:'测试规格',category:'日常洗护',priceUnits:amountUnits,image:'/images/shampoo.png',description:'测试商品',active:true})
  assert.equal(p.status,201,JSON.stringify(p.body)); productId=p.body.data.id
  return agent.post('/api/orders').set('Idempotency-Key',idempotencyKey).send({productId,quantity:1,expectedPriceUnits:amountUnits})
}
before(async()=>{
  assert.match(config.testDatabase,/_test$/); assert.notEqual(config.testDatabase,config.database)
  db=createDatabase(config.testDatabase)
  await initialize(db,{reset:true,adminPassword:pass,rootPassword:pass})
  app=createApp(db,{userSecret:'test-user-secret-with-more-than-32-chars',adminSecret:'test-admin-secret-with-more-than-32-chars'})
  admin=request.agent(app); root=request.agent(app)
  assert.equal((await admin.post('/api/admin/auth/login').send({username:'admin',password:pass})).status,200)
  assert.equal((await root.post('/api/auth/login').send({username:'root',password:pass})).status,200)
  invite=(await root.get('/api/me')).body.data.inviteCode
})
after(async()=>{await db?.end()})
test('health is JSON and user/admin credentials cannot cross authorization boundaries',async()=>{
  const health=await request(app).get('/api/health'); assert.equal(health.status,200); assert.equal(health.body.data.database,'connected')
  assert.equal((await root.get('/api/admin/users')).status,401)
  assert.equal((await admin.get('/api/me')).status,401)
  assert.equal((await request(app).get('/api/orders')).status,401)
  const wrong=await request(app).post('/api/auth/login').send({username:'root',password:'wrong'}); assert.equal(wrong.status,401)
})
test('registration binds one immutable parent, validates invitation and starts with zero balance',async()=>{
  const {agent,user}=await register('member-a'); assert.equal(user.parentId,'1')
  assert.equal((await agent.get('/api/me/wallet')).body.data.balanceUnits,0)
  assert.equal((await agent.patch('/api/me').send({nickname:'新昵称',parentId:'999'})).status,400)
  assert.equal((await request(app).post('/api/auth/register').send({username:'invalid-a',password:pass,inviteCode:'INVALID'})).status,400)
  assert.equal((await request(app).post('/api/auth/register').send({username:'member-a',password:pass,inviteCode:invite})).status,409)
})
test('grants are persistent and idempotent; same key with different content conflicts',async()=>{
  const {agent,user}=await register('grant-member'); const id=key()
  assert.equal((await grant(user.id,10000,id)).status,201); assert.equal((await grant(user.id,10000,id)).status,200)
  assert.equal((await grant(user.id,20000,id)).status,409)
  assert.equal((await agent.get('/api/me/wallet')).body.data.balanceUnits,10000)
  const ledger=(await agent.get('/api/me/wallet/ledger')).body.data.items; assert.equal(ledger.length,1); assert.equal(ledger[0].amountUnits,10000)
  const parallelKey=key(),parallel=await Promise.all([grant(user.id,123,parallelKey),grant(user.id,123,parallelKey)])
  assert.deepEqual(parallel.map(r=>r.status).sort(),[200,201]);assert.equal((await agent.get('/api/me/wallet')).body.data.balanceUnits,10123)
})
test('purchase rejects missing address, saves snapshots, and retries do not double debit',async()=>{
  const {agent,user}=await register('buyer'); await grant(user.id,50000)
  const r=await buy(agent,12800); assert.equal(r.status,409); assert.equal((await agent.get('/api/me/wallet')).body.data.balanceUnits,50000)
  await address(agent); const p=(await request(app).get('/api/products')).body.data.items[0]
  const id=key(), body={productId:p.id,quantity:1,expectedPriceUnits:p.priceUnits}
  const first=await agent.post('/api/orders').set('Idempotency-Key',id).send(body); assert.equal(first.status,201,JSON.stringify(first.body))
  assert.equal((await agent.post('/api/orders').set('Idempotency-Key',id).send(body)).status,200)
  assert.equal((await agent.post('/api/orders').set('Idempotency-Key',id).send({...body,quantity:2})).status,409)
  await agent.put('/api/me/address').send({recipient:'后来的地址',phone:'13900139000',detail:'另一条路'})
  const record=(await agent.get(`/api/orders/${first.body.data.order.id}`)).body.data; assert.equal(record.address.recipient,'测试用户')
  await admin.patch(`/api/admin/products/${p.id}`).send({name:'修改后的商品',priceUnits:p.priceUnits+100})
  assert.equal((await agent.get(`/api/orders/${record.id}`)).body.data.product.name,p.name)
  assert.equal((await agent.get(`/api/orders/${record.id}`)).body.data.product.priceUnits,p.priceUnits)
  const other=await register('other-buyer'); assert.equal((await other.agent.get(`/api/orders/${record.id}`)).status,404)
  assert.equal((await agent.post(`/api/orders/${record.id}/cancel`)).status,404)
})
test('parallel orders cannot overspend and failed transactions leave no order',async()=>{
  const {agent,user}=await register('parallel-buyer'); await grant(user.id,10000); await address(agent)
  const p=await admin.post('/api/admin/products').send({name:'并发商品',priceUnits:8000,category:'居家生活',image:'/images/bodywash.png',active:true})
  const responses=await Promise.all([1,2].map(()=>agent.post('/api/orders').set('Idempotency-Key',key()).send({productId:p.body.data.id,quantity:1,expectedPriceUnits:8000})))
  assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]); assert.equal((await agent.get('/api/me/wallet')).body.data.balanceUnits,2000)
  assert.equal((await agent.get('/api/orders')).body.data.total,1)
})
test('all ancestors receive market consumption and cumulative 10 percent differences exactly once',async()=>{
  const a=await register('team-parent'); const b=await register('team-b',a.user.inviteCode), c=await register('team-c',a.user.inviteCode), d=await register('team-d',a.user.inviteCode)
  const e=await register('team-e',b.user.inviteCode)
  for(const member of [b,c,d,e]) {await grant(member.user.id,5000000);await address(member.agent)}
  assert.equal((await buy(e.agent,1000000)).status,201)
  const parallel=await Promise.all([buy(c.agent,600000),buy(d.agent,400000)])
  assert.deepEqual(parallel.map(r=>r.status),[201,201])
  let team=(await a.agent.get('/api/me/team')).body.data; assert.equal(team.summary.total,2000000); assert.equal(team.summary.entitled,100000); assert.equal(team.summary.paid,100000)
  assert.equal((await b.agent.get('/api/me/team')).body.data.summary.total,1000000)
  assert.equal((await buy(e.agent,200000)).status,201)
  assert.equal((await a.agent.get('/api/me/wallet')).body.data.balanceUnits,100000)
  assert.equal((await buy(c.agent,900000)).status,201)
  team=(await a.agent.get('/api/me/team')).body.data; assert.equal(team.summary.paid,160000)
  assert.equal(team.largestMarketId,c.user.id)
  const overlap=await Promise.all([buy(c.agent,10000),admin.post('/api/admin/jobs/reconcile').set('Idempotency-Key',key()).send({})])
  assert.deepEqual(overlap.map(r=>r.status),[201,200])
  assert.equal((await admin.post('/api/admin/jobs/reconcile').set('Idempotency-Key',key()).send({})).status,200)
  assert.equal((await admin.post('/api/admin/jobs/reconcile').set('Idempotency-Key',key()).send({})).status,200)
  assert.equal((await a.agent.get('/api/me/wallet')).body.data.balanceUnits,160000)
  const account=(await a.agent.get('/api/me/rebates')).body.data; assert.equal(account.items.reduce((sum,r)=>sum+r.amountUnits,0),160000)
})
test('product and user filters, company images and actual task records are available to admin',async()=>{
  const users=await admin.get('/api/admin/users?keyword=team-parent&pageSize=2'); assert.equal(users.body.data.total,1)
  const id=users.body.data.items[0].id; assert.equal((await admin.get(`/api/admin/users/${id}`)).status,200)
  assert.equal((await admin.get(`/api/admin/users/${id}/wallet/ledger`)).status,200)
  assert.equal((await admin.get('/api/admin/job-runs')).body.data.total>=1,true)
  assert.equal((await admin.put('/api/admin/company').send({name:'测试商城',tagline:'测试品牌',intro:'公司简介',body:'公司正文',images:['/images/shampoo.png']})).status,200)
  assert.deepEqual((await request(app).get('/api/company')).body.data.images,['/images/shampoo.png'])
})
test('initialization repairs interrupted account setup without resetting existing account money',async()=>{
  const member=await register('repair-member');await grant(member.user.id,77700)
  await db.execute('DELETE FROM wallets WHERE user_id=?',[member.user.id]);await db.execute('DELETE FROM rebate_accounts WHERE user_id=?',[member.user.id])
  await initialize(db,{adminPassword:pass,rootPassword:pass})
  assert.equal((await member.agent.get('/api/me/wallet')).body.data.balanceUnits,77700)
  assert.equal((await member.agent.get('/api/me/team')).status,200)
})
test('reconciliation resumes a persisted cursor in small batches',async()=>{
  const {reconcile}=await import('../src/services/reconcile.js')
  const [[max]]=await db.query('SELECT MAX(id) AS id,COUNT(*) AS total FROM users')
  await db.execute("INSERT INTO job_runs(run_key,business_date,status,phase,cursor_id,max_user_id,scanned) VALUES('resume-test',CURRENT_DATE,'failed','verify',1,?,1)",[max.id])
  const result=await reconcile(db,'resume-test',{batchSize:2});assert.equal(result.status,'succeeded')
  const [[record]]=await db.query("SELECT * FROM job_runs WHERE run_key='resume-test'")
  assert.equal(Number(record.scanned),Number(max.total));assert.equal(record.phase,'complete')
})
test('a detected paid-total mismatch quarantines the beneficiary before another purchase can pay again',async()=>{
  const [[a]]=await db.execute("SELECT id FROM users WHERE username='team-parent'")
  const [[before]]=await db.execute('SELECT balance_units FROM wallets WHERE user_id=?',[a.id])
  await db.execute('UPDATE rebate_accounts SET paid_units=0 WHERE user_id=?',[a.id])
  const job=await admin.post('/api/admin/jobs/reconcile').set('Idempotency-Key',key()).send({});assert.equal(job.status,200);assert.equal(job.body.data.status,'anomalies')
  const [[account]]=await db.execute('SELECT has_anomaly FROM rebate_accounts WHERE user_id=?',[a.id]);assert.equal(account.has_anomaly,1)
  const buyer=request.agent(app);await buyer.post('/api/auth/login').send({username:'team-d',password:pass})
  assert.equal((await buy(buyer,10000)).status,201)
  const [[after]]=await db.execute('SELECT balance_units FROM wallets WHERE user_id=?',[a.id]);assert.equal(after.balance_units,before.balance_units)
})
test('an orphan grant ledger is detected even when its balance chain and wallet are consistent',async()=>{
  const member=await register('orphan-member')
  await db.execute("INSERT INTO wallet_ledger(user_id,type,title,note,amount_units,balance_before_units,balance_after_units,source_key) VALUES(?,'admin_grant','bad','bad',100,0,100,'grant:missing')",[member.user.id])
  await db.execute('UPDATE wallets SET balance_units=100 WHERE user_id=?',[member.user.id])
  await admin.post('/api/admin/jobs/reconcile').set('Idempotency-Key',key()).send({})
  const [[issue]]=await db.execute("SELECT COUNT(*) AS total FROM reconciliation_issues WHERE user_id=? AND type='orphan_ledger'",[member.user.id]);assert.equal(Number(issue.total),1)
})
test('an inconsistent wallet is refused and its anomaly remains recorded after the refusal',async()=>{
  const member=await register('guard-member');await address(member.agent)
  await db.execute('UPDATE wallets SET balance_units=10000 WHERE user_id=?',[member.user.id])
  const result=await buy(member.agent,1000);assert.equal(result.status,409)
  const [[account]]=await db.execute('SELECT has_anomaly FROM rebate_accounts WHERE user_id=?',[member.user.id]);assert.equal(account.has_anomaly,1)
  const [[issue]]=await db.execute("SELECT COUNT(*) AS total FROM reconciliation_issues WHERE user_id=? AND type='wallet_balance'",[member.user.id]);assert.equal(Number(issue.total),1)
  assert.equal((await member.agent.get('/api/orders')).body.data.total,0)
})
