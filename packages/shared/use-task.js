import { ref } from 'vue'
export function useTask(){const busy=ref(false),error=ref(''),notice=ref('')
  async function run(action,success=''){if(busy.value)return false;busy.value=true;error.value='';notice.value='';try{await action();notice.value=success;return true}catch(e){error.value=e.message;return false}finally{busy.value=false}}
  return {busy,error,notice,run}
}
