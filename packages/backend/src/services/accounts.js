import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { rows, one, transaction } from '../db/database.js'
import { fail } from '../errors.js'
export const publicUser=u=>({id:String(u.id),username:u.username,nickname:u.nickname,inviteCode:u.invite_code,parentId:u.parent_id===null?null:String(u.parent_id),createdAt:u.created_at})
export async function register(db,input){
  const hash=await bcrypt.hash(input.password,10)
  return transaction(db,async conn=>{
    const parent=await one(conn,'SELECT id FROM users WHERE invite_code=?',[input.inviteCode.toUpperCase()])
    if(!parent)fail(400,'INVALID_INVITE','邀请码无效')
    if(await one(conn,'SELECT id FROM users WHERE username=?',[input.username]))fail(409,'USERNAME_EXISTS','用户名已存在')
    const invite=randomBytes(6).toString('hex').toUpperCase()
    const result=await rows(conn,'INSERT INTO users(username,password_hash,nickname,invite_code,parent_id) VALUES(?,?,?,?,?)',[input.username,hash,input.nickname||input.username,invite,parent.id])
    const id=String(result.insertId)
    await rows(conn,'INSERT INTO wallets(user_id) VALUES(?)',[id]);await rows(conn,'INSERT INTO rebate_accounts(user_id) VALUES(?)',[id])
    await rows(conn,'INSERT INTO team_market_totals(owner_user_id,direct_child_user_id) VALUES(?,?)',[parent.id,id])
    return publicUser(await one(conn,'SELECT * FROM users WHERE id=?',[id]))
  })
}
export async function login(db,username,password,admin=false){
  const table=admin?'admin_users':'users'
  const user=await one(db,`SELECT * FROM ${table} WHERE username=?`,[username])
  // An equivalent hash check prevents a missing username from bypassing hashing work.
  const valid=await bcrypt.compare(password,user?.password_hash||'$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy')
  if(!user||!valid||(admin&&!user.enabled))fail(401,'INVALID_CREDENTIALS','用户名或密码错误')
  return admin?{id:String(user.id),username:user.username}:publicUser(user)
}
export async function me(db,id){const u=await one(db,'SELECT * FROM users WHERE id=?',[id]);if(!u)fail(404,'NOT_FOUND','用户不存在');return publicUser(u)}
export async function getAddress(db,id){const a=await one(db,'SELECT recipient,phone,detail FROM user_addresses WHERE user_id=?',[id]);return a||null}
export async function saveAddress(db,id,address){
  await rows(db,'INSERT INTO user_addresses(user_id,recipient,phone,detail) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE recipient=VALUES(recipient),phone=VALUES(phone),detail=VALUES(detail)',[id,address.recipient,address.phone,address.detail]);return address
}
