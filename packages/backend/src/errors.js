export class BusinessError extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code}}
export const fail=(status,code,message)=>{throw new BusinessError(status,code,message)}
export function safeNumber(value){const n=Number(value);if(!Number.isSafeInteger(n))fail(409,'AMOUNT_LIMIT','金额超出可用范围');return n}
export const parseJson=value=>typeof value==='string'?JSON.parse(value):value
