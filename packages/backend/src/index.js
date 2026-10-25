import { createApp } from './app.js'
import { createDatabase } from './db/database.js'
import { config, validateConfig } from './config.js'
import { initialize } from './initialize.js'
import { startScheduler } from './services/reconcile.js'
validateConfig()
const db=createDatabase()
await initialize(db)
const stopScheduler=startScheduler(db)
const server=createApp(db).listen(config.port,'127.0.0.1',()=>console.log(`API ready at http://127.0.0.1:${config.port}/api/health`))
function shutdown(){stopScheduler();server.close(async()=>{await db.end();process.exit(0)})}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown)
