export function getRandomB16(len) {
  const array = new Uint8Array(len)
  window.crypto.getRandomValues(array)
  const hex = Object.values(array).map(n => n.toString(16)).join('')
  return hex
}
