import * as React from 'react'
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

export function FirebaseAuth({ onSignInSuccess }: FirebaseAuthProps) {
  const [mode, setMode] = React.useState<AuthMode>('signin')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)

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
      onSignInSuccess?.()
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!auth) return
    if (!email || !password) {
      setError('Email and password are required')
      return
    }

    setIsLoading(true)
    setError(null)

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
    <div className="firebase-auth-container">
      <div className="auth-tabs">
        <button
          type="button"
          className={mode === 'signin' ? 'active' : ''}
          onClick={() => {
            setMode('signin')
            setError(null)
          }}
        >
          Sign In
        </button>
        <button
          type="button"
          className={mode === 'signup' ? 'active' : ''}
          onClick={() => {
            setMode('signup')
            setError(null)
          }}
        >
          Create Account
        </button>
      </div>

      <form onSubmit={handleEmailAuth} className="auth-form">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          disabled={isLoading}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !email || !password}>
          {isLoading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
        </button>
      </form>

      <div className="auth-divider">
        <span>or</span>
      </div>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className="google-signin-btn"
      >
        Sign in with Google
      </button>

      {error && <div className="auth-error">{error}</div>}
    </div>
  )
}
