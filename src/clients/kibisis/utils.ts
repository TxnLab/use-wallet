/**
 * Generates a UUID version 4 string. This function attempts to use the `crypto.randomUUID()` function from the Web
 * Crypto API if it is available, otherwise it uses a polyfill method.
 *
 * NOTE: `crypto.randomUUID()` is not available in non-secure contexts; only localhost and HTTPS.
 * @returns {string} a valid UUID version 4 string.
 * @see {@link https://stackoverflow.com/a/2117523}
 */
export function generateUuid(): string {
  if (window.crypto.randomUUID) {
    return window.crypto.randomUUID()
  }

  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (value) => {
    const valueAsNumber: number = parseInt(value)

    return (
      valueAsNumber ^
      (window.crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (valueAsNumber / 4)))
    ).toString(16)
  })
}
