import { test, expect } from '@playwright/test'
import { fakeTxnResponses } from './FakeAlgodResponses'

test('it works', async ({ page }) => {
  // Load and set up the page
  await page.goto('/')
  await fakeTxnResponses(page)
  // Whenever a prompt appears, enter the mnemonic
  page.on('dialog', (dialog) =>
    dialog.accept(
      // !! WARN !!
      // THIS ACCOUNT AND ITS MNEMONIC ARE COMPROMISED.
      // They are to be used for testing only.
      // !! WARN !!
      'sugar bronze century excuse animal jacket what rail biology symbol want craft annual soul increase question army win execute slim girl chief exhaust abstract wink'
    )
  )

  // Check mnemonic wallet is activated
  await expect(page.getByRole('heading', { name: 'Mnemonic' })).toBeVisible()

  // Click the "Connect" button for the Mnemonic wallet
  await page
    .locator('.wallet-group', {
      has: page.locator('h4', { hasText: 'Mnemonic' })
    })
    .getByRole('button', { name: 'Connect', exact: true })
    .click()

  // Check wallet is connected
  await expect(page.getByRole('heading', { name: 'Mnemonic [active]' })).toBeVisible()
  await expect(page.getByRole('combobox')).toHaveValue(
    '3F3FPW6ZQQYD6JDC7FKKQHNGVVUIBIZOUI5WPSJEHBRABZDRN6LOTBMFEY'
  )

  // Click button to send a transaction
  await page.getByRole('button', { name: 'Send Transaction' }).click()

  // There is no visual feedback of the outcome of sending the transaction. Only a message is
  // printed in the console. So, we will wait a little bit for transaction to complete
  await page.waitForTimeout(500)
})
