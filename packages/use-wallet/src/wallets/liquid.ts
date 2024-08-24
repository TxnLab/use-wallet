import { BaseWallet } from 'src/wallets/base'
import { WalletAccount, WalletConstructor, WalletId } from './types'
import { SignalClient } from '@algorandfoundation/liquid-client'
import algosdk from 'algosdk'
import { Store } from '@tanstack/store'
import { addWallet, State, WalletState } from 'src/store'

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
  private modal: LiquidAuthModal | undefined
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
  console.log("check session inside!");
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
  
  public disconnect(): Promise<void> {
    this.client.close();

    // clean up
    /// clean up the modal, removing it from append
    /// reset the variables and state
    throw new Error('Method not implemented.');
  }
  
  public resumeSession(): Promise<void> {
    throw new Error('Method not implemented.');
  }
  
  public signTransactions<T extends algosdk.Transaction[] | Uint8Array[]>(
    _txnGroup: T | T[],
    _indexesToSign?: number[]
  ): Promise<(Uint8Array | null)[]> {

  // trick should be here: https://github.com/algorandfoundation/liquid-auth-android/blob/dbbd796b19c050399bb88552bb529fd135957bc9/demo/src/main/java/foundation/algorand/demo/AnswerActivity.kt#L494
  
  // send the transaction bytes with the data channel, using "type": "transaction"
  // receive the signed transaction bytes with the data channel, using "type": "transaction-signature"

  const transactionBytesJson = JSON.stringify(_txnGroup)
  this.dataChannel!.send('transaction')

  // long term needs to be an authentication process, so that MITM attacks cannot replace the transaction bytes

    throw new Error('Method not implemented.');
  }
}
  
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

  constructor(parentProvider: LiquidWallet, client: SignalClient, RTC_CONFIGURATION: RTCConfiguration, requestId: string, altRequestId: string) {
    super();
    this.attachShadow({ mode: "open" });

    this.parentProvider = parentProvider
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

      this.closeButton.addEventListener('click', () => {
        this.hide();
      });

      const startButton = this.shadowRoot.querySelector('#start') as HTMLButtonElement;
      startButton.addEventListener('click', () => this.handleOfferClient());

    }
  }

  /**
  * Handle the data channel
  * @param _dataChannel
  */
  handleDataChannel(_dataChannel: RTCDataChannel) {
    //this.dataChannel = dataChannel;
    console.log("hello");
  }

  /**
  * Create a peer connection, wait for an offer and send an answer to the remote client
  */
  async handleOfferClient() {
    const qrLinkElement = this.shadowRoot!.querySelector('#qr-link') as HTMLAnchorElement;

    if (qrLinkElement) {
      qrLinkElement.href = 'https://github.com/algorandfoundation/liquid-auth-js';

      // Peer to the remote client and await their offer
      console.log('requestId', this.requestId);
      this.client.peer(this.requestId, 'offer', this.RTC_CONFIGURATION).then(this.handleDataChannel);
      // Once the link message is received by the remote wallet, hide the offer
      this.client.on('link-message', (message) => {
        // Pass along to the parent provider that the link message has been received
        this.parentProvider.onLinkMessage(message)

        const offerElement = this.shadowRoot!.querySelector('.offer') as HTMLElement;
        if (offerElement) {
          offerElement.classList.add('hidden');
        }

      });

      // Update the render
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


  show() {
    this.localIdElement.textContent = `Local ID: ${this.requestId}`;
    this.modalElement.classList.remove('hidden');
  }

  hide() {
    this.modalElement.classList.add('hidden');
    // Fallback: Directly set display to none
    this.modalElement.style.display = 'none';
  }
}

customElements.define('liquid-auth-modal', LiquidAuthModal);