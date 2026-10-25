import fs from 'node:fs'
import path from 'node:path'
import {randomBytes} from 'node:crypto'
import {spawnSync} from 'node:child_process'
fs.mkdirSync('.cache',{recursive:true})
if(!fs.existsSync('.env')){
  const secret=()=>randomBytes(24).toString('hex'),db=secret(),root=secret(),admin=secret().slice(0,20),user=secret().slice(0,20)
  fs.writeFileSync('.cache/mysql.env',`MYSQL_ROOT_PASSWORD=${root}\nMYSQL_DATABASE=zsyy_dev\nMYSQL_USER=zsyy\nMYSQL_PASSWORD=${db}\n`)
  fs.writeFileSync('.env',`NODE_ENV=development\nPORT=3000\nDB_HOST=127.0.0.1\nDB_PORT=3308\nDB_NAME=zsyy_dev\nTEST_DB_NAME=zsyy_test\nDB_USER=zsyy\nDB_PASSWORD=${db}\nJWT_USER_SECRET=${secret()}\nJWT_ADMIN_SECRET=${secret()}\nINIT_ADMIN_USERNAME=admin\nINIT_ADMIN_PASSWORD=${admin}\nINIT_ROOT_USERNAME=root\nINIT_ROOT_PASSWORD=${user}\n`)
  fs.writeFileSync('.cache/development-accounts.md',`# Local development accounts\n\nAdmin username: admin\nAdmin password: ${admin}\n\nRoot user: root\nRoot password: ${user}\n\nLocal initialization accounts only. Do not copy them to production.\n`)
  console.log('Created .env and ignored .cache/development-accounts.md; credentials were not printed.')
}else console.log('Kept existing .env and account credentials.')
if(!process.argv.includes('--prepare-only')){
  function docker(args,input){const result=spawnSync('docker',args,{input,encoding:'utf8'});if(result.error)throw result.error;if(result.status!==0)throw new Error(result.stderr||'Docker operation failed');return result.stdout.trim()}
  const names=docker(['ps','-a','--format','{{.Names}}']).split('\n')
  if(names.includes('zsyy-mysql'))docker(['start','zsyy-mysql'])
  else{
    if(!fs.existsSync('.cache/mysql.env'))throw new Error('Existing .env has no local Docker configuration. Use its configured MySQL service or create a separate local config.')
    fs.mkdirSync('.cache/mysql-data',{recursive:true})
    docker(['run','--name','zsyy-mysql','--env-file','.cache/mysql.env','-p','127.0.0.1:3308:3306','--mount',`type=bind,source=${path.resolve('.cache/mysql-data')},target=/var/lib/mysql`,'--restart','unless-stopped','-d','mysql:8.4'])
  }
  let ready=false
  for(let i=0;i<45;i++){
    const result=spawnSync('docker',['exec','-i','zsyy-mysql','sh','-c','export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysql -uroot'],{input:"CREATE DATABASE IF NOT EXISTS zsyy_test CHARACTER SET utf8mb4; GRANT ALL PRIVILEGES ON zsyy_test.* TO 'zsyy'@'%';",encoding:'utf8'})
    if(result.status===0){ready=true;break}await new Promise(resolve=>setTimeout(resolve,1000))
  }
  if(!ready)throw new Error('MySQL did not become ready. Inspect the zsyy-mysql container logs.')
  console.log('Local MySQL ready on 127.0.0.1:3308; independent development and test databases available.')
}
