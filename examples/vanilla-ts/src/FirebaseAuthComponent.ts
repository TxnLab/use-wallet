import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider
} from 'firebase/auth'
import { auth } from './firebase'

type AuthMode = 'signin' | 'signup'

interface FirebaseAuthComponentOptions {
  onSignInSuccess?: () => void
}

export class FirebaseAuthComponent {
  element: HTMLElement
  private mode: AuthMode = 'signin'
  private email: string = ''
  private password: string = ''
  private error: string | null = null
  private isLoading: boolean = false
  private onSignInSuccess?: () => void

  constructor(options: FirebaseAuthComponentOptions = {}) {
    this.onSignInSuccess = options.onSignInSuccess
    this.element = document.createElement('div')
    this.render()
    this.addEventListeners()
  }

  private async handleGoogleSignIn() {
    if (!auth) return
    this.isLoading = true
    this.error = null
    this.render()

    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
      this.onSignInSuccess?.()
    } catch (err: any) {
      this.error = err.message || 'Google sign-in failed'
    } finally {
      this.isLoading = false
      this.render()
    }
  }

  private async handleEmailAuth(e: Event) {
    e.preventDefault()
    if (!auth) return
    if (!this.email || !this.password) {
      this.error = 'Email and password are required'
      this.render()
      return
    }

    this.isLoading = true
    this.error = null
    this.render()

    try {
      if (this.mode === 'signin') {
        await signInWithEmailAndPassword(auth, this.email, this.password)
      } else {
        await createUserWithEmailAndPassword(auth, this.email, this.password)
      }
      this.onSignInSuccess?.()
    } catch (err: any) {
      // Provide user-friendly error messages
      switch (err.code) {
        case 'auth/user-not-found':
          this.error = 'No account found with this email. Try creating an account.'
          break
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          this.error = 'Incorrect password. Please try again.'
          break
        case 'auth/email-already-in-use':
          this.error = 'An account with this email already exists. Try signing in.'
          break
        case 'auth/weak-password':
          this.error = 'Password is too weak. Use at least 6 characters.'
          break
        case 'auth/invalid-email':
          this.error = 'Invalid email address.'
          break
        default:
          this.error = err.message || 'Authentication failed'
      }
    } finally {
      this.isLoading = false
      this.render()
    }
  }

  private setMode(newMode: AuthMode) {
    this.mode = newMode
    this.error = null
    this.render()
  }

  render() {
    if (!auth) {
      this.element.innerHTML = '<div>Firebase not configured</div>'
      return
    }

    this.element.innerHTML = `
      <div class="firebase-auth-container">
        <div class="auth-tabs">
          <button type="button" id="signin-tab" class="${this.mode === 'signin' ? 'active' : ''}">
            Sign In
          </button>
          <button type="button" id="signup-tab" class="${this.mode === 'signup' ? 'active' : ''}">
            Create Account
          </button>
        </div>

        <form id="auth-form" class="auth-form">
          <input
            type="email"
            id="auth-email"
            value="${this.email}"
            placeholder="Email"
            ${this.isLoading ? 'disabled' : ''}
          />
          <input
            type="password"
            id="auth-password"
            value="${this.password}"
            placeholder="Password"
            ${this.isLoading ? 'disabled' : ''}
          />
          <button type="submit" ${this.isLoading || !this.email || !this.password ? 'disabled' : ''}>
            ${this.isLoading ? 'Loading...' : this.mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div class="auth-divider">
          <span>or</span>
        </div>

        <button
          type="button"
          id="google-signin"
          ${this.isLoading ? 'disabled' : ''}
          class="google-signin-btn"
        >
          Sign in with Google
        </button>

        ${this.error ? `<div class="auth-error">${this.error}</div>` : ''}
      </div>
    `
  }

  private addEventListeners() {
    this.element.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement
      if (target.id === 'signin-tab') {
        this.setMode('signin')
      } else if (target.id === 'signup-tab') {
        this.setMode('signup')
      } else if (target.id === 'google-signin') {
        this.handleGoogleSignIn()
      }
    })

    this.element.addEventListener('submit', (e: Event) => {
      const target = e.target as HTMLElement
      if (target.id === 'auth-form') {
        this.handleEmailAuth(e)
      }
    })

    this.element.addEventListener('input', (e: Event) => {
      const target = e.target as HTMLInputElement
      if (target.id === 'auth-email') {
        this.email = target.value
        this.updateSubmitButton()
      } else if (target.id === 'auth-password') {
        this.password = target.value
        this.updateSubmitButton()
      }
    })
  }

  private updateSubmitButton() {
    const submitButton = this.element.querySelector(
      '#auth-form button[type="submit"]'
    ) as HTMLButtonElement
    if (submitButton) {
      submitButton.disabled = this.isLoading || !this.email || !this.password
    }
  }

  destroy() {
    // Clean up event listeners if needed
  }
}
