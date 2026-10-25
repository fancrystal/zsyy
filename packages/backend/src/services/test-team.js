import { one } from '../db/database.js'
import { fail } from '../errors.js'
import { publicUser, register } from './accounts.js'

export const approvedTestTeam=Object.freeze([
  {phone:'18800000001',nickname:'星河',parentPhone:null},
  {phone:'18800000002',nickname:'晨曦',parentPhone:'18800000001'},
  {phone:'18800000003',nickname:'远山',parentPhone:'18800000001'},
  {phone:'18800000004',nickname:'清风',parentPhone:'18800000002'},
  {phone:'18800000005',nickname:'沐阳',parentPhone:'18800000002'},
  {phone:'18800000006',nickname:'知夏',parentPhone:'18800000003'}
])

export async function seedApprovedTestTeam(db,{password='123456',rootUsername=process.env.INIT_ROOT_USERNAME||'root'}={}){
  const root=await one(db,'SELECT * FROM users WHERE username=?',[rootUsername])
  if(!root)fail(409,'ROOT_USER_MISSING','未找到测试团队的初始邀请用户')
  const membersByPhone=new Map()
  const result=[]
  for(const member of approvedTestTeam){
    const parent=member.parentPhone?membersByPhone.get(member.parentPhone):root
    if(!parent)throw new Error(`Parent ${member.parentPhone} must be created first`)
    const existing=await one(db,'SELECT * FROM users WHERE username=?',[member.phone])
    if(existing){
      if(existing.nickname!==member.nickname||String(existing.parent_id)!==String(parent.id))fail(409,'TEST_TEAM_CONFLICT',`测试用户 ${member.phone} 已存在但资料或上级不匹配`)
      membersByPhone.set(member.phone,existing);result.push(publicUser(existing));continue
    }
    const created=await register(db,{username:member.phone,password,nickname:member.nickname,inviteCode:parent.invite_code})
    const row=await one(db,'SELECT * FROM users WHERE id=?',[created.id])
    membersByPhone.set(member.phone,row);result.push(created)
  }
  return result
}
