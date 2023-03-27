/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, cleanup, act, RenderResult } from '@testing-library/react'
import ConnectWallet from './Example'

jest.mock('lottie-web')
jest.mock('../../index', () => ({
  initializeProviders: jest.fn(),
  WalletProvider: ({ children }: { children: any }) => <div>{children}</div>,
  reconnectProviders: jest.fn(),
  useWallet: jest.fn().mockImplementation(() => ({
    activeAccount: {
      name: 'mock account name',
      address: 'mock account address',
      providerId: 'mock provider id'
    }
  }))
}))

describe('ConnectWallet', () => {
  afterEach(cleanup)

  it('should render the Account, Connect, and Transact components', async () => {
    let component: RenderResult

    await act(() => {
      component = render(<ConnectWallet />)
    })

    expect(component!.getByText(/mock account name/i)).toBeTruthy()
    expect(component!.getByText(/mock account address/i)).toBeTruthy()
    expect(component!.getByText(/mock provider id/i)).toBeTruthy()
  })
})
