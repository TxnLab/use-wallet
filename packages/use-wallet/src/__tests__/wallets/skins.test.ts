import { BUILTIN_SKINS, registerSkin, getSkin, resolveSkin } from 'src/wallets/skins'
import type { WalletConnectSkin } from 'src/wallets/types'

describe('WalletConnect Skins', () => {
  describe('BUILTIN_SKINS', () => {
    it('should include the biatec skin', () => {
      expect(BUILTIN_SKINS.biatec).toBeDefined()
      expect(BUILTIN_SKINS.biatec.id).toBe('biatec')
      expect(BUILTIN_SKINS.biatec.name).toBe('Biatec Wallet')
      expect(BUILTIN_SKINS.biatec.icon).toContain('data:image/svg+xml;base64,')
    })

    it('should include the voiwallet skin', () => {
      expect(BUILTIN_SKINS.voiwallet).toBeDefined()
      expect(BUILTIN_SKINS.voiwallet.id).toBe('voiwallet')
      expect(BUILTIN_SKINS.voiwallet.name).toBe('Voi Wallet')
      expect(BUILTIN_SKINS.voiwallet.icon).toContain('data:image/svg+xml;base64,')
    })
  })

  describe('getSkin', () => {
    it('should return a built-in skin by ID', () => {
      const skin = getSkin('biatec')
      expect(skin).toBeDefined()
      expect(skin?.id).toBe('biatec')
      expect(skin?.name).toBe('Biatec Wallet')
    })

    it('should return the voiwallet skin by ID', () => {
      const skin = getSkin('voiwallet')
      expect(skin).toBeDefined()
      expect(skin?.id).toBe('voiwallet')
      expect(skin?.name).toBe('Voi Wallet')
    })

    it('should return undefined for non-existent skin', () => {
      const skin = getSkin('nonexistent')
      expect(skin).toBeUndefined()
    })
  })

  describe('registerSkin', () => {
    it('should register a custom skin', () => {
      const customSkin: WalletConnectSkin = {
        id: 'test-custom-skin',
        name: 'Test Custom Wallet',
        icon: 'data:image/svg+xml;base64,test'
      }

      registerSkin(customSkin)

      const retrieved = getSkin('test-custom-skin')
      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe('test-custom-skin')
      expect(retrieved?.name).toBe('Test Custom Wallet')
    })

    it('should throw when trying to override a built-in skin', () => {
      const overrideSkin: WalletConnectSkin = {
        id: 'biatec',
        name: 'Fake Biatec',
        icon: 'fake-icon'
      }

      expect(() => registerSkin(overrideSkin)).toThrow('Cannot override built-in skin: biatec')
    })

    it('should throw when trying to override the voiwallet built-in skin', () => {
      const overrideSkin: WalletConnectSkin = {
        id: 'voiwallet',
        name: 'Fake Voi Wallet',
        icon: 'fake-icon'
      }

      expect(() => registerSkin(overrideSkin)).toThrow('Cannot override built-in skin: voiwallet')
    })
  })

  describe('resolveSkin', () => {
    it('should resolve a string ID to a built-in skin', () => {
      const skin = resolveSkin('biatec')
      expect(skin).toBeDefined()
      expect(skin?.id).toBe('biatec')
      expect(skin?.name).toBe('Biatec Wallet')
    })

    it('should resolve the voiwallet string ID to a built-in skin', () => {
      const skin = resolveSkin('voiwallet')
      expect(skin).toBeDefined()
      expect(skin?.id).toBe('voiwallet')
      expect(skin?.name).toBe('Voi Wallet')
    })

    it('should return undefined for non-existent string ID', () => {
      const skin = resolveSkin('nonexistent-id')
      expect(skin).toBeUndefined()
    })

    it('should accept and register a full skin object', () => {
      const customSkin: WalletConnectSkin = {
        id: 'inline-custom-skin',
        name: 'Inline Custom Wallet',
        icon: 'data:image/svg+xml;base64,inline'
      }

      const resolved = resolveSkin(customSkin)
      expect(resolved).toBeDefined()
      expect(resolved?.id).toBe('inline-custom-skin')
      expect(resolved?.name).toBe('Inline Custom Wallet')

      // Should also be retrievable via getSkin
      const retrieved = getSkin('inline-custom-skin')
      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe('inline-custom-skin')
    })

    it('should return built-in skin when full object has same ID', () => {
      const skin: WalletConnectSkin = {
        id: 'biatec',
        name: 'Different Name',
        icon: 'different-icon'
      }

      // Should return the original skin object passed in
      const resolved = resolveSkin(skin)
      expect(resolved).toEqual(skin)

      // But getSkin should still return the built-in skin
      const builtIn = getSkin('biatec')
      expect(builtIn?.name).toBe('Biatec Wallet')
    })
  })
})
