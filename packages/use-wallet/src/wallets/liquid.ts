import { BaseWallet } from 'src/wallets/base';
import { WalletAccount, WalletConstructor, WalletId } from './types';
import { Store } from '@tanstack/store';
import { addWallet, State, WalletState } from 'src/store';
import { Transaction} from 'algosdk';
import { LiquidAuthClient, ICON } from '@algorandfoundation/liquid-auth-use-wallet-client'; 
import type { LiquidOptions } from "@algorandfoundation/liquid-auth-use-wallet-client";

export { LiquidOptions }

export class LiquidWallet extends BaseWallet {
  protected store: Store<State>;
  private authClient: LiquidAuthClient | undefined | null;
  private options: LiquidOptions;

  constructor({
    id,
    store,
    subscribe,
    getAlgodClient,
    options,
    metadata = {},
  }: WalletConstructor<WalletId.LIQUID>) {
    super({ id, metadata, getAlgodClient, store, subscribe });

    this.store = store;
    this.options = options ?? { RTC_config_username: 'username', RTC_config_credential: 'credential' }
    this.authClient = new LiquidAuthClient(this.options);
  }

  static defaultMetadata = {
    name: 'Liquid',
    icon: ICON
  };

  public async connect(_args?: Record<string, any>): Promise<WalletAccount[]> {
    if (!this.authClient) {
      this.authClient = new LiquidAuthClient(this.options);
    }

    await this.authClient.connect();

    const sessionData = await this.authClient.checkSession();
    const account = sessionData?.user?.wallet;

    if (!account) {
      throw new Error('No accounts found!');
    }

    const walletAccounts: WalletAccount[] = [{
      name: `${this.metadata.name} Account 1`,
      address: account.toString()
    }];

    const walletState: WalletState = {
      accounts: walletAccounts,
      activeAccount: walletAccounts[0]
    };

    addWallet(this.store, {
      walletId: this.id,
      wallet: walletState
    });

    console.info(`[${this.metadata.name}] ✅ Connected.`, walletState);
    this.authClient.hideModal();
    return Promise.resolve(walletAccounts);
  }

  public async disconnect(): Promise<void> {
    if (!this.authClient) {
      throw new Error('No auth client found to disconnect from');
    }

    await this.authClient.disconnect();
    this.onDisconnect();
    console.info(`[${this.metadata.name}] ✅ Disconnected.`);
    this.authClient = null;
  }

  public resumeSession(): Promise<void> {
    return this.disconnect();
  }

  public async signTransactions<T extends Transaction[] | Uint8Array[]>(
    _txnGroup: T | T[],
    _indexesToSign?: number[]
  ): Promise<(Uint8Array | null)[]> {

    if (!this.activeAddress) {
      throw new Error('No active account');
    }

    return this.authClient!.signTransactions(_txnGroup, this.activeAddress, _indexesToSign);
  }
}