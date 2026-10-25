import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) })
export const config={
  port:Number(process.env.PORT||3000), database:process.env.DB_NAME||'zsyy_dev',testDatabase:process.env.TEST_DB_NAME||'zsyy_test',
  host:process.env.DB_HOST||'127.0.0.1',dbPort:Number(process.env.DB_PORT||3308),user:process.env.DB_USER||'zsyy',password:process.env.DB_PASSWORD,
  userSecret:process.env.JWT_USER_SECRET,adminSecret:process.env.JWT_ADMIN_SECRET,production:process.env.NODE_ENV==='production'
}
export function validateConfig(){
  for(const value of [config.userSecret,config.adminSecret]) if(!value||value.length<32||value.startsWith('replace-')) throw new Error('Configure distinct random JWT secrets of at least 32 characters in .env')
  if(config.userSecret===config.adminSecret) throw new Error('User and administrator JWT secrets must be different')
  if(!config.password) throw new Error('DB_PASSWORD must be configured')
}
