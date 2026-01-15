import { createSignal, Show } from 'solid-js'
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider
} from 'firebase/auth'
import { auth } from './firebase'

interface FirebaseAuthProps {
  onSignInSuccess?: () => void
}

type AuthMode = 'signin' | 'signup'

export function FirebaseAuth(props: FirebaseAuthProps) {
  const [mode, setMode] = createSignal<AuthMode>('signin')
  const [email, setEmail] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [error, setError] = createSignal<string | null>(null)
  const [isLoading, setIsLoading] = createSignal(false)

  if (!auth) {
    return <div>Firebase not configured</div>
  }

  const handleGoogleSignIn = async () => {
    if (!auth) return
    setIsLoading(true)
    setError(null)
    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
      props.onSignInSuccess?.()
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmailAuth = async (e: Event) => {
    e.preventDefault()
    if (!auth) return
    if (!email() || !password()) {
      setError('Email and password are required')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      if (mode() === 'signin') {
        await signInWithEmailAndPassword(auth, email(), password())
      } else {
        await createUserWithEmailAndPassword(auth, email(), password())
      }
      props.onSignInSuccess?.()
    } catch (err: any) {
      // Provide user-friendly error messages
      switch (err.code) {
        case 'auth/user-not-found':
          setError('No account found with this email. Try creating an account.')
          break
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          setError('Incorrect password. Please try again.')
          break
        case 'auth/email-already-in-use':
          setError('An account with this email already exists. Try signing in.')
          break
        case 'auth/weak-password':
          setError('Password is too weak. Use at least 6 characters.')
          break
        case 'auth/invalid-email':
          setError('Invalid email address.')
          break
        default:
          setError(err.message || 'Authentication failed')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div class="firebase-auth-container">
      <div class="auth-tabs">
        <button
          type="button"
          class={mode() === 'signin' ? 'active' : ''}
          onClick={() => {
            setMode('signin')
            setError(null)
          }}
        >
          Sign In
        </button>
        <button
          type="button"
          class={mode() === 'signup' ? 'active' : ''}
          onClick={() => {
            setMode('signup')
            setError(null)
          }}
        >
          Create Account
        </button>
      </div>

      <form onSubmit={handleEmailAuth} class="auth-form">
        <input
          type="email"
          value={email()}
          onInput={(e) => setEmail(e.currentTarget.value)}
          placeholder="Email"
          disabled={isLoading()}
        />
        <input
          type="password"
          value={password()}
          onInput={(e) => setPassword(e.currentTarget.value)}
          placeholder="Password"
          disabled={isLoading()}
        />
        <button type="submit" disabled={isLoading() || !email() || !password()}>
          {isLoading() ? 'Loading...' : mode() === 'signin' ? 'Sign In' : 'Create Account'}
        </button>
      </form>

      <div class="auth-divider">
        <span>or</span>
      </div>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isLoading()}
        class="google-signin-btn"
      >
        Sign in with Google
      </button>

      <Show when={error()}>
        <div class="auth-error">{error()}</div>
      </Show>
    </div>
  )
}
