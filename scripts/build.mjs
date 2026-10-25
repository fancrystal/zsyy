import { spawnSync } from 'node:child_process'
for (const name of ['mobile-h5', 'admin']) {
  const result = spawnSync(process.execPath, [`packages/${name}/node_modules/vite/bin/vite.js`, 'build', `packages/${name}`, '--config', `packages/${name}/vite.config.js`], { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status || 1)
}
