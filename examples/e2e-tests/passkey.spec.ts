import { test, expect, type CDPSession, type Page } from '@playwright/test'
import { fakeTxnResponses } from './FakeAlgodResponses'

// The Falcon-1024 address is 58 characters, like any Algorand address
const ADDRESS_PATTERN = /^[A-Z2-7]{58}$/

interface VirtualAuthenticator {
  client: CDPSession
  /** Assertions the authenticator has signed (PRF ceremonies and consent prompts) */
  assertions: () => number
}

/**
 * Chromium's DevTools virtual authenticator with the PRF extension: a real
 * WebAuthn implementation, with user presence and verification simulated.
 */
async function addVirtualAuthenticator(page: Page): Promise<VirtualAuthenticator> {
  const client = await page.context().newCDPSession(page)
  await client.send('WebAuthn.enable')
  await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      ctap2Version: 'ctap2_1',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      hasPrf: true,
      automaticPresenceSimulation: true
    }
  })
  let assertions = 0
  client.on('WebAuthn.credentialAsserted', () => assertions++)
  return { client, assertions: () => assertions }
}

async function activeAddress(page: Page): Promise<string> {
  const address = page.locator('label:has-text("Active Account") + div')
  await expect(address).toHaveText(ADDRESS_PATTERN)
  return (await address.textContent())!.trim()
}

test.describe('Passkey wallet', () => {
  test('create a passkey, send a Falcon-signed transaction and authenticate', async ({ page }) => {
    const authenticator = await addVirtualAuthenticator(page)
    await page.goto('/')
    await fakeTxnResponses(page)
    await page.route('*/**/v2/accounts/*', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          address: route.request().url().split('/v2/accounts/')[1].split('?')[0],
          amount: 1_000_000,
          'amount-without-pending-rewards': 1_000_000,
          'min-balance': 100_000,
          'pending-rewards': 0,
          rewards: 0,
          round: 44440857,
          status: 'Offline',
          'total-apps-opted-in': 0,
          'total-assets-opted-in': 0,
          'total-created-apps': 0,
          'total-created-assets': 0
        })
      })
    )

    const posted: Buffer[] = []
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/v2/transactions')) {
        posted.push(request.postDataBuffer() ?? Buffer.alloc(0))
      }
    })

    // Create: create() then a PRF assertion scoped to the new credential
    await page.locator('[data-create="passkey"]').click()
    await expect(page.locator('[data-disconnect="passkey"]')).toBeVisible()
    const address = await activeAddress(page)
    expect(authenticator.assertions()).toBe(1)

    // The example runs a session, so this signature only needs a consent prompt
    await page.locator('[data-send-txn]').click()
    await expect(page.getByText('Transaction confirmed')).toBeVisible()
    expect(authenticator.assertions()).toBe(2)
    expect(posted).toHaveLength(1)
    expect(posted[0].length).toBeGreaterThan(3000)
    expect(posted[0].includes(Buffer.from('pqsig'))).toBe(true)

    // ARC-60: the example verifies the Falcon signature against the account
    await page.locator('[data-auth]').click()
    await expect(page.getByText('Authentication successful')).toBeVisible()

    expect(await activeAddress(page)).toBe(address)
  })

  test('the same passkey signs in to the same account', async ({ page }) => {
    await addVirtualAuthenticator(page)
    await page.goto('/')

    await page.locator('[data-create="passkey"]').click()
    const address = await activeAddress(page)

    await page.locator('[data-disconnect="passkey"]').click()
    await expect(page.locator('[data-connect="passkey"]')).toBeVisible()

    await page.locator('[data-connect="passkey"]').click()
    await expect(page.locator('[data-disconnect="passkey"]')).toBeVisible()
    expect(await activeAddress(page)).toBe(address)
  })

  test('a reloaded page resumes the account and unlocks with a PRF ceremony', async ({ page }) => {
    const authenticator = await addVirtualAuthenticator(page)
    await page.goto('/')
    await fakeTxnResponses(page)

    await page.locator('[data-create="passkey"]').click()
    const address = await activeAddress(page)

    await page.reload()
    await fakeTxnResponses(page)
    await expect(page.locator('[data-disconnect="passkey"]')).toBeVisible()
    expect(await activeAddress(page)).toBe(address)

    // The session was dropped with the page; the first signature unlocks it
    const before = authenticator.assertions()
    await page.locator('[data-send-txn]').click()
    await expect(page.getByText('Transaction confirmed')).toBeVisible()
    expect(authenticator.assertions()).toBe(before + 1)
  })
})
