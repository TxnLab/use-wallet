import { BaseWallet } from 'src/wallets/base'
import { WalletAccount, WalletConstructor, WalletId } from './types'
import { SignalClient } from '@algorandfoundation/liquid-client'
import algosdk from 'algosdk'
import { Store } from '@tanstack/store'
import { State } from 'src/store'

export type LiquidOptions = {
  RTC_config_username: string,
  RTC_config_credential: string,
  // TODO: RTC_CONFIGURATION should be configurable, and not hard-coded to Nodely's TURN servers
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

  public connect(_args?: Record<string, any>): Promise<WalletAccount[]> {
    const requestId = SignalClient.generateRequestId();
    const altRequestId = requestId;
  
    const modal = new LiquidAuthModal(this.client, this.RTC_CONFIGURATION, requestId, altRequestId);
  
    // Append the modal to the document body
    document.body.appendChild(modal);
  
    modal.show();
  
    return Promise.resolve([]);
  }
  
  public disconnect(): Promise<void> {
    throw new Error('Method not implemented.');
  }
  
  public resumeSession(): Promise<void> {
    throw new Error('Method not implemented.');
  }
  
  public signTransactions<T extends algosdk.Transaction[] | Uint8Array[]>(
    _txnGroup: T | T[],
    _indexesToSign?: number[]
  ): Promise<(Uint8Array | null)[]> {
    throw new Error('Method not implemented.');
  }
}
  
  /* ----------- UI Component ----------- */
  // Inspired by DeflyWalletConnectModal.ts in blockshake's Defly

class LiquidAuthModal extends HTMLElement {
  localIdElement!: HTMLElement
  modalElement!: HTMLElement
  closeButton!: HTMLElement
  requestId: string
  altRequestId: string
  client: SignalClient
  RTC_CONFIGURATION: RTCConfiguration
  dataChannel!: RTCDataChannel

  constructor(client: SignalClient, RTC_CONFIGURATION: RTCConfiguration, requestId: string, altRequestId: string) {
    super();
    this.attachShadow({ mode: "open" });
  
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
        }
        .close-button {
          position: absolute;
          top: 10px;
          right: 10px;
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
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
                <button id="toggle">Switch</button>
              </div>
              <div class="answer hidden">
                <h1>Answer Client</h1>    
                <label for="alt-request">Remote ID:</label>
                <input id="alt-request" value="${this.altRequestId}"/>
                <button id="attestation">Sign In</button>
              </div>
            </div>
            <div class="message-container hidden">
              <h1>Messages</h1>
              <div class="messages"></div>
              <input type="text" id="message" />
              <button id="send-message">Send</button>
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
  
      const toggleButton = this.shadowRoot.querySelector('#toggle') as HTMLButtonElement;
      toggleButton.addEventListener('click', () => this.toggle());
  
      const attestationButton = this.shadowRoot.querySelector('#attestation') as HTMLButtonElement;
      attestationButton.addEventListener('click', () => this.handleSignChallenge());
  
      const sendMessageButton = this.shadowRoot.querySelector('#send-message') as HTMLButtonElement;
      sendMessageButton.addEventListener('click', () => this.sendMessage());
    }
  }

    /**
   * Send a Message to the remote client
   */
   sendMessage() {
    const messages = document.querySelector('.messages') as HTMLDivElement
    const message = document.querySelector('#message') as HTMLInputElement
    this.dataChannel.send(message.value)
    messages.innerHTML += `<p class="local-message">${message.value}</p>`
    message.value = ''
  }
  /**
  * Handle the data channel
  * @param dataChannel
  */
   handleDataChannel(dataChannel: RTCDataChannel) {
    this.dataChannel = dataChannel
    const messagesContainer = document.querySelector('.message-container') as HTMLDivElement
    messagesContainer.classList.remove('hidden')
    const messages = document.querySelector('.messages') as HTMLDivElement
    this.dataChannel.onmessage = (e) => {
        messages.innerHTML += `<p class="remote-message">${e.data}</p>`
    }
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
      this.client.on('link-message', () => {
        console.log("hide offer");
        const offerElement = this.shadowRoot!.querySelector('.offer') as HTMLElement;
        if (offerElement) {
          offerElement.classList.add('hidden');
        }
      });
  
      // Update the render
      const image = this.shadowRoot!.querySelector('#liquid-qr-code') as HTMLImageElement;
      if (image) {
        console.log(image);
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
  
      const toggleButton = this.shadowRoot!.querySelector('#toggle') as HTMLButtonElement;
      if (toggleButton) {
        toggleButton.classList.add('hidden');
      }
    } else {
      console.error('QR link element not found');
    }
  }

  async handleSignChallenge() {
    console.log('Not implemented');
  }

  // /**
  // * Sign the challenge and send the offer to the remote client
  // *
  // * This is mainly for extension wallets or other browser-based wallets, they must sign the challenge
  // * before they can peer with the remote client.
  // */
  // async handleSignChallenge() {
  //   // Sign in to the service with a new credential
  //   await this.client.attestation(async (challenge: Uint8Array) => ({
  //       requestId: parseFloat(this.altRequestId),
  //       origin: window.origin,
  //       type: 'algorand',
  //       address: testAccount.addr,
  //       signature: toBase64URL(nacl.sign.detached(challenge, testAccount.sk)),
  //       device: 'Demo Web Wallet'
  //   }))
  //   // TODO: sign in with an existing credential
  //   //await client.assertion()

  //   document.querySelector('.answer')!.classList.add('hidden')

  //   // Create the Peer Connection and await the remote client's answer
  //   this.client.peer(this.altRequestId, 'answer', this.RTC_CONFIGURATION).then(this.handleDataChannel)
  // }
 // UI Functions
 toggle() {
    const offerElement = this.shadowRoot!.querySelector('.offer');
    const answerElement = this.shadowRoot!.querySelector('.answer');

    if (offerElement && answerElement) {
      offerElement.classList.toggle('hidden');
      answerElement.classList.toggle('hidden');
    } else {
      console.error('Offer or answer element not found');
    }
  }
  handleAlternativeRequestId() {
    this.altRequestId = document.querySelector('input')!.value
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

