---
description: Guide for end-to-end testing
---

# 🎯 End-to-End Testing

End-to-end (E2E) testing consists of creating and running automated tests that simulate the user going through various usage scenarios of the software from start (one end) to finish (the other end) \[source][^1]. E2E testing is also known as "system testing" because the tests are intended to test the system (software) as a whole \[source][^2]. It does not replace unit testing, integration testing or manual testing. Instead, E2E testing should complement other types of testing.

In web development, an E2E test framework controls a web browser to test the web application. [Selenium WebDriver](https://www.selenium.dev/documentation/webdriver/), [Playwright](https://playwright.dev/) and [Cypress](https://www.cypress.io/) are common E2E test frameworks for web development. The best way of using an E2E test framework depends on the software requirements, code structure, and what other development tools are used.

## Wallet for E2E Testing

Most wallet applications, such as [Defly](../fundamentals/supported-wallets.md#defly) or [Pera](../fundamentals/supported-wallets.md#pera), do not allow for automated testing of decentralized apps (dApps) because they designed to require interaction from the human user. Requiring interaction from the human user is a critical part of the security of those wallet applications provide for users. However, this security is not needed for testing.

Fortunately, the [Mnemonic wallet provider](../fundamentals/supported-wallets.md#mnemonic) solves this problem, but at a heavy cost to the security of the accounts used. The Mnemonic wallet provider allows for an account's mnemonic ("seed phrase") to be entered directly. To automate the interaction with the Mnemonic wallet, a mnemonic **used only for testing** is often placed within the test _in plain text_.

### Setting Up Mnemonic Wallet

{% hint style="danger" %}
**Warning:** The Mnemonic wallet provider is strictly for testing and development purposes. It will not function if the active network is set to MainNet. Any accounts used with the Mnemonic wallet should be considered insecure and should never hold MainNet ALGO or ASAs with any real value.
{% endhint %}

To enable the Mnemonic wallet provider, add it to the list of wallets in the use-wallet [configuration](../fundamentals/get-started/configuration.md). The configuration should look something like the following code:

```typescript
import { NetworkId, WalletId, WalletManager } from '@txnlab/use-wallet'

const walletManager = new WalletManager({
  wallets: [
    WalletId.DEFLY,
    WalletId.PERA,
    {
      id: WalletId.LUTE,
      options: { siteName: '<YOUR_SITE_NAME>' }
    },
    WalletId.MNEMONIC, // <-- Add this
  ],
  network: NetworkId.TESTNET
})
```

#### Persisting to Storage

By default for security reasons, the Mnemonic wallet provider does not save the mnemonic into local storage after it is entered and accepted. As a result, the wallet session is lost when reloading or exiting the page. The user needs to reconnect to the wallet by entering the mnemonic every time the page loads or reloads. This behavior is unlike most of the other wallet providers where the wallet session is immediately loaded and resumed when the loading the page.

The default behavior can be changed, but at an additional cost of security of the mnemonic and the account it is for. If you need the behavior of the Mnemonic wallet provider to be similar to the behavior of most of the other wallet providers in your tests, then enable persisting the mnemonic to storage. This way, **the mnemonic is stored into local storage indefinitely** and the saved wallet session can be loaded and resumed. The user enters the mnemonic once and only needs to enter it again after explicitly disconnecting from the wallet.

{% hint style="danger" %}
**Warning:** The mnemonic is stored into the local storage **in plain text**. Any mnemonic entered with persisting to storage enabled should be considered as compromised. Persisting the mnemonic to storage is strictly for testing and development purposes.
{% endhint %}

To enable persisting the mnemonic to storage, set the `persistToStorage` option for the Mnemonic wallet provider in the use-wallet [configuration](../fundamentals/get-started/configuration.md):

```typescript
import { NetworkId, WalletId, WalletManager } from '@txnlab/use-wallet'

const walletManager = new WalletManager({
  wallets: [
    WalletId.DEFLY,
    WalletId.PERA,
    {
      id: WalletId.LUTE,
      options: { siteName: '<YOUR_SITE_NAME>' }
    },
    {
      id: WalletId.MNEMONIC,
      options: { persistToStorage: true } // <-- Set this
    },
  ],
  network: NetworkId.TESTNET
})
```

## Testing with Playwright

[Playwright](https://playwright.dev/) can be used to test a web app built with any library or framework, such as React, Vue, Solid.js, or vanilla Javascript (no library or framework).

### Setting Up Playwright

To install Playwright, follow the instructions in Playwright's documentation: [https://playwright.dev/docs/intro#installing-playwright](https://playwright.dev/docs/intro#installing-playwright)

After installing Playwright, you can tweak its configuration for your project. There is an example `playwright.config.ts` file for each use-wallet example (in the [`examples/`](https://github.com/TxnLab/use-wallet/tree/main/examples) folder). For more information about how to configure Playwright, refer to its documentation: [https://playwright.dev/docs/test-configuration](https://playwright.dev/docs/test-configuration)

### Writing and Running Playwright Tests

Writing and running Playwright tests is the same for any web app, with or without use-wallet. Learn how to write and run tests in Playwright's documentation: [https://playwright.dev/docs/intro](https://playwright.dev/docs/intro).

There is an example Playwright E2E test in the [`examples/e2e-tests/` folder](https://github.com/TxnLab/use-wallet/tree/main/examples/e2e-tests). This single test can be run for any of the examples. To run the E2E test for an example, go to the chosen example folder (`vanilla-ts`, `react-ts`, etc.) and run `pnpm test`. For example, to run the E2E test for the vanilla TypeScript example, do the following:

```bash
cd examples/vanilla-ts
pnpm test:e2e
```

### Best Practices for Testing with Playwright

* For more consistent and predictable tests, mock the responses of API requests. Mocking also prevents overwhelming the API provider (like [Nodely](https://nodely.io/)) with test requests. An example of mocking responses to Algorand node (Algod) API requests is in the [`examples/e2e-tests/` folder](https://github.com/TxnLab/use-wallet/tree/main/examples/e2e-tests).
* More best practices: [https://playwright.dev/docs/best-practices](https://playwright.dev/docs/best-practices)

## References

[https://www.browserstack.com/guide/end-to-end-testing](https://www.browserstack.com/guide/end-to-end-testing)\
[https://en.wikipedia.org/wiki/System\_testing](https://en.wikipedia.org/wiki/System_testing)

[^1]: [End To End Testing: Tools, Types & Best Practices (BrowserStack)](https://www.browserstack.com/guide/end-to-end-testing)

[^2]: [System testing (Wikipedia)](https://en.wikipedia.org/wiki/System_testing)
