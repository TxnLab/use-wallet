import type { PasskeyConfirmation, PasskeyLockReason } from '@txnlab/use-wallet-passkey'
import { useSyncExternalStore } from 'react'

/**
 * The user's passkey preferences. The adapter reads them on every request, so
 * a change applies to the next signature without rebuilding the manager.
 */
export interface PasskeySettings {
  /** How to confirm a signature while the session is unlocked */
  confirmation: PasskeyConfirmation
  /** Lock this long after the session unlocks; 0 never locks it */
  autoLockMs: number
  /** Lock when the user leaves the tab */
  lockWhenHidden: boolean
}

export interface PasskeySession {
  unlocked: boolean
  /** Why the session last locked */
  lastLock: PasskeyLockReason | null
}

const STORAGE_KEY = 'use-wallet-example:passkey-settings'

const DEFAULT_SETTINGS: PasskeySettings = {
  confirmation: 'presence',
  autoLockMs: 15 * 60 * 1000,
  lockWhenHidden: false
}

function loadSettings(): PasskeySettings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }
  } catch {
    return DEFAULT_SETTINGS
  }
}

let settings = loadSettings()
let session: PasskeySession = { unlocked: false, lastLock: null }
let lockSession: (() => void) | null = null
let autoLock: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function scheduleAutoLock() {
  clearTimeout(autoLock)
  if (session.unlocked && lockSession && settings.autoLockMs) {
    autoLock = setTimeout(lockSession, settings.autoLockMs)
  }
}

export function getPasskeySettings(): PasskeySettings {
  return settings
}

export function updatePasskeySettings(update: Partial<PasskeySettings>) {
  settings = { ...settings, ...update }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Settings still apply for this page
  }
  // A new auto-lock delay counts from now
  if ('autoLockMs' in update) scheduleAutoLock()
  emit()
}

/** For the adapter's `onUnlock`: `lock` locks the session when auto-lock is due */
export function passkeyUnlocked(lock: () => void) {
  lockSession = lock
  session = { unlocked: true, lastLock: null }
  scheduleAutoLock()
  emit()
}

/** For the adapter's `onLock` */
export function passkeyLocked(reason: PasskeyLockReason) {
  clearTimeout(autoLock)
  session = { unlocked: false, lastLock: reason }
  emit()
}

export function usePasskeySession(): PasskeySession {
  return useSyncExternalStore(subscribe, () => session)
}

export function usePasskeySettings(): PasskeySettings {
  return useSyncExternalStore(subscribe, () => settings)
}
