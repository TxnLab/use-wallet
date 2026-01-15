<script lang="ts">
  import {
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    GoogleAuthProvider
  } from 'firebase/auth'
  import { auth } from '$lib/firebase'

  interface Props {
    onSignInSuccess?: () => void
  }

  const { onSignInSuccess }: Props = $props()

  type AuthMode = 'signin' | 'signup'

  let mode = $state<AuthMode>('signin')
  let email = $state('')
  let password = $state('')
  let error = $state<string | null>(null)
  let isLoading = $state(false)

  async function handleGoogleSignIn() {
    if (!auth) return
    isLoading = true
    error = null
    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
      onSignInSuccess?.()
    } catch (err: any) {
      error = err.message || 'Google sign-in failed'
    } finally {
      isLoading = false
    }
  }

  async function handleEmailAuth(e: Event) {
    e.preventDefault()
    if (!auth) return
    if (!email || !password) {
      error = 'Email and password are required'
      return
    }

    isLoading = true
    error = null

    try {
      if (mode === 'signin') {
        await signInWithEmailAndPassword(auth, email, password)
      } else {
        await createUserWithEmailAndPassword(auth, email, password)
      }
      onSignInSuccess?.()
    } catch (err: any) {
      // Provide user-friendly error messages
      switch (err.code) {
        case 'auth/user-not-found':
          error = 'No account found with this email. Try creating an account.'
          break
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          error = 'Incorrect password. Please try again.'
          break
        case 'auth/email-already-in-use':
          error = 'An account with this email already exists. Try signing in.'
          break
        case 'auth/weak-password':
          error = 'Password is too weak. Use at least 6 characters.'
          break
        case 'auth/invalid-email':
          error = 'Invalid email address.'
          break
        default:
          error = err.message || 'Authentication failed'
      }
    } finally {
      isLoading = false
    }
  }

  function setMode(newMode: AuthMode) {
    mode = newMode
    error = null
  }
</script>

{#if !auth}
  <div>Firebase not configured</div>
{:else}
  <div class="firebase-auth-container">
    <div class="auth-tabs">
      <button
        type="button"
        class:active={mode === 'signin'}
        onclick={() => setMode('signin')}
      >
        Sign In
      </button>
      <button
        type="button"
        class:active={mode === 'signup'}
        onclick={() => setMode('signup')}
      >
        Create Account
      </button>
    </div>

    <form onsubmit={handleEmailAuth} class="auth-form">
      <input
        type="email"
        bind:value={email}
        placeholder="Email"
        disabled={isLoading}
      />
      <input
        type="password"
        bind:value={password}
        placeholder="Password"
        disabled={isLoading}
      />
      <button type="submit" disabled={isLoading || !email || !password}>
        {isLoading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
      </button>
    </form>

    <div class="auth-divider">
      <span>or</span>
    </div>

    <button
      type="button"
      onclick={handleGoogleSignIn}
      disabled={isLoading}
      class="google-signin-btn"
    >
      Sign in with Google
    </button>

    {#if error}
      <div class="auth-error">{error}</div>
    {/if}
  </div>
{/if}
