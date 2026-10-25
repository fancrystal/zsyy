// randomUUID is unavailable on some HTTP/LAN origins. getRandomValues remains
// usable there and provides a random 128-bit key for local demo requests.
export function createRequestId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  if (typeof globalThis.crypto?.getRandomValues !== 'function') throw new Error('当前浏览器不支持生成请求编号，请使用新版浏览器')
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}
