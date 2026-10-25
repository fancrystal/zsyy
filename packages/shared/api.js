export async function api(path,{method='GET',body,key,signal}={}){
  let response
  try{response=await fetch(`/api${path}`,{method,credentials:'same-origin',headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(key?{'Idempotency-Key':key}:{})},body:body===undefined?undefined:JSON.stringify(body),signal})}
  catch(error){if(error.name==='AbortError')throw error;throw Object.assign(new Error('无法连接服务，请检查后端是否启动'),{status:0,code:'NETWORK_ERROR'})}
  let payload
  try{payload=await response.json()}catch{throw Object.assign(new Error('接口响应格式错误，请检查 API 服务和代理配置'),{status:response.status,code:'INVALID_RESPONSE'})}
  if(!response.ok)throw Object.assign(new Error(payload.error?.message||'请求失败'),{status:response.status,code:payload.error?.code})
  if(!Object.hasOwn(payload,'data'))throw new Error('接口响应格式错误')
  return payload.data
}
export function queryString(values){const p=new URLSearchParams();for(const [key,value] of Object.entries(values))if(value!==''&&value!==null&&value!==undefined)p.set(key,String(value));return p.size?`?${p}`:''}
