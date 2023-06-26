/**
 * @jest-environment jsdom
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { createMockClient } from '../testUtils/mockClients'
import BaseClient from '../clients/base/base'
import { ClientOptions } from '../types'

describe('initializeProviders', () => {
  beforeEach(() => {
    // Mock the client.init method for all clients
    for (const [id, client] of Object.entries(allClients)) {
      jest.spyOn(client, 'init').mockImplementation(async (params: any) => {
        const providerId = id as PROVIDER_ID
        const clientOptions = params.clientOptions as ClientOptions
        const mockClient = createMockClient(providerId, clientOptions)

        if (mockClient) {
          // Preserve the custom clientOptions from params
          const clientOptions = params.clientOptions
          mockClient.clientOptions = clientOptions

          return Promise.resolve(mockClient)
        }
        return Promise.reject(new Error(`Unsupported provider ID: ${providerId}`))
      })
    }

    // Mock console.warn to avoid polluting the test output
    jest.spyOn(console, 'warn').mockImplementation(() => {
      return
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should return an empty object when window is undefined (SSR)', async () => {
    const originalWindow = global.window

    Object.defineProperty(global, 'window', {
      get() {
        return undefined
      },
      configurable: true
    })

    const result = await initializeProviders([PROVIDER_ID.EXODUS])
    expect(result).toEqual({})

    Object.defineProperty(global, 'window', {
      value: originalWindow,
      configurable: true
    })
  })

  it('should initialize providers with default node configuration', async () => {
    // Initialize default providers
    const result = await initializeProviders([PROVIDER_ID.EXODUS])

    // Check if the returned object has the correct keys
    expect(Object.keys(result)).toEqual(expect.arrayContaining([PROVIDER_ID.EXODUS]))
    expect(Object.keys(result)).not.toContain(PROVIDER_ID.KMD)
    expect(Object.keys(result)).not.toContain(PROVIDER_ID.MNEMONIC)
    expect(Object.keys(result)).not.toContain(PROVIDER_ID.WALLETCONNECT)
    expect(Object.keys(result)).not.toContain(PROVIDER_ID.ALGOSIGNER)
    expect(Object.keys(result)).not.toContain(PROVIDER_ID.MYALGO)

    // Check if the clients were initialized with the default node configuration
    for (const providerId of Object.keys(result)) {
      expect(allClients[providerId].init).toHaveBeenCalledWith({
        network: DEFAULT_NETWORK,
        algodOptions: [DEFAULT_NODE_TOKEN, DEFAULT_NODE_BASEURL, DEFAULT_NODE_PORT, undefined],
        algosdkStatic: undefined
      })
    }
  })

  it('should return an object with the expected shape', async () => {
    const providers = Object.values(PROVIDER_ID).filter(
      (providerId) => providerId !== PROVIDER_ID.WALLETCONNECT
    )

    // Initialize providers
    const result = await initializeProviders(providers)

    // Check if the returned object has the correct keys
    expect(Object.keys(result)).toEqual(expect.arrayContaining(providers))

    // Check if the returned clients are instances of BaseClient
    for (const clientInstance of Object.values(result)) {
      expect(clientInstance).toBeInstanceOf(BaseClient)
    }
  })

  it('should initialize specified providers only', async () => {
    // Initialize specified providers
    const result = await initializeProviders([PROVIDER_ID.PERA, PROVIDER_ID.DEFLY])

    // Check if the returned object has the correct keys
    expect(Object.keys(result)).toEqual(
      expect.arrayContaining([PROVIDER_ID.PERA, PROVIDER_ID.DEFLY])
    )
  })

  it('should initialize providers using custom node configuration', async () => {
    // Initialize with custom node configuration
    const result = await initializeProviders([], {
      network: 'testnet',
      nodeServer: 'http://localhost',
      nodeToken: 'testToken',
      nodePort: '1234'
    })

    // Check if the clients were initialized with the custom node configuration
    for (const providerId of Object.keys(result)) {
      expect(allClients[providerId].init).toHaveBeenCalledWith({
        network: 'testnet',
        algodOptions: ['testToken', 'http://localhost', '1234'],
        algosdkStatic: undefined
      })
    }
  })

  it('should initialize providers using provided algosdk instance', async () => {
    // Initialize with static algosdk instance
    const result = await initializeProviders([], undefined, algosdk)

    // Check if the clients were initialized with the static algosdk instance
    for (const providerId of Object.keys(result)) {
      expect(allClients[providerId].init).toHaveBeenCalledWith({
        network: DEFAULT_NETWORK,
        algodOptions: [DEFAULT_NODE_TOKEN, DEFAULT_NODE_BASEURL, DEFAULT_NODE_PORT],
        algosdkStatic: algosdk
      })
    }
  })

  it('should initialize providers with a mix of provider IDs and ProviderConfig objects', async () => {
    // Initialize providers with a mix IDs and config objects
    const result = await initializeProviders([
      PROVIDER_ID.DEFLY,
      { id: PROVIDER_ID.PERA, clientOptions: { shouldShowSignTxnToast: false } },
      { id: PROVIDER_ID.MYALGO, clientOptions: { disableLedgerNano: false } },
      PROVIDER_ID.EXODUS
    ])

    // Check if the returned object has the correct keys
    expect(Object.keys(result)).toEqual(
      expect.arrayContaining([PROVIDER_ID.DEFLY, PROVIDER_ID.PERA, PROVIDER_ID.MYALGO])
    )

    // Check if the init method was called with the correct parameters
    expect(allClients[PROVIDER_ID.DEFLY].init).toHaveBeenCalledWith(
      expect.not.objectContaining({
        clientOptions: expect.anything()
      })
    )
    expect(allClients[PROVIDER_ID.PERA].init).toHaveBeenCalledWith(
      expect.objectContaining({
        clientOptions: { shouldShowSignTxnToast: false }
      })
    )
    expect(allClients[PROVIDER_ID.MYALGO].init).toHaveBeenCalledWith(
      expect.objectContaining({
        clientOptions: { disableLedgerNano: false }
      })
    )
    expect(allClients[PROVIDER_ID.EXODUS].init).toHaveBeenCalledWith(
      expect.not.objectContaining({
        clientOptions: expect.anything()
      })
    )
  })
})
