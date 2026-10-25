import { createDatabase } from '../packages/backend/src/db/database.js'
import { config, validateConfig } from '../packages/backend/src/config.js'
import { seedApprovedTestTeam } from '../packages/backend/src/services/test-team.js'

validateConfig()
const db=createDatabase(config.database)
try{
  const users=await seedApprovedTestTeam(db)
  console.log(JSON.stringify(users.map(({username,nickname,parentId})=>({phone:username,nickname,parentId}))))
}finally{await db.end()}
