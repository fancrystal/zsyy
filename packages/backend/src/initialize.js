import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { createDatabase, rows, one, transaction } from './db/database.js'
import { migrate, tables } from './db/schema.js'
import { config, validateConfig } from './config.js'
import { createDemoState } from '../../shared/demo.mjs'
export async function initialize(db,{reset=false,adminPassword=process.env.INIT_ADMIN_PASSWORD,rootPassword=process.env.INIT_ROOT_PASSWORD}={}){
  if(reset){
    const database=(await one(db,'SELECT DATABASE() AS name')).name
    if(!database.endsWith('_test')||database===config.database)throw new Error('Reset is only allowed on a separate _test database')
    const conn=await db.getConnection()
    try{await conn.query('SET FOREIGN_KEY_CHECKS=0');for(const sql of [...tables].reverse()){const name=sql.match(/EXISTS (\w+)/)[1];await conn.query(`DROP TABLE IF EXISTS ${name}`)}}
    finally{await conn.query('SET FOREIGN_KEY_CHECKS=1');conn.release()}
  }
  await migrate(db)
  return transaction(db,async db=>{
  if(!await one(db,'SELECT id FROM admin_users LIMIT 1')){
    if(!adminPassword||adminPassword.length<10)throw new Error('Set INIT_ADMIN_PASSWORD with at least 10 characters')
    await rows(db,'INSERT INTO admin_users(username,password_hash) VALUES(?,?)',[process.env.INIT_ADMIN_USERNAME||'admin',await bcrypt.hash(adminPassword,10)])
  }
  if(!await one(db,'SELECT id FROM users LIMIT 1')){
    if(!rootPassword||rootPassword.length<10)throw new Error('Set INIT_ROOT_PASSWORD with at least 10 characters')
    const invite=randomBytes(6).toString('hex').toUpperCase()
    const result=await rows(db,'INSERT INTO users(username,password_hash,nickname,invite_code) VALUES(?,?,?,?)',[process.env.INIT_ROOT_USERNAME||'root',await bcrypt.hash(rootPassword,10),'初始用户',invite])
    await rows(db,'INSERT INTO wallets(user_id) VALUES(?)',[result.insertId]);await rows(db,'INSERT INTO rebate_accounts(user_id) VALUES(?)',[result.insertId])
  }
  await rows(db,`INSERT INTO wallets(user_id,balance_units) SELECT u.id,(SELECT COALESCE(SUM(l.amount_units),0) FROM wallet_ledger l WHERE l.user_id=u.id) FROM users u LEFT JOIN wallets w ON w.user_id=u.id WHERE w.user_id IS NULL`)
  await rows(db,`INSERT INTO rebate_accounts(user_id,paid_units,entitled_units) SELECT u.id,(SELECT COALESCE(SUM(r.granted_units),0) FROM rebate_records r WHERE r.user_id=u.id),(SELECT COALESCE(SUM(r.granted_units),0) FROM rebate_records r WHERE r.user_id=u.id) FROM users u LEFT JOIN rebate_accounts a ON a.user_id=u.id WHERE a.user_id IS NULL`)
  await rows(db,'INSERT IGNORE INTO team_market_totals(owner_user_id,direct_child_user_id) SELECT parent_id,id FROM users WHERE parent_id IS NOT NULL')
  const sample=createDemoState()
  await rows(db,'INSERT IGNORE INTO company_profile(id,content) VALUES(1,?)',[JSON.stringify({...sample.company,images:[]})])
  if(!await one(db,'SELECT id FROM products LIMIT 1'))for(const p of sample.products)await rows(db,'INSERT INTO products(name,subtitle,category,description,image,price_units,is_active) VALUES(?,?,?,?,?,?,?)',[p.name,p.subtitle,p.category,p.description,p.image,p.priceUnits,p.active])
  })
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  validateConfig();const db=createDatabase()
  try{await initialize(db);console.log('Database initialized. Account credentials are configured in the ignored local .env file.')}finally{await db.end()}
}
