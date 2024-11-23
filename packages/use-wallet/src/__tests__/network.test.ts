import { NetworkConfigBuilder, isNetworkConfig, createNetworkConfig } from 'src/network'

describe('Network Configuration', () => {
  describe('createNetworkConfig', () => {
    it('returns default network configurations', () => {
      const networks = createNetworkConfig()

      expect(networks).toHaveProperty('mainnet')
      expect(networks).toHaveProperty('testnet')
      expect(networks).toHaveProperty('betanet')
      expect(networks).toHaveProperty('fnet')
      expect(networks).toHaveProperty('localnet')
    })

    it('includes correct default values for mainnet', () => {
      const networks = createNetworkConfig()

      expect(networks.mainnet).toEqual({
        name: 'MainNet',
        algod: {
          token: '',
          baseServer: 'https://mainnet-api.4160.nodely.dev',
          headers: {}
        },
        isTestnet: false,
        genesisHash: 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
        genesisId: 'mainnet-v1.0',
        caipChainId: 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k'
      })
    })
  })

  describe('NetworkConfigBuilder', () => {
    it('allows customizing default network algod config', () => {
      const networks = new NetworkConfigBuilder()
        .mainnet({
          token: 'custom-token',
          baseServer: 'custom-server',
          headers: { 'X-API-Key': 'key' }
        })
        .build()

      expect(networks.mainnet.algod).toEqual({
        token: 'custom-token',
        baseServer: 'custom-server',
        headers: { 'X-API-Key': 'key' }
      })
      // Other properties should remain unchanged
      expect(networks.mainnet.name).toBe('MainNet')
      expect(networks.mainnet.isTestnet).toBe(false)
    })

    it('allows adding custom networks', () => {
      const customNetwork = {
        name: 'Custom Network',
        algod: {
          token: 'token',
          baseServer: 'server',
          headers: {}
        },
        isTestnet: true
      }

      const networks = new NetworkConfigBuilder().addNetwork('custom', customNetwork).build()

      expect(networks.custom).toEqual(customNetwork)
      // Default networks should still be present
      expect(networks.mainnet).toBeDefined()
    })

    it('prevents overwriting default networks using addNetwork', () => {
      const builder = new NetworkConfigBuilder()

      expect(() =>
        builder.addNetwork('mainnet', {
          name: 'Custom MainNet',
          algod: {
            token: '',
            baseServer: ''
          }
        })
      ).toThrow('Cannot add network with reserved id "mainnet"')
    })

    it('maintains all default networks when customizing one', () => {
      const networks = new NetworkConfigBuilder()
        .mainnet({
          token: 'custom-token'
        })
        .build()

      expect(networks.testnet).toBeDefined()
      expect(networks.betanet).toBeDefined()
      expect(networks.fnet).toBeDefined()
      expect(networks.localnet).toBeDefined()
    })
  })

  describe('isNetworkConfig', () => {
    it('validates correct network configs', () => {
      const validConfig = {
        name: 'Test Network',
        algod: {
          token: 'token',
          baseServer: 'server'
        }
      }
      expect(isNetworkConfig(validConfig)).toBe(true)
    })

    it('validates network configs with optional properties', () => {
      const validConfig = {
        name: 'Test Network',
        algod: {
          token: 'token',
          baseServer: 'server'
        },
        isTestnet: true,
        genesisHash: 'hash',
        genesisId: 'id'
      }
      expect(isNetworkConfig(validConfig)).toBe(true)
    })

    it('rejects invalid network configs', () => {
      expect(isNetworkConfig(null)).toBe(false)
      expect(isNetworkConfig({})).toBe(false)
      expect(isNetworkConfig({ name: 'Test' })).toBe(false)
      expect(
        isNetworkConfig({
          name: 'Test',
          algod: { baseServer: 'server' }
        })
      ).toBe(false)
    })
  })
})
