import { BaseWallet } from 'src/wallets/base'
import { WalletAccount, WalletConstructor, WalletId } from './types'
import { SignalClient } from '@algorandfoundation/liquid-client'
import {Transaction, encodeUnsignedTransaction} from 'algosdk'
import { Store } from '@tanstack/store'
import { addWallet, State, WalletState } from 'src/store'
import { toSignTransactionsParamsRequestMessage, toBase64URL, fromBase64Url } from '@algorandfoundation/provider'
import { decode } from 'cbor-x'

export type LiquidOptions = {
  RTC_config_username: string,
  RTC_config_credential: string,
  // TODO: RTC_CONFIGURATION should be configurable, and not hard-coded to Nodely's TURN servers
}


// Liquid Auth API JSON types
interface PassKeyCredential {
  device: string;
  publicKey: string;
  credId: string;
  prevCounter: number;
}

interface LiquidAuthUser {
  id: string;
  wallet: string;
  credentials: PassKeyCredential[];
}

interface Cookie {
  originalMaxAge: number | null;
  expires: Date | null;
  secure: boolean;
  httpOnly: boolean;
  path: string;
}

interface LiquidAuthSession {
  cookie: Cookie;
  wallet: string;
}

interface LiquidAuthAPIJSON {
  user: LiquidAuthUser;
  session: LiquidAuthSession;
}



// TODO: get an SVG for a proper icon
const ICON = `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="249" height="249" viewBox="0 0 249 249" xml:space="preserve">
<desc>Created with Fabric.js 3.6.6</desc>
<defs>
</defs>
<g transform="matrix(2.52 0 0 2.52 124.74 124.74)"  >
<circle style="stroke: rgb(0,0,0); stroke-width: 19; stroke-dasharray: none; stroke-linecap: butt; stroke-dashoffset: 0; stroke-linejoin: miter; stroke-miterlimit: 4; fill: rgb(0,0,0); fill-rule: nonzero; opacity: 1;"  cx="0" cy="0" r="40" />
</g>
<g transform="matrix(-1.16 -0.01 0.01 -0.97 125.63 187.7)"  >
<path style="stroke: rgb(0,0,0); stroke-width: 0; stroke-dasharray: none; stroke-linecap: butt; stroke-dashoffset: 0; stroke-linejoin: miter; stroke-miterlimit: 4; fill: rgb(170,0,255); fill-rule: nonzero; opacity: 1;"  transform=" translate(-57.95, -28.98)" d="m 0 57.952755 l 0 0 c 0 -32.006424 25.946333 -57.952755 57.952755 -57.952755 c 32.006428 0 57.952755 25.946333 57.952755 57.952755 l -28.97638 0 c 0 -16.003212 -12.97316 -28.976377 -28.976376 -28.976377 c -16.003212 0 -28.976377 12.9731655 -28.976377 28.976377 z" stroke-linecap="round" />
</g>
<g transform="matrix(1.16 0 0 2.21 126.06 96.74)"  >
<path style="stroke: rgb(255,4,233); stroke-width: 0; stroke-dasharray: none; stroke-linecap: butt; stroke-dashoffset: 0; stroke-linejoin: miter; stroke-miterlimit: 4; fill: rgb(170,0,255); fill-rule: nonzero; opacity: 1;"  transform=" translate(-57.95, -28.98)" d="m 0 57.952755 l 0 0 c 0 -32.006424 25.946333 -57.952755 57.952755 -57.952755 c 32.006428 0 57.952755 25.946333 57.952755 57.952755 l -28.97638 0 c 0 -16.003212 -12.97316 -28.976377 -28.976376 -28.976377 c -16.003212 0 -28.976377 12.9731655 -28.976377 28.976377 z" stroke-linecap="round" />
</g>
</svg>`

export class LiquidWallet extends BaseWallet{
  protected store: Store<State>
  private options: LiquidOptions
  private client: SignalClient
  private RTC_CONFIGURATION: RTCConfiguration
  private modal: LiquidAuthModal | undefined | null
  private dataChannel: RTCDataChannel | undefined
  private linkedBool: boolean = false

  constructor({
    id,
    store,
    subscribe,
    getAlgodClient,
    options,
    metadata = {},
  }: WalletConstructor<WalletId.LIQUID>) {
    super({ id, metadata, getAlgodClient, store, subscribe })

    this.store = store
    this.options = options ?? { RTC_config_username: 'username', RTC_config_credential: 'credential' }
    this.client = new SignalClient(window.origin)
    this.RTC_CONFIGURATION = {
      iceServers: [
          {
              urls: [
                  'stun:stun.l.google.com:19302',
                  'stun:stun1.l.google.com:19302',
                  'stun:stun2.l.google.com:19302',
              ],
          },
          {
              urls: [
                  "turn:global.turn.nodely.network:80?transport=tcp",
                  "turns:global.turn.nodely.network:443?transport=tcp",
                  "turn:eu.turn.nodely.io:80?transport=tcp",
                  "turns:eu.turn.nodely.io:443?transport=tcp",
                  "turn:us.turn.nodely.io:80?transport=tcp",
                  "turns:us.turn.nodely.io:443?transport=tcp",
              ],
              username: this.options.RTC_config_username,
              credential: this.options.RTC_config_credential,
          },
          {
              urls: [
                  "turn:global.relay.metered.ca:80",
                  "turn:global.relay.metered.ca:80?transport=tcp",
                  "turn:global.relay.metered.ca:443",
                  "turns:global.relay.metered.ca:443?transport=tcp"
              ],
              // default username and credential when the turn server doesn't
              // use auth, the client still requires a value
              username: this.options.RTC_config_username,
              credential: this.options?.RTC_config_credential,
          },
      ],
      iceCandidatePoolSize: 10,
    }
  }

  static defaultMetadata = {
    name: 'Liquid',
    icon: ICON
  }

  public setDataChannel(dc: RTCDataChannel) {
    this.dataChannel = dc
  }

  // Method to handle link message and update linked state
  async onLinkMessage(message: any) {
    if (message.wallet) {
      const data = await this.checkSession()
      if (data?.user?.wallet === message.wallet) {
        // Confirm that the message sent over the wire is the same as what /auth/session returns
        console.log('Session data:', data);
          console.log('Wallet linked:', message.wallet);
          this.linkedBool = true
          return
      }
      throw new Error('Remote wallet address and /auth/session wallet address do not match')
    }
    throw new Error('Wallet field not part of link message')
  }
    

/**
 * Check if a session exists on the /auth/session endpoint
 * @returns 
 */
async checkSession(): Promise<LiquidAuthAPIJSON | null> {
  try {
    const response = await fetch(`${window.origin}/auth/session`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('Session data:', data);
      return data; // Directly return the parsed JSON data
    } else {
      console.log('No session found');
      return null;
    }
  } catch (error) {
    console.error('Error querying session:', error);
    return null;
  }
}

  public async connect(_args?: Record<string, any>): Promise<WalletAccount[]> {
    const requestId = SignalClient.generateRequestId();
    const altRequestId = requestId;
  
    if (!this.modal) {
      this.modal = new LiquidAuthModal(this, this.client, this.RTC_CONFIGURATION, requestId, altRequestId);
      
      // Append the modal to the document body
      document.body.appendChild(this.modal);
    }
  
    this.modal.show();
    //this.dataChannel = this.modal.dataChannel

    // Function to wait until linkedBool is true
    const waitForLinkedBool = (): Promise<void> => {
      return new Promise((resolve) => {
        const checkLinkedBool = () => {
          if (this.linkedBool) {
            resolve();
          } else {
            setTimeout(checkLinkedBool, 100); // Check every 100ms
          }
        };
        checkLinkedBool();
      });
    };

    await waitForLinkedBool();

    const sessionData  = await this.checkSession();
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
    this.modal.hide();
    return Promise.resolve(walletAccounts);
  }

  async logOutSession(): Promise<boolean> {
    try {
        const response = await fetch(`${window.origin}/auth/logout`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        if (response.status === 302 || response.status === 200) {
          // Perform the checkSession call
          const sessionStatus = await this.checkSession();

          // Verify that the user is set to null
          if (sessionStatus?.user === null) {
            console.log('Successfully logged.');
            return true
          } else {
            console.error('Logout failed: User is still logged in.');
            return false;
          }
        } else {
            console.log('Failed to log out, received code: ', response.status);
            return false;
        }
    } catch (error) {
        console.error('Error logging out:', error);
        return false;
    }
  }

  public async disconnect(): Promise<void> {
    // Reset the state variable
    this.linkedBool = false;

    // built in BaseWallet method that clears active wallet
    this.onDisconnect();

    if (this.modal) {
      // Remove any event listeners to prevent memory leaks
      this.modal.cleanUp;

      // Set the modal reference to null
      this.modal = null;
    }
    
    // Kills socket etc connections
    this.client.close();

    const successfulLogout = await this.logOutSession();

    if (successfulLogout) {
      console.info(`[${this.metadata.name}] ✅ Disconnected.`);
    } else {
      console.error(`[${this.metadata.name}] ❌ Failed to disconnect.`);
      throw Error('Failed to disconnect');
    }


  }
  
  // Liquid Auth in its current form does not allow for session resumption
  // A new session must be created each time a user shuts down their browser.
  public resumeSession(): Promise<void> {
    return this.disconnect()
  }

  public async signTransactions<T extends Transaction[] | Uint8Array[]>(
    _txnGroup: T | T[],
    _indexesToSign?: number[]
  ): Promise<(Uint8Array | null)[]> {

  const messageId = SignalClient.generateRequestId() // just used to generate a random unique id
  const providerId = "02657eaf-be17-4efc-b0a4-19d654b2448e" // just a string to identify the provider

  if (!this.dataChannel) {
    throw new Error('Data channel not set yet!');
  }

  // Prepare the Data Channel for responses
  const awaitResponse = (): Promise<(Uint8Array | null)[]> => new Promise((resolve) => {
    if (this.dataChannel) {
      this.dataChannel.onmessage = async (evt: { data: string }) => {

        const message = decode(fromBase64Url(evt.data));
        // Handle message types and create response

        console.log("Received message:", message);
        if (message.reference === 'arc0027:sign_transactions:response') {
          // Make sure it's the appropriate message we are attaching the signature to
          if (message.requestId !== messageId) return;

          const encodedSignatures = message.result.stxns;

          // Attach Signature Example:
          const transactionsToSend = (_txnGroup as Transaction[]).map((txn, idx) => {
            return txn.attachSignature(this.activeAddress!, fromBase64Url(encodedSignatures[idx]));
          });

          resolve(transactionsToSend);
        }
    };
  }});

  const encodedStr = toSignTransactionsParamsRequestMessage(
    messageId,
    providerId,
    _txnGroup.map((txn) => ({ txn: toBase64URL(encodeUnsignedTransaction(txn as Transaction)) }))
  );

  // Send the Request Message
  this.dataChannel.send(encodedStr);

  // Await the message response
  return await awaitResponse();
}}

/* ----------- UI Component ----------- */

class LiquidAuthModal extends HTMLElement {
  parentProvider: LiquidWallet;
  localIdElement!: HTMLElement;
  modalElement!: HTMLElement;
  closeButton!: HTMLElement;
  requestId: string;
  altRequestId: string;
  client: SignalClient;
  RTC_CONFIGURATION: RTCConfiguration;
  eventListeners: { element: HTMLElement, type: string, listener: EventListenerOrEventListenerObject }[] = [];

  constructor(parentProvider: LiquidWallet, client: SignalClient, RTC_CONFIGURATION: RTCConfiguration, requestId: string, altRequestId: string) {
    super();
    this.attachShadow({ mode: "open" });

    this.parentProvider = parentProvider;
    this.client = client;
    this.RTC_CONFIGURATION = RTC_CONFIGURATION;
    this.requestId = requestId;
    this.altRequestId = altRequestId;

    if (this.shadowRoot) {
      const styleSheet = document.createElement("style");
      styleSheet.textContent = `
        .hidden {
          display: none;
        }
        .liquid-auth-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .modal-content {
          background: white;
          padding: 20px;
          border-radius: 8px;
          position: relative;
          max-width: 500px;
          width: 100%;
          color: black;
        }
        .close-button {
          position: absolute;
          top: 10px;
          right: 10px;
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: black;
        }
      `;

      const liquidAuthModal = document.createElement("template");
      liquidAuthModal.innerHTML = `
        <div class="liquid-auth-modal hidden">
          <div class="modal-content">
            <button class="close-button">x</button>
            <div class="call-session">
              <div class="offer">
                <a id="qr-link" href="https://github.com/algorandfoundation/liquid-auth-js" target="_blank">
                  <img id="liquid-qr-code" src="" class="logo hidden" alt="Liquid QR Code" />
                </a>
                <hgroup>
                  <h1>Offer Client</h1>
                  <h2>Local ID: ${this.requestId}</h2>
                </hgroup> 
                <button id="start">Start</button>
              </div>
            </div>
          </div>
        </div>
      `;

      this.shadowRoot.append(
        liquidAuthModal.content.cloneNode(true),
        styleSheet
      );

      this.localIdElement = this.shadowRoot.querySelector('.liquid-auth-modal h2') as HTMLElement;
      this.modalElement = this.shadowRoot.querySelector('.liquid-auth-modal') as HTMLElement;
      this.closeButton = this.shadowRoot.querySelector('.close-button') as HTMLElement;

      const hideListener = () => this.hide();
      this.closeButton.addEventListener('click', hideListener);
      this.eventListeners.push({ element: this.closeButton, type: 'click', listener: hideListener });

      const startButton = this.shadowRoot.querySelector('#start') as HTMLButtonElement;
      const startListener = () => this.handleOfferClient();
      startButton.addEventListener('click', startListener);
      this.eventListeners.push({ element: startButton, type: 'click', listener: startListener });
    }
  }

  handleDataChannel = (_dataChannel: RTCDataChannel) => {
    _dataChannel.onmessage = (e) => {
        console.log('Received message:', e.data);
    }
    this.parentProvider.setDataChannel(_dataChannel);
  }

  async handleOfferClient() {
    const qrLinkElement = this.shadowRoot!.querySelector('#qr-link') as HTMLAnchorElement;

    if (qrLinkElement) {
      qrLinkElement.href = 'https://github.com/algorandfoundation/liquid-auth-js';
      this.client.peer(this.requestId, 'offer', this.RTC_CONFIGURATION).then(this.handleDataChannel);

      this.client.on('link-message', (message) => {
        this.parentProvider.onLinkMessage(message);

        const offerElement = this.shadowRoot!.querySelector('.offer') as HTMLElement;
        if (offerElement) {
          offerElement.classList.add('hidden');
        }
      });

      const image = this.shadowRoot!.querySelector('#liquid-qr-code') as HTMLImageElement;
      if (image) {
        image.src = await this.client.qrCode();
        image.classList.remove('hidden');
      }

      const deepLink = this.shadowRoot!.querySelector('#qr-link') as HTMLAnchorElement;
      if (deepLink) {
        deepLink.href = this.client.deepLink(this.requestId);
      }

      const startButton = this.shadowRoot!.querySelector('#start') as HTMLButtonElement;
      if (startButton) {
        startButton.classList.add('hidden');
      }
    } else {
      console.error('QR link element not found');
    }
  }

  public cleanUp() {
    // Remove all event listeners to prevent memory leaks
    this.eventListeners.forEach(({ element, type, listener }) => {
      element.removeEventListener(type, listener);
    });
    this.eventListeners = [];

    // Remove the modal from the DOM
    document.body.removeChild(this);
  }


  show() {
    this.localIdElement.textContent = `Local ID: ${this.requestId}`;
    this.modalElement.classList.remove('hidden');
  }

  hide() {
    this.modalElement.classList.add('hidden');
    this.modalElement.style.display = 'none';
  }
}
customElements.define('liquid-auth-modal', LiquidAuthModal);

