---
layout:
  title:
    visible: true
  description:
    visible: false
  tableOfContents:
    visible: true
  outline:
    visible: true
  pagination:
    visible: true
---

# Testing with Mnemonic Wallet

The Mnemonic wallet provider enables automated testing of dApps by allowing direct entry of account mnemonics. While this removes the security features of traditional wallets that require explicit user interaction, it provides a way to automate end-to-end testing of your application.

### Overview

Most supported wallets are designed for production use and require manual user interaction for security. The Mnemonic provider removes these security constraints, making it ideal for:

* End-to-end (E2E) testing
* CI/CD pipelines
* Test automation

{% hint style="danger" %}
The Mnemonic wallet is strictly for testing and development. For security reasons:

* It cannot be used on MainNet
* Mnemonics are stored in plaintext if persistence is enabled
* Accounts should never hold real assets
{% endhint %}

### Configuration

Add the Mnemonic provider to your WalletManager configuration:

```typescript
import { WalletManager, WalletId } from '@txnlab/use-wallet'

const manager = new WalletManager({
  wallets: [
    // Production wallets...
    WalletId.PERA,
    WalletId.DEFLY,
    
    // Test wallet
    {
      id: WalletId.MNEMONIC,
      options: {
        // Optional: persist mnemonic to localStorage
        persistToStorage: false
      }
    }
  ],
  defaultNetwork: 'testnet'
})
```

### Session Persistence

By default, the Mnemonic provider does not persist sessions to localStorage. This means:

* The mnemonic must be re-entered after page reloads
* The wallet disconnects when closing/reloading the page
* Sessions cannot be resumed automatically

To match the behavior of production wallets in tests, enable persistence:

```typescript
{
  id: WalletId.MNEMONIC,
  options: {
    persistToStorage: true
  }
}
```

{% hint style="warning" %}
When persistence is enabled:

* Mnemonics are stored in plaintext in localStorage
* Sessions persist until explicitly disconnected
* Any stored mnemonics should be considered compromised
{% endhint %}

### End-to-End Testing

The Mnemonic provider enables automated E2E testing with frameworks like [Playwright](https://playwright.dev/), [Cypress](https://www.cypress.io/), or [Selenium](https://www.selenium.dev/). It enables automated wallet connections and transaction signing without requiring manual user interaction.

#### Example Test

Here's a basic example using Playwright that demonstrates connecting to the wallet and verifying the connection:

```typescript
import { test, expect } from '@playwright/test'

test('wallet connection flow', async ({ page }) => {
  // Navigate to app
  await page.goto('/')
  
  // Mock Algod responses
  await mockAlgodResponses(page)
  
  // Handle mnemonic prompt
  page.on('dialog', (dialog) => dialog.accept(
    // !! WARNING !!
    // THIS ACCOUNT IS COMPROMISED
    // Use for testing only!
    // !! WARNING !!
    'sugar bronze century excuse animal jacket what rail biology symbol want craft annual soul increase question army win execute slim girl chief exhaust abstract wink'
  ))
  
  // Verify Mnemonic wallet is available
  await expect(page.getByRole('heading', { name: 'Mnemonic' })).toBeVisible()
  
  // Connect to wallet
  await page
    .locator('.wallet-group', {
      has: page.locator('h4', { hasText: 'Mnemonic' })
    })
    .getByRole('button', { name: 'Connect' })
    .click()
    
  // Verify connection succeeded
  await expect(page.getByRole('heading', { name: 'Mnemonic [active]' })).toBeVisible()
  
  // Verify correct account is connected
  await expect(page.getByRole('combobox')).toHaveValue(
    '3F3FPW6ZQQYD6JDC7FKKQHNGVVUIBIZOUI5WPSJEHBRABZDRN6LOTBMFEY'
  )
})
```

#### Mocking Node Responses

To create reliable and predictable tests, it's recommended to mock responses from the Algorand node. This prevents tests from failing due to network issues or rate limits, and allows testing specific scenarios:

```typescript
async function mockAlgodResponses(page: Page) {
  // Mock transaction parameters
  await page.route('**/v2/transactions/params', (route) => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        'last-round': 1000,
        'consensus-version': 'test-1.0',
        'min-fee': 1000,
        'genesis-hash': 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
        'genesis-id': 'testnet-v1.0'
      })
    })
  })

  // Mock transaction submission
  await page.route('**/v2/transactions', (route) => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({ txId: 'TEST_TX_ID' })
    })
  })
}
```

### Best Practices

When using the Mnemonic provider for testing:

* **Test Account Security**: Generate dedicated test accounts that will never be used in production. Consider these accounts compromised as their mnemonics are stored in test files.
* **Mock API Responses**: Mock responses from the Algorand node to:
  * Prevent overwhelming API providers with test requests
  * Create predictable test scenarios
  * Test error handling
  * Speed up test execution
* **Test Organization**: Structure tests to cover different wallet operations:
  * Connection/disconnection flows
  * Account switching
  * Transaction signing
  * Error handling
  * Network switching
* **CI/CD Integration**: The Mnemonic provider works well in CI/CD pipelines since it doesn't require user interaction. Consider:
  * Storing test mnemonics securely (e.g., in CI environment variables)
  * Running tests against LocalNet (sandbox) or a private network
  * Including wallet tests in your automated test suite

For complete testing examples, including mocking strategies and common test scenarios, see the [E2E test examples](https://github.com/TxnLab/use-wallet/tree/main/examples/e2e-tests) in the repository.
