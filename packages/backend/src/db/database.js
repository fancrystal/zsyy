import mysql from 'mysql2/promise'
import { config } from '../config.js'
export function createDatabase(database=config.database){
  if(!/^[a-zA-Z0-9_]+$/.test(database)) throw new Error('Invalid database name')
  const pool=mysql.createPool({host:config.host,port:config.dbPort,user:config.user,password:config.password,database,connectionLimit:10,supportBigNumbers:true,bigNumberStrings:true,charset:'utf8mb4',timezone:'Z',dateStrings:true})
  pool.on('connection',connection=>connection.query("SET time_zone = '+00:00'"))
  return pool
}
export async function rows(db,sql,args=[]){const [result]=await db.execute(sql,args);return result}
export async function one(db,sql,args=[]){return (await rows(db,sql,args))[0]}
export async function transaction(db,fn){
  for(let attempt=0;attempt<3;attempt++){
    const conn=await db.getConnection()
    try{await conn.beginTransaction();await conn.query('SELECT id FROM accounting_lock WHERE id=1 FOR UPDATE');const result=await fn(conn);await conn.commit();return result}
    catch(error){await conn.rollback();if(error.code==='ER_LOCK_DEADLOCK'&&attempt<2)continue;throw error}
    finally{conn.release()}
  }
}
