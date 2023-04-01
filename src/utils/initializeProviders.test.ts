/**
 * @jest-environment jsdom
 */

import algosdk from 'algosdk'
import { initializeProviders } from './initializeProviders'
import allClients from '../clients'
import {
  DEFAULT_NETWORK,
  DEFAULT_NODE_BASEURL,
  DEFAULT_NODE_PORT,
  DEFAULT_NODE_TOKEN,
  PROVIDER_ID
} from '../constants'

describe('initializeProviders', () => {
  beforeEach(() => {
    // Mock the client.init method for all clients
    for (const client of Object.values(allClients)) {
      jest.spyOn(client, 'init').mockResolvedValue(null)
    }

    // Mock console.warn to avoid polluting the test output
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should return an empty object if window is undefined', async () => {
    const originalWindow = global.window

    Object.defineProperty(global, 'window', {
      get() {
        return undefined
      },
      configurable: true
    })

    const result = await initializeProviders()
    expect(result).toEqual({})

    Object.defineProperty(global, 'window', {
      value: originalWindow,
      configurable: true
    })
  })

  it('should initialize default wallets with default node configuration', async () => {
    const defaultProviders = [
      PROVIDER_ID.PERA,
      PROVIDER_ID.DEFLY,
      PROVIDER_ID.WALLETCONNECT,
      PROVIDER_ID.EXODUS,
      PROVIDER_ID.ALGOSIGNER,
      PROVIDER_ID.MYALGO
    ]

    const defaultNodeConfig = {
      network: DEFAULT_NETWORK,
      algodOptions: [DEFAULT_NODE_TOKEN, DEFAULT_NODE_BASEURL, DEFAULT_NODE_PORT],
      algosdkStatic: undefined
    }

    const result = await initializeProviders()
    const initializedIds = Object.keys(result)

    defaultProviders.forEach((id) => {
      expect(initializedIds).toContain(id)
      expect(allClients[id].init).toHaveBeenCalledWith(defaultNodeConfig)
    })

    expect(initializedIds).toMatchSnapshot()
    expect(initializedIds).toHaveLength(defaultProviders.length)
    expect(initializedIds).not.toContain(PROVIDER_ID.KMD)
    expect(initializedIds).not.toContain(PROVIDER_ID.MNEMONIC)
  })

  it('should initialize specified wallets only', async () => {
    const providers = [PROVIDER_ID.PERA, PROVIDER_ID.DEFLY]

    const result = await initializeProviders(providers)
    const initializedIds = Object.keys(result)

    expect(initializedIds).toMatchSnapshot()
    expect(initializedIds).toHaveLength(2)

    providers.forEach((id) => {
      expect(initializedIds).toContain(id)
      expect(allClients[id].init).toHaveBeenCalledWith({
        network: DEFAULT_NETWORK,
        algodOptions: [DEFAULT_NODE_TOKEN, DEFAULT_NODE_BASEURL, DEFAULT_NODE_PORT],
        algosdkStatic: undefined
      })
    })
  })

  it('should initialize using custom node configuration', async () => {
    const nodeConfig = {
      network: 'testnet',
      nodeServer: 'http://localhost',
      nodeToken: 'testToken',
      nodePort: '1234'
    }

    const providers = [PROVIDER_ID.WALLETCONNECT, PROVIDER_ID.ALGOSIGNER]

    const result = await initializeProviders(providers, nodeConfig)
    const initializedIds = Object.keys(result)

    providers.forEach((id) => {
      expect(initializedIds).toContain(id)
      expect(allClients[id].init).toHaveBeenCalledWith({
        network: nodeConfig.network,
        algodOptions: [nodeConfig.nodeToken, nodeConfig.nodeServer, nodeConfig.nodePort],
        algosdkStatic: undefined
      })
    })
  })

  it('should initialize using provided algosdk instance', async () => {
    const providers = [PROVIDER_ID.PERA, PROVIDER_ID.DEFLY]

    const result = await initializeProviders(providers, undefined, algosdk)
    const initializedIds = Object.keys(result)

    providers.forEach((id) => {
      expect(initializedIds).toContain(id)
      expect(allClients[id].init).toHaveBeenCalledWith({
        network: DEFAULT_NETWORK,
        algodOptions: [DEFAULT_NODE_TOKEN, DEFAULT_NODE_BASEURL, DEFAULT_NODE_PORT],
        algosdkStatic: algosdk
      })
    })
  })
})
