import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User as FirebaseUser
} from 'firebase/auth'

// Re-export User type for convenience
export type User = FirebaseUser

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

// Check if Firebase is configured
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
)

let app: FirebaseApp | null = null
let auth: Auth | null = null

// Initialize Firebase only if configured
if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
}

// Export auth instance for FirebaseUI
export { auth }

/**
 * Get a fresh ID token for the current user
 * @returns Fresh ID token or null if not signed in
 */
export async function getFreshIdToken(): Promise<string | null> {
  if (!auth?.currentUser) {
    return null
  }

  // Force refresh to get a new token
  return auth.currentUser.getIdToken(true)
}

/**
 * Sign out from Firebase
 */
export async function firebaseSignOut(): Promise<void> {
  if (auth) {
    await signOut(auth)
  }
}

/**
 * Get the current Firebase user
 */
export function getCurrentUser(): User | null {
  return auth?.currentUser ?? null
}

/**
 * Subscribe to auth state changes
 */
export function onFirebaseAuthStateChanged(
  callback: (user: User | null) => void
): () => void {
  if (!auth) {
    // If Firebase not configured, call callback with null and return no-op unsubscribe
    callback(null)
    return () => {}
  }

  return onAuthStateChanged(auth, callback)
}
