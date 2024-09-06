import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Store } from '@tanstack/store';
import { LiquidWallet } from 'src/wallets/liquid';
import { WalletId, WalletAccount } from 'src/wallets/types';
import { State, defaultState } from 'src/store';
import { addWallet } from 'src/store/actions';
import type { LiquidOptions } from '@algorandfoundation/liquid-auth-use-wallet-client';

// Define `self` to avoid ReferenceError in Node.js environment
(global as any).self = global;

// Mock BaseWallet
vi.mock('src/wallets/baseWallet', () => ({
  BaseWallet: class {
    // Mock any necessary methods or properties of BaseWallet
  },
}));

// Mock LiquidAuthClient
const mockLiquidAuthClient = {
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  checkSession: vi.fn().mockResolvedValue({ user: { wallet: 'mockWalletAddress' } }), // Ensure checkSession returns the correct data
  signTransactions: vi.fn().mockResolvedValue([new Uint8Array()]),
  hideModal: vi.fn(),
};

// Mock the module
vi.mock('@algorandfoundation/liquid-auth-use-wallet-client', () => ({
  LiquidAuthClient: vi.fn().mockImplementation(() => mockLiquidAuthClient),
  ICON: 'mockIcon',
}));

// Mock Store
vi.mock('@tanstack/store', () => ({
  Store: vi.fn().mockImplementation(() => ({
    state: defaultState,
    setState: vi.fn(),
  })),
}));

// Mock addWallet action
vi.mock('src/store/actions', () => ({
  addWallet: vi.fn(),
}));

describe('LiquidWallet', () => {
  let wallet: LiquidWallet;
  let store: Store<State>;

  beforeEach(() => {
    vi.clearAllMocks();

    store = new Store<State>(defaultState);
    wallet = new LiquidWallet({
      id: WalletId.LIQUID,
      metadata: { name: 'Liquid' }, // Ensure metadata is correctly initialized
      getAlgodClient: {} as any,
      store,
      subscribe: vi.fn(),
      options: { RTC_config_username: 'username', RTC_config_credential: 'credential' } as LiquidOptions,
    });

    // Initialize necessary properties
    wallet.activeAddress = 'mockWalletAddress';
    wallet.isConnected = false;
    wallet.authClient = mockLiquidAuthClient as any;
    wallet.onDisconnect = vi.fn(); // Mock onDisconnect method
  });

  afterEach(async () => {
    await wallet.disconnect();
  });

  describe('connect', () => {
    it('connect: should return accounts and update store', async () => {
      const accounts = await wallet.connect();

      expect(accounts).toEqual([{ name: 'Liquid Account 1', address: 'mockWalletAddress' }]);
      expect(wallet.isConnected).toBe(true);
      expect(addWallet).toHaveBeenCalledWith(store, {
        walletId: WalletId.LIQUID,
        wallet: {
          accounts: [{ name: 'Liquid Account 1', address: 'mockWalletAddress' }],
          activeAccount: { name: 'Liquid Account 1', address: 'mockWalletAddress' },
        },
      });
      expect(mockLiquidAuthClient.hideModal).toHaveBeenCalled();
    });

    it('connect: should throw an error if no accounts are found', async () => {
      mockLiquidAuthClient.checkSession.mockResolvedValueOnce({ user: { wallet: null } });

      await expect(wallet.connect()).rejects.toThrowError('No accounts found!');
      expect(wallet.isConnected).toBe(false);
    });

    it('connect: should re-throw an error thrown by authClient.connect', async () => {
      mockLiquidAuthClient.connect.mockRejectedValueOnce(new Error('mock error'));

      await expect(wallet.connect()).rejects.toThrowError('mock error');
      expect(wallet.isConnected).toBe(false);
    });
  });

  // Uncomment and update other tests as needed
  // describe('disconnect', () => {
  //   it('disconnect: should call authClient.disconnect and update store', async () => {
  //     await wallet.connect();
  //     await wallet.disconnect();

  //     expect(mockLiquidAuthClient.disconnect).toHaveBeenCalled();
  //     expect(store.state.wallets[WalletId.LIQUID]).toBeUndefined();
  //     expect(wallet.isConnected).toBe(false);
  //   });

  //   it('disconnect: should throw an error if no auth client is found', async () => {
  //     wallet.authClient = null;

  //     await expect(wallet.disconnect()).rejects.toThrowError('No auth client found to disconnect from');
  //   });
  // });

  // describe('resumeSession', () => {
  //   it('resumeSession: should call disconnect', async () => {
  //     const disconnectSpy = vi.spyOn(wallet, 'disconnect');
  //     await wallet.resumeSession();

  //     expect(disconnectSpy).toHaveBeenCalled();
  //   });
  // });

  // describe('signTransactions', () => {
  //   const suggestedParams = {
  //     flatFee: false,
  //     fee: 0,
  //     firstRound: 43564565,
  //     lastRound: 43565565,
  //     genesisID: 'testnet-v1.0',
  //     genesisHash: 'SGO1GKSzyE7IEPItTxCBy9x8FmnrCDexi9/cOUJOiI=',
  //     minFee: 1000,
  //   };
    
  //   const algoAddress = '6R7VBOFIZCNA5PTJDOFEWBDYZXDATQILK3AYZRBG77Y56XPMTSPVZICOEI';
    
  //   const txnGroup = [
  //     new Transaction({
  //       from: algoAddress,
  //       to: algoAddress,
  //       amount: 0,
  //       suggestedParams,
  //     }),
  //   ];

  //   const indexesToSign = [0];

  //   it('signTransaction: should call authClient.signTransactions', async () => {
  //     await wallet.signTransactions(txnGroup, indexesToSign);

  //     expect(mockLiquidAuthClient.signTransactions).toHaveBeenCalled();
  //     expect(mockLiquidAuthClient.signTransactions).toHaveBeenCalledWith(txnGroup, wallet.activeAddress, indexesToSign);
  //   });

  //   it('signTransaction: should throw an error if no active account', async () => {
  //     wallet.activeAddress = null;

  //     await expect(wallet.signTransactions(txnGroup, indexesToSign)).rejects.toThrowError('No active account');
  //   });
  // });
});