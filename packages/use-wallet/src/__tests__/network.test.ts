import { isAlgodConfig, isNetworkConfigMap, isValidNetworkId, NetworkId } from 'src/network'

describe('Network Type Guards', () => {
  describe('isValidNetworkId', () => {
    it('returns true for a valid NetworkId', () => {
      expect(isValidNetworkId(NetworkId.TESTNET)).toBe(true)
    })

    it('returns false for an invalid NetworkId', () => {
      expect(isValidNetworkId('foo')).toBe(false)
    })
  })

  describe('isAlgodConfig', () => {
    it('returns true for a valid AlgodConfig', () => {
      expect(
        isAlgodConfig({
          token: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          baseServer: 'http://localhost',
          port: 1234,
          headers: {
            'X-Foo': 'bar'
          }
        })
      ).toBe(true)

      expect(
        isAlgodConfig({
          token: '',
          baseServer: ''
        })
      ).toBe(true)
    })

    it('returns false for an invalid AlgodConfig', () => {
      expect(
        isAlgodConfig({
          baseServer: ''
        })
      ).toBe(false)

      expect(
        isAlgodConfig({
          token: ''
        })
      ).toBe(false)

      expect(
        isAlgodConfig({
          token: '',
          baseServer: '',
          foo: ''
        })
      ).toBe(false)
    })
  })

  describe('isNetworkConfigMap', () => {
    it('returns true for a valid NetworkConfigMap', () => {
      const validConfigMap = {
        [NetworkId.MAINNET]: {
          token: '',
          baseServer: ''
        },
        [NetworkId.TESTNET]: {
          token: '',
          baseServer: ''
        }
      }
      expect(isNetworkConfigMap(validConfigMap)).toBe(true)
    })

    it('returns false for an invalid NetworkConfigMap', () => {
      expect(
        isNetworkConfigMap({
          token: '',
          baseServer: ''
        })
      ).toBe(false)
    })
  })
})
