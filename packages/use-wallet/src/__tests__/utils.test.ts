import algosdk from 'algosdk'
import {
  compareAccounts,
  deepMerge,
  formatJsonRpcRequest,
  isSignedTxnObject,
  isTransaction,
  mergeSignedTxnsWithGroup,
  normalizeTxnGroup,
  shouldSignTxnObject
} from 'src/utils'

describe('compareAccounts', () => {
  it('should return true if both account lists have the same wallet accounts', () => {
    const accounts1 = [
      { name: 'Acct 1', address: 'addr1' },
      { name: 'Acct 2', address: 'addr2' }
    ]
    const accounts2 = [
      { name: 'Acct 2', address: 'addr2' },
      { name: 'Acct 1', address: 'addr1' }
    ]

    expect(compareAccounts(accounts1, accounts2)).toBe(true)
  })

  it('should return false if account lists have different wallet accounts', () => {
    const accounts1 = [
      { name: 'Acct 1', address: 'addr1' },
      { name: 'Acct 2', address: 'addr2' }
    ]
    const accounts2 = [
      { name: 'Acct 3', address: 'addr3' },
      { name: 'Acct 1', address: 'addr1' }
    ]

    expect(compareAccounts(accounts1, accounts2)).toBe(false)
  })

  it('should return false if account lists have different sizes', () => {
    const accounts1 = [
      { name: 'Acct 1', address: 'addr1' },
      { name: 'Acct 2', address: 'addr2' }
    ]
    const accounts2 = [{ name: 'Acct 1', address: 'addr1' }]

    expect(compareAccounts(accounts1, accounts2)).toBe(false)
  })
})

describe('isTransaction', () => {
  const transaction = new algosdk.Transaction({
    from: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
    to: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
    fee: 10,
    amount: 847,
    firstRound: 51,
    lastRound: 61,
    genesisHash: 'JgsgCaCTqIaLeVhyL6XlRu3n7Rfk2FxMeK+wRSaQ7dI=',
    genesisID: 'testnet-v1.0'
  })

  const uInt8Array = transaction.toByte()

  it('should return true if the item is a single Transaction', () => {
    expect(isTransaction(transaction)).toBe(true)
  })

  it('should return true if the item is an array of transactions', () => {
    expect(isTransaction([transaction, transaction])).toBe(true)
  })

  it('should return false if the item is a single Uint8Array', () => {
    expect(isTransaction(uInt8Array)).toBe(false)
  })

  it('should return false if the item is an array of Uint8Arrays', () => {
    expect(isTransaction([uInt8Array, uInt8Array])).toBe(false)
  })
})

describe('isSignedTxnObject', () => {
  const transaction = new algosdk.Transaction({
    from: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
    to: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
    fee: 10,
    amount: 847,
    firstRound: 51,
    lastRound: 61,
    genesisHash: 'JgsgCaCTqIaLeVhyL6XlRu3n7Rfk2FxMeK+wRSaQ7dI=',
    genesisID: 'testnet-v1.0'
  })

  const encodedTxn = {
    amt: transaction.amount,
    fee: transaction.fee,
    fv: transaction.firstRound,
    lv: transaction.lastRound,
    snd: Buffer.from(transaction.from.publicKey),
    type: 'pay',
    gen: transaction.genesisID,
    gh: transaction.genesisHash,
    grp: Buffer.from(new Uint8Array(0))
  }

  const encodedSignedTxn = { txn: encodedTxn, sig: Buffer.from('sig') }

  it('should return true if the object is a signed transaction', () => {
    expect(isSignedTxnObject(encodedSignedTxn)).toBe(true)
  })

  it('should return false if the object is not a signed transaction', () => {
    expect(isSignedTxnObject(encodedTxn)).toBe(false)
  })
})

describe('normalizeTxnGroup', () => {
  it('should throw an error if the transaction group is empty', () => {
    expect(() => normalizeTxnGroup([])).toThrow('Empty transaction group!')
  })

  const transaction1 = new algosdk.Transaction({
    from: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
    to: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
    fee: 10,
    amount: 1000,
    firstRound: 51,
    lastRound: 61,
    genesisHash: 'JgsgCaCTqIaLeVhyL6XlRu3n7Rfk2FxMeK+wRSaQ7dI=',
    genesisID: 'testnet-v1.0'
  })
  const transaction2 = new algosdk.Transaction({
    from: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
    to: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
    fee: 10,
    amount: 2000,
    firstRound: 51,
    lastRound: 61,
    genesisHash: 'JgsgCaCTqIaLeVhyL6XlRu3n7Rfk2FxMeK+wRSaQ7dI=',
    genesisID: 'testnet-v1.0'
  })

  describe('with algosdk.Transaction[]', () => {
    it('should return an array of Uint8Arrays for a single array of transactions', () => {
      const txnGroup = [transaction1, transaction2]

      const normalized = normalizeTxnGroup(txnGroup)
      expect(normalized).toBeInstanceOf(Array)
      expect(normalized.every((item) => item instanceof Uint8Array)).toBe(true)
    })
  })

  describe('with algosdk.Transaction[][]', () => {
    it('should return a flat array of Uint8Arrays for a nested array of transactions', () => {
      const txnGroup = [[transaction1], [transaction2]]

      const normalized = normalizeTxnGroup(txnGroup)
      expect(normalized).toBeInstanceOf(Array)
      expect(normalized.length).toBe(2)
      expect(normalized.every((item) => item instanceof Uint8Array)).toBe(true)
    })
  })

  const uInt8Array1 = transaction1.toByte()
  const uInt8Array2 = transaction2.toByte()

  describe('with Uint8Array[]', () => {
    it('should return the same array of Uint8Arrays if input is a single array of Uint8Arrays', () => {
      const txnGroup = [uInt8Array1, uInt8Array2]

      const normalized = normalizeTxnGroup(txnGroup)
      expect(normalized).toEqual(txnGroup)
    })
  })

  describe('with Uint8Array[][]', () => {
    it('should return a flat array of Uint8Arrays for a nested array of Uint8Arrays', () => {
      const txnGroup = [[uInt8Array1], [uInt8Array2]]

      const normalized = normalizeTxnGroup(txnGroup)
      expect(normalized).toBeInstanceOf(Array)
      expect(normalized.length).toBe(2)
      expect(normalized.every((item) => item instanceof Uint8Array)).toBe(true)
    })
  })
})

describe('shouldSignTxnObject', () => {
  const transaction = new algosdk.Transaction({
    from: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
    to: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
    fee: 10,
    amount: 847,
    firstRound: 51,
    lastRound: 61,
    genesisHash: 'JgsgCaCTqIaLeVhyL6XlRu3n7Rfk2FxMeK+wRSaQ7dI=',
    genesisID: 'testnet-v1.0'
  })

  const encodedTxn = {
    amt: transaction.amount,
    fee: transaction.fee,
    fv: transaction.firstRound,
    lv: transaction.lastRound,
    snd: Buffer.from(transaction.from.publicKey),
    type: 'pay',
    gen: transaction.genesisID,
    gh: transaction.genesisHash,
    grp: Buffer.from(new Uint8Array(0))
  }

  const addresses = ['7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q']

  it('should return true if the transaction object is not signed and indexesToSign is undefined', () => {
    const indexesToSign = undefined
    const idx = 0

    expect(shouldSignTxnObject(encodedTxn, addresses, indexesToSign, idx)).toBe(true)
  })

  it('should return true if the transaction object is not signed and indexesToSign includes the index', () => {
    const indexesToSign = [0]
    const idx = 0

    expect(shouldSignTxnObject(encodedTxn, addresses, indexesToSign, idx)).toBe(true)
  })

  it('should return false if the transaction object is not signed and indexesToSign does not include the index', () => {
    const indexesToSign = [1]
    const idx = 0

    expect(shouldSignTxnObject(encodedTxn, addresses, indexesToSign, idx)).toBe(false)
  })

  it('should return false if the transaction object is signed', () => {
    const indexesToSign = undefined
    const idx = 0
    const encodedSignedTxn = { txn: encodedTxn, sig: Buffer.from('sig') }

    expect(shouldSignTxnObject(encodedSignedTxn, addresses, indexesToSign, idx)).toBe(false)
  })

  it('should return false if addresses do not include the sender address', () => {
    const indexesToSign = undefined
    const idx = 0
    const addresses = ['addr1', 'addr2']

    expect(shouldSignTxnObject(encodedTxn, addresses, indexesToSign, idx)).toBe(false)
  })
})

describe('mergeSignedTxnsWithGroup', () => {
  const transaction1 = new algosdk.Transaction({
    from: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
    to: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
    fee: 10,
    amount: 1000,
    firstRound: 51,
    lastRound: 61,
    genesisHash: 'JgsgCaCTqIaLeVhyL6XlRu3n7Rfk2FxMeK+wRSaQ7dI=',
    genesisID: 'testnet-v1.0'
  })
  const transaction2 = new algosdk.Transaction({
    from: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
    to: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
    fee: 10,
    amount: 2000,
    firstRound: 51,
    lastRound: 61,
    genesisHash: 'JgsgCaCTqIaLeVhyL6XlRu3n7Rfk2FxMeK+wRSaQ7dI=',
    genesisID: 'testnet-v1.0'
  })

  const uInt8Array1 = transaction1.toByte()
  const uInt8Array2 = transaction2.toByte()

  it('should merge all signed transactions into the group when all are signed', () => {
    const signedTxn1 = new Uint8Array(Buffer.from('signedTxn1Str', 'base64'))
    const signedTxn2 = new Uint8Array(Buffer.from('signedTxn2Str', 'base64'))
    const txnGroup = [uInt8Array1, uInt8Array2]
    const signedIndexes = [0, 1]
    const returnGroup = true

    const merged = mergeSignedTxnsWithGroup(
      [signedTxn1, signedTxn2],
      txnGroup,
      signedIndexes,
      returnGroup
    )
    expect(merged).toEqual([signedTxn1, signedTxn2])
  })

  it('should merge all signed transactions into the group when only some are signed', () => {
    const signedTxn1 = new Uint8Array(Buffer.from('signedTxn1Str', 'base64'))
    const txnGroup = [uInt8Array1, uInt8Array2]
    const signedIndexes = [0]
    const returnGroup = true

    const merged = mergeSignedTxnsWithGroup([signedTxn1], txnGroup, signedIndexes, returnGroup)
    expect(merged).toEqual([signedTxn1, uInt8Array2])
  })

  it('should merge all signed transactions into the group when none are signed', () => {
    const txnGroup = [uInt8Array1, uInt8Array2]
    const returnGroup = true

    const merged = mergeSignedTxnsWithGroup([], txnGroup, [], returnGroup)
    expect(merged).toEqual(txnGroup)
  })

  it('should only return signed transactions if returnGroup is false', () => {
    const signedTxn1 = new Uint8Array(Buffer.from('signedTxn1Str', 'base64'))
    const signedTxn2 = new Uint8Array(Buffer.from('signedTxn2Str', 'base64'))
    const txnGroup = [uInt8Array1, uInt8Array2]
    const returnGroup = false

    const signedIndexes1 = [0, 1]

    const merged1 = mergeSignedTxnsWithGroup(
      [signedTxn1, signedTxn2],
      txnGroup,
      signedIndexes1,
      returnGroup
    )
    expect(merged1).toEqual([signedTxn1, signedTxn2])

    const signedIndexes2 = [0]

    const merged2 = mergeSignedTxnsWithGroup([signedTxn1], txnGroup, signedIndexes2, returnGroup)
    expect(merged2).toEqual([signedTxn1])
  })
})

describe('deepMerge', () => {
  it('should deeply merge two objects', () => {
    const target = { a: 1, b: { c: 2 } }
    const source = { b: { d: 3 }, e: 4 }
    const expected = { a: 1, b: { c: 2, d: 3 }, e: 4 }

    expect(deepMerge(target, source)).toEqual(expected)
  })

  it('should throw an error if either argument is not an object', () => {
    expect(() => deepMerge(null, {})).toThrow('Target and source must be objects')
    expect(() => deepMerge({}, null)).toThrow('Target and source must be objects')
  })
})

describe('formatJsonRpcRequest', () => {
  it('should format a JSON-RPC request with the given method and params', () => {
    const method = 'algo_signTxn'
    const params = [{ txn: 'base64Txn' }]
    const request = formatJsonRpcRequest(method, params)

    expect(request).toHaveProperty('id')
    expect(request).toHaveProperty('jsonrpc', '2.0')
    expect(request).toHaveProperty('method', method)
    expect(request).toHaveProperty('params', params)
  })
})
