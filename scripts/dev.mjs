import { spawn } from 'node:child_process'
const modes = { mobile: ['mobile-h5', '3011'], admin: ['admin', '3013'],backend:['backend','3000'] }
const selected = process.argv[2] ? [process.argv[2]] : ['backend','mobile', 'admin']
if (selected.some(name => !modes[name])) throw new Error('Usage: node scripts/dev.mjs [mobile|admin|backend]')
const children = selected.map(name => {
  const [pkg, port] = modes[name]
  if(name==='backend')return spawn(process.execPath,['--watch','packages/backend/src/index.js'],{stdio:'inherit'})
  return spawn(process.execPath, [`packages/${pkg}/node_modules/vite/bin/vite.js`, `packages/${pkg}`, '--config', `packages/${pkg}/vite.config.js`, '--host', '0.0.0.0', '--port', port, '--strictPort'], { stdio: 'inherit' })
})
let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill()
  process.exitCode = code
}
for (const child of children) {
  child.on('error', error => { console.error(error.message); stop(1) })
  child.on('exit', code => { if (!stopping) stop(code || 0) })
}
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
