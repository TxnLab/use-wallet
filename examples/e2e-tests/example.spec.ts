import { test, expect } from '@playwright/test'
import { fakeTxnResponses } from './FakeAlgodResponses'

const TEST_MNEMONIC =
  // !! WARN !!
  // THIS ACCOUNT AND ITS MNEMONIC ARE COMPROMISED.
  // They are to be used for testing only.
  // !! WARN !!
  'sugar bronze century excuse animal jacket what rail biology symbol want craft annual soul increase question army win execute slim girl chief exhaust abstract wink'

const TEST_ADDRESS = '3F3FPW6ZQQYD6JDC7FKKQHNGVVUIBIZOUI5WPSJEHBRABZDRN6LOTBMFEY'

test.describe('Mnemonic wallet', () => {
  test('connect, verify active, send transaction', async ({ page }) => {
    await page.goto('/')
    await fakeTxnResponses(page)

    // Accept prompt with mnemonic
    page.on('dialog', (dialog) => dialog.accept(TEST_MNEMONIC))

    // Click Connect for Mnemonic wallet
    await page.locator('[data-connect="mnemonic"]').click()

    // Verify wallet is connected and active — disconnect button appears
    await expect(page.locator('[data-disconnect="mnemonic"]')).toBeVisible()

    // Verify active account address is displayed
    await expect(page.getByText(TEST_ADDRESS)).toBeVisible()

    // Send transaction
    await page.locator('[data-send-txn]').click()

    // Verify transaction confirmed
    await expect(page.getByText('Transaction confirmed')).toBeVisible()
  })

  test('connect and disconnect', async ({ page }) => {
    await page.goto('/')

    page.on('dialog', (dialog) => dialog.accept(TEST_MNEMONIC))

    // Connect
    await page.locator('[data-connect="mnemonic"]').click()
    await expect(page.locator('[data-disconnect="mnemonic"]')).toBeVisible()

    // Disconnect
    await page.locator('[data-disconnect="mnemonic"]').click()

    // Verify wallet returns to disconnected state
    await expect(page.locator('[data-connect="mnemonic"]')).toBeVisible()

    // Verify empty state message
    await expect(page.getByText('Connect a wallet to get started')).toBeVisible()
  })
})

test.describe('Network switching', () => {
  test('switch network and filter wallets by capabilities', async ({ page }) => {
    await page.goto('/')

    // Default network should be testnet — testnet button has active styling
    const testnetBtn = page.locator('[data-network="testnet"]')
    const mainnetBtn = page.locator('[data-network="mainnet"]')

    await expect(testnetBtn).toBeVisible()
    await expect(mainnetBtn).toBeVisible()

    // Mnemonic wallet should be visible on testnet
    await expect(page.locator('[data-connect="mnemonic"]')).toBeVisible()

    // Switch to mainnet
    await mainnetBtn.click()

    // Mnemonic wallet should disappear (excludedNetworks: ['mainnet'])
    await expect(page.locator('[data-connect="mnemonic"]')).not.toBeVisible()

    // Switch back to testnet
    await testnetBtn.click()

    // Mnemonic wallet should reappear
    await expect(page.locator('[data-connect="mnemonic"]')).toBeVisible()
  })
})

test.describe('Transaction error', () => {
  test('shows error state on failed transaction', async ({ page }) => {
    await page.goto('/')

    page.on('dialog', (dialog) => dialog.accept(TEST_MNEMONIC))

    // Connect
    await page.locator('[data-connect="mnemonic"]').click()
    await expect(page.locator('[data-disconnect="mnemonic"]')).toBeVisible()

    // Mock a transaction error — override /v2/transactions/params to return 500
    await page.route('*/**/v2/transactions/params', async (route) => {
      await route.fulfill({ status: 500, body: 'Internal Server Error' })
    })

    // Send transaction
    await page.locator('[data-send-txn]').click()

    // Verify error state
    await expect(page.getByText('Transaction failed')).toBeVisible()
  })
})
