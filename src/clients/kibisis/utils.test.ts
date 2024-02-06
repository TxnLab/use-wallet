import { generateUuid } from './utils'
import { getRandomValues, randomUUID } from 'crypto'

describe(`${__dirname}/utils`, () => {
  const validUuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

  beforeAll(() => {
    Object.defineProperty(window, 'crypto', {
      configurable: true,
      value: {
        getRandomValues,
        randomUUID
      }
    })
  })

  describe('generateUuid()', () => {
    it('should generate a valid uuid using the web crypto api', () => {
      const result = generateUuid()

      expect(validUuidRegex.test(result)).toBe(true)
    })

    it('should generate a valid uuid without the web crypto api', () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      delete window.crypto.randomUUID

      const result = generateUuid()

      expect(validUuidRegex.test(result)).toBe(true)

      window.crypto.randomUUID = randomUUID
    })
  })
})
