/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, cleanup, act, RenderResult } from '@testing-library/react'
import ConnectWallet from './Example'

jest.mock('../../index', () => ({
  initializeProviders: jest.fn(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  WalletProvider: ({ children }: { children: any }) => <div>{children}</div>,
  reconnectProviders: jest.fn(),
  useWallet: jest.fn().mockImplementation(() => ({
    activeAccount: {
      name: 'mock account name',
      address: 'mock account address',
      providerId: 'mock provider id'
    }
  })),
  PROVIDER_ID: {
    DEFLY: 'mock_defly_id',
    PERA: 'mock_pera_id',
    DAFFI: 'mock_daffi_id',
    EXODUS: 'mock_exodus_id',
    LUTE: 'mock_lute_id',
    KIBISIS: 'mock_kibisis_id'
  },
  useInitializeProviders: jest.fn()
}))

describe('ConnectWallet', () => {
  beforeEach(() => {
    // Mock console.log to avoid polluting the test output
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    jest.clearAllMocks()
  })

  it('should render the Account, Connect, and Transact components', async () => {
    let component: RenderResult | undefined

    await act(async () => {
      component = render(<ConnectWallet />)
    })

    if (component) {
      expect(component.getByText(/mock account name/i)).toBeTruthy()
      expect(component.getByText(/mock account address/i)).toBeTruthy()
      expect(component.getByText(/mock provider id/i)).toBeTruthy()
    } else {
      throw new Error('Component not rendered')
    }
  })
})
