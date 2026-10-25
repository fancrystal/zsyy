import { test, expect, vi, afterEach } from 'vitest'
import { api } from '../packages/shared/api.js'
afterEach(()=>vi.unstubAllGlobals())
test('API client unwraps a JSON response without substituting demo state',async()=>{
  vi.stubGlobal('fetch',async()=>new Response(JSON.stringify({data:{balanceUnits:12345}}),{status:200,headers:{'Content-Type':'application/json'}}))
  expect(await api('/me/wallet')).toEqual({balanceUnits:12345})
})
test('API client preserves business error status and message',async()=>{
  vi.stubGlobal('fetch',async()=>new Response(JSON.stringify({error:{code:'INSUFFICIENT_BALANCE',message:'产品券余额不足'}}),{status:409}))
  await expect(api('/orders',{method:'POST',body:{}})).rejects.toMatchObject({status:409,code:'INSUFFICIENT_BALANCE',message:'产品券余额不足'})
})
test('HTML fallback is rejected instead of being treated as a working API',async()=>{
  vi.stubGlobal('fetch',async()=>new Response('<html>frontend</html>',{status:200,headers:{'Content-Type':'text/html'}}))
  await expect(api('/health')).rejects.toThrow('接口响应格式错误')
})
