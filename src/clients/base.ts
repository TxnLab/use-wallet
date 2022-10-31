import { algosdk, algodClient } from "../algod";
import { PROVIDER_ID } from "../constants";
import type { WalletProvider, Asset, Wallet, AccountInfo } from "../types";
import { ConfirmedTxn, TxnType } from "../types";
import { TransactionsArray, TxnInfo } from "../types";
import { audio } from "../media/audio";

const isIOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

export interface BaseWalletInterface {
  connect(onDisconnect: () => void): Promise<Wallet>;
  healthCheck(): Promise<Record<string, never>>;
  disconnect(): Promise<void>;
  reconnect(onDisconnect: () => void): Promise<Wallet | null>;
  decodeTransaction(txn: string, isSigned: boolean): algosdk.Transaction;
  logEncodedTransaction(txn: string, isSigned: boolean): void;
  groupTransactionsBySender(
    transactions: TransactionsArray
  ): Record<string, TxnInfo[]>;
  signTransactions(
    activeAddress: string,
    transactions: Array<Uint8Array>
  ): Promise<Uint8Array[]>;
  signEncodedTransactions(
    transactions: TransactionsArray
  ): Promise<Uint8Array[]>;
  sendRawTransactions(
    transactions: Uint8Array[]
  ): Promise<ConfirmedTxn & { id: string }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getAccountInfo(address: string): Promise<AccountInfo>;
  getAssets(address: string): Promise<Asset[]>;
  waitForConfirmation(txId: string, timeout?: number): Promise<ConfirmedTxn>;
}

abstract class BaseWallet implements BaseWalletInterface {
  keepWCAlive: HTMLAudioElement;

  protected abstract id: PROVIDER_ID;
  protected abstract provider: WalletProvider;

  abstract connect(onDisconnect: () => void): Promise<Wallet>;
  abstract disconnect(): Promise<void>;
  abstract reconnect(onDisconnect: () => void): Promise<Wallet | null>;
  abstract signTransactions(
    activeAdress: string,
    transactions: Array<Uint8Array>
  ): Promise<Uint8Array[]>;
  abstract signEncodedTransactions(
    transactions: TransactionsArray
  ): Promise<Uint8Array[]>;

  protected constructor() {
    this.keepWCAlive = new Audio();
  }

  async healthCheck() {
    return await algodClient.healthCheck().do();
  }

  async getAccountInfo(address: string) {
    const accountInfo = await algodClient.accountInformation(address).do();

    if (!accountInfo) {
      throw new Error("Unable to get account information");
    }

    return accountInfo as AccountInfo;
  }

  async getAssets(address: string) {
    const accountInfo = await algodClient.accountInformation(address).do();

    if (!accountInfo || accountInfo.assets === undefined) {
      throw new Error("Unable to get account assets");
    }

    return accountInfo.assets as Asset[];
  }

  async waitForConfirmation(txId: string, timeout = 4) {
    const confirmation = (await algosdk.waitForConfirmation(
      algodClient,
      txId,
      timeout
    )) as ConfirmedTxn;

    return { txId, ...confirmation };
  }

  decodeTransaction = (txn: string, isSigned: boolean) => {
    return isSigned
      ? algosdk.decodeSignedTransaction(
          new Uint8Array(Buffer.from(txn, "base64"))
        ).txn
      : algosdk.decodeUnsignedTransaction(
          new Uint8Array(Buffer.from(txn, "base64"))
        );
  };

  logEncodedTransaction(txn: string, isSigned: boolean) {
    const txnObj = this.decodeTransaction(txn, isSigned);

    console.log("TRANSACTION", {
      isSigned,
      from: txnObj.from && algosdk.encodeAddress(txnObj.from.publicKey),
      to: txnObj.to && algosdk.encodeAddress(txnObj.to.publicKey),
      type: txnObj.type,
      txn: txnObj,
    });
  }

  groupTransactionsBySender(transactions: TransactionsArray) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function groupBy(objectArray: Record<string, any>[], property: string) {
      return objectArray.reduce(function (acc, obj) {
        const key = obj[property];
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(obj);
        return acc;
      }, {});
    }

    const decodedGroup = transactions.reduce(
      (acc: TxnInfo[], [type, txn], index) => {
        if (type === "u") {
          const decodedTxn = this.decodeTransaction(txn, false);
          const from = decodedTxn.from
            ? algosdk.encodeAddress(decodedTxn.from.publicKey)
            : "";
          const to = decodedTxn.to
            ? algosdk.encodeAddress(decodedTxn.to.publicKey)
            : "";
          const type = (decodedTxn.type as TxnType) || "";
          const amount = Number(decodedTxn.amount) || 0; // convert from bigint to number

          const txnObj = {
            groupIndex: index,
            amount,
            from,
            to,
            type,
            txn,
          };

          acc.push(txnObj);
        }

        return acc;
      },
      []
    );
    return groupBy(decodedGroup, "from");
  }

  async sendRawTransactions(transactions: Uint8Array[]) {
    const sentTransaction = await algodClient
      .sendRawTransaction(transactions)
      .do();

    if (!sentTransaction) {
      throw new Error("Transaction failed.");
    }

    const confirmedTransaction = await this.waitForConfirmation(
      sentTransaction.txId
    );

    return {
      id: sentTransaction.txId,
      ...confirmedTransaction,
    };
  }

  keepWCAliveStart() {
    // Playing an audio file prevents Wallet Connect's
    // web socket connection from being dropped when
    // iOS goes into background mode

    if (!isIOS) {
      return;
    }

    this.keepWCAlive.src = audio;
    this.keepWCAlive.autoplay = true;
    this.keepWCAlive.volume = 0;
    this.keepWCAlive.loop = true;
    this.keepWCAlive.play();
  }

  keepWCAliveStop() {
    if (!isIOS) {
      return;
    }

    this.keepWCAlive.pause();
  }
}

export default BaseWallet;
