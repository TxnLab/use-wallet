export function base64ToByteArray(blob: string): Uint8Array {
  return stringToByteArray(atob(blob))
}

export function byteArrayToBase64(array: Uint8Array): string {
  return btoa(byteArrayToString(array))
}

export function stringToByteArray(str: string): Uint8Array {
  const array = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) {
    array[i] = str.charCodeAt(i)
  }
  return array
}

export function byteArrayToString(array: Uint8Array): string {
  let result = ''
  for (let i = 0; i < array.length; i++) {
    result += String.fromCharCode(array[i])
  }
  return result
}
