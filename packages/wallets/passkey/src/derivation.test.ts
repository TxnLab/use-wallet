import algosdk from 'algosdk'
import { generateKey } from 'falcon-1024'
import { sha512_256 } from '@noble/hashes/sha2'
import { PRF_LABEL_PREFIX, assertValidContext, keygenSeedFromEntropy, prfInput } from './derivation'

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex')
const unhex = (value: string) => new Uint8Array(Buffer.from(value, 'hex'))

function accountFromEntropy(entropy: Uint8Array) {
  const keygenSeed = keygenSeedFromEntropy(entropy)
  const { publicKey } = generateKey(keygenSeed)
  const { address, salt } = algosdk.addressFromPQKey(algosdk.FALCON_1024_SCHEME, publicKey)
  return { keygenSeed, publicKey, address: address.toString(), salt }
}

describe('prfInput', () => {
  // These bytes are the PRF input, so they fix every account. Never change them.
  it('pins the PRF label', () => {
    expect(PRF_LABEL_PREFIX).toBe('@txnlab/use-wallet-passkey:falcon-1024:v1:')
    expect(hex(prfInput(''))).toBe(
      '4074786e6c61622f7573652d77616c6c65742d706173736b65793a66616c636f6e2d313032343a76313a'
    )
    expect(hex(prfInput('my-app'))).toBe(
      '4074786e6c61622f7573652d77616c6c65742d706173736b65793a66616c636f6e2d313032343a76313a6d792d617070'
    )
  })

  it('rejects a context that could collide with a future slot suffix', () => {
    expect(() => prfInput('app:1')).toThrow('must not contain ":"')
    expect(() => assertValidContext('x'.repeat(129))).toThrow()
    expect(() => assertValidContext('x'.repeat(128))).not.toThrow()
  })
})

describe('keygenSeedFromEntropy', () => {
  // ARC-76 PR #497 known answers, from the .NET reference implementation
  const vectors = [
    {
      seed: 'e1078b9af5d2b58abc819135f6b8f358a3a36dd04d4707eb51f481d766a86915',
      keygenSeed: '66ee8e7f4804cc6209c3d2dbe31e10a7076b45b1dcb7e6f9253f29c6c911114d',
      pkHash: '37fd32ff4e6bcc5ea86e5b5137264e6192535e36274953a36e7b28668d006e7e',
      salt: 1,
      addr: 'TD5NFW5MEPGAT4S2AIN6XK5DIPJQMCOVN3272HJUJPPG3TB52MNFESSRXA'
    },
    {
      seed: '9365ff3d966fdb3b8765e27007677440e67382ed4503c2d00a39638548e13c22',
      keygenSeed: '1bc3d03d58484873ed1fde2f985a51b0c593c22e8e300719004a4b88e475ed0a',
      pkHash: '19511ad0f750d0ffd213dc44b03732737b47c2be9d7ea36490d4a4d5ba77bcdd',
      salt: 0,
      addr: 'BGIJDJONAAYPYPJSZX6EWMH24VMU7CDAOUNCPCIXQ4KYYJG3QMXWNVWOWE'
    },
    {
      seed: '4b698752e1f979bd51179faec7e59dcf7552d2724dd5a0b7a024d0ca536e4130',
      keygenSeed: 'de2be2ebdf18ac835050868c8c0fac72a4e9b152fa64a23370511724090dd5b0',
      pkHash: '36c945a38f3823cb9c7711c4a60e6412a1ef353f92630da6a62a25bd3990e542',
      salt: 2,
      addr: 'CV2LVHMWDQ625SKQOWQHYZN453MZ22R3V2DO5HFU6UDUZVDKGZJES4HFC4'
    },
    {
      seed: 'e03beaeeeb358cce26c35444a3ec5e2909d74fc312a59c8993d7097f7f98adc9',
      salt: 4,
      addr: 'SQUKPUF5WNY2Y5VWPKEDVM2KGH2LPML6PIQMOFIRBTMHJTEC4BXLEPM4XI'
    },
    {
      seed: '99b4db1655507f35e5f45317af539924af0b1099f55fb3232292696e33047db0',
      salt: 1,
      addr: 'LWTOIX3ZCF4UDNFTS4A5S7436MT3QTFIFVSLQGVLODOYTVT6BVUUKGI2NU'
    },
    {
      seed: '2b79f9e6c435957e33b6fa9e23f2f836f0e392743050fbf25a228b7204a65ede',
      salt: 6,
      addr: 'U6MYURHZFMNYLTUTOLBAHD7LNMT4WQ572GUHZOW7RJFGD6CYVDJNHDY2AU'
    },
    {
      seed: 'bdc7d67a26783c377746ac55c7a63f5770abc270a102cbc7dac0c07e448f1be2',
      salt: 2,
      addr: 'QR3WQTKMSN6IW7SIM3OD3WXA4G57AG3YOBKTKH4R2UAU32KABR2ZA4LMD4'
    }
  ]

  it.each(vectors)('derives $addr (salt $salt)', (vector) => {
    const account = accountFromEntropy(unhex(vector.seed))
    expect(account.address).toBe(vector.addr)
    expect(account.salt).toBe(vector.salt)
    if (vector.keygenSeed) expect(hex(account.keygenSeed)).toBe(vector.keygenSeed)
    if (vector.pkHash) expect(hex(sha512_256(account.publicKey))).toBe(vector.pkHash)
  })

  it("matches algosdk's pq25WordMnemonicToSeed, so the export phrase restores the account", () => {
    for (const { seed } of vectors) {
      const entropy = unhex(seed)
      const phrase = algosdk.mnemonicFromSeed(entropy)
      expect(hex(algosdk.pq25WordMnemonicToSeed(phrase, algosdk.FALCON_1024_SCHEME))).toBe(
        hex(keygenSeedFromEntropy(entropy))
      )
    }
  })

  it('derives the PRF_VECTOR account', () => {
    // hayai-client's PRF_VECTOR, taken as the PRF output
    const account = accountFromEntropy(
      unhex('0123456789abcdef1032547698badcfedeadbeefcafebabefeedface00112233')
    )
    expect(account.address).toBe('EIPP4HVON56N55A54OTPEXDTGXYKEMPH5UVTNKJZZNLQ6DAZW5DO2YN54A')
    expect(account.salt).toBe(0)
  })

  it('rejects entropy that is not 32 bytes', () => {
    expect(() => keygenSeedFromEntropy(new Uint8Array(31))).toThrow('32 bytes')
    expect(() => keygenSeedFromEntropy(new Uint8Array(33))).toThrow('32 bytes')
  })
})
