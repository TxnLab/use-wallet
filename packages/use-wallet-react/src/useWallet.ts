'use client'

import { useStore } from '@tanstack/react-store'
import * as React from 'react'
import { useWalletManager } from './WalletProvider'
import type { WalletAccount, WalletMetadata } from '@txnlab/use-wallet-js'
import type algosdk from 'algosdk'

export interface Wallet {
  id: string
  metadata: WalletMetadata
  accounts: WalletAccount[]
  activeAccount: WalletAccount | null
  isConnected: boolean
  isActive: boolean
  connect: () => Promise<WalletAccount[]>
  disconnect: () => Promise<void>
  setActive: () => void
  setActiveAccount: (address: string) => void
}

export function useWallet() {
  const manager = useWalletManager()

  const algodClient: algosdk.Algodv2 = manager.algodClient

  const walletStateMap = useStore(manager.store, (state) => state.wallets)
  const activeWalletId = useStore(manager.store, (state) => state.activeWallet)

  const wallets = React.useMemo(() => {
    return [...manager.wallets.values()].map((wallet): Wallet => {
      const walletState = walletStateMap[wallet.id]

      return {
        id: wallet.id,
        metadata: wallet.metadata,
        accounts: walletState?.accounts ?? [],
        activeAccount: walletState?.activeAccount ?? null,
        isConnected: !!walletState,
        isActive: wallet.id === activeWalletId,
        connect: () => wallet.connect(),
        disconnect: () => wallet.disconnect(),
        setActive: () => wallet.setActive(),
        setActiveAccount: (addr) => wallet.setActiveAccount(addr)
      }
    })
  }, [manager, walletStateMap, activeWalletId])

  const activeWallet = activeWalletId ? manager.getWallet(activeWalletId) || null : null
  const activeWalletState = activeWalletId ? walletStateMap[activeWalletId] || null : null

  const activeWalletAccounts = activeWalletState?.accounts ?? null
  const activeWalletAddresses = activeWalletAccounts?.map((account) => account.address) ?? null
  const activeAccount = activeWalletState?.activeAccount ?? null
  const activeAddress = activeAccount?.address ?? null

  const activeNetwork = useStore(manager.store, (state) => state.activeNetwork)
  const setActiveNetwork = manager.setActiveNetwork

  const signTransactions = (
    txnGroup: algosdk.Transaction[] | algosdk.Transaction[][] | Uint8Array[] | Uint8Array[][],
    indexesToSign?: number[],
    returnGroup?: boolean
  ) => {
    if (!activeWallet) {
      throw new Error('No active wallet')
    }
    return activeWallet.signTransactions(txnGroup, indexesToSign, returnGroup)
  }

  const transactionSigner = (txnGroup: algosdk.Transaction[], indexesToSign: number[]) => {
    if (!activeWallet) {
      throw new Error('No active wallet')
    }
    return activeWallet.transactionSigner(txnGroup, indexesToSign)
  }

  return {
    wallets,
    algodClient,
    activeNetwork,
    activeWallet,
    activeWalletAccounts,
    activeWalletAddresses,
    activeAccount,
    activeAddress,
    setActiveNetwork,
    signTransactions,
    transactionSigner
  }
}
