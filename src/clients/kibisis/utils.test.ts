import { generateUuid } from './utils'

describe(`${__dirname}/utils`, () => {
  const validUuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

  describe('generateUuid()', () => {
    it('should generate a valid uuid using the web crypto api', () => {
      const result = generateUuid()

      expect(validUuidRegex.test(result)).toBe(true)
    })

    it('should generate a valid uuid without the web crypto api', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const cryptoRandomUUID = global.crypto.randomUUID

      Object.defineProperty(global.crypto, 'randomUUID', {
        configurable: true,
        value: undefined
      })

      const result = generateUuid()

      expect(validUuidRegex.test(result)).toBe(true)

      Object.defineProperty(global.crypto, 'randomUUID', {
        value: cryptoRandomUUID
      })
    })
  })
})
