import {spawnSync} from 'node:child_process'
const commands=[['--test','packages/shared/demo.test.mjs'],['node_modules/vitest/vitest.mjs','run','--config','vitest.config.mjs'],['--test','--test-concurrency=1','packages/backend/tests/api.test.mjs']]
for(const args of commands){const result=spawnSync(process.execPath,args,{stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1)}
