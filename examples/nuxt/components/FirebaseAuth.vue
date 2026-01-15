<script setup lang="ts">
import { ref } from 'vue'
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider
} from 'firebase/auth'
import { auth } from '~/firebase'

interface Props {
  onSignInSuccess?: () => void
}

const props = defineProps<Props>()

type AuthMode = 'signin' | 'signup'

const mode = ref<AuthMode>('signin')
const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const isLoading = ref(false)

const handleGoogleSignIn = async () => {
  if (!auth) return
  isLoading.value = true
  error.value = null
  try {
    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)
    props.onSignInSuccess?.()
  } catch (err: any) {
    error.value = err.message || 'Google sign-in failed'
  } finally {
    isLoading.value = false
  }
}

const handleEmailAuth = async () => {
  if (!auth) return
  if (!email.value || !password.value) {
    error.value = 'Email and password are required'
    return
  }

  isLoading.value = true
  error.value = null

  try {
    if (mode.value === 'signin') {
      await signInWithEmailAndPassword(auth, email.value, password.value)
    } else {
      await createUserWithEmailAndPassword(auth, email.value, password.value)
    }
    props.onSignInSuccess?.()
  } catch (err: any) {
    // Provide user-friendly error messages
    switch (err.code) {
      case 'auth/user-not-found':
        error.value = 'No account found with this email. Try creating an account.'
        break
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        error.value = 'Incorrect password. Please try again.'
        break
      case 'auth/email-already-in-use':
        error.value = 'An account with this email already exists. Try signing in.'
        break
      case 'auth/weak-password':
        error.value = 'Password is too weak. Use at least 6 characters.'
        break
      case 'auth/invalid-email':
        error.value = 'Invalid email address.'
        break
      default:
        error.value = err.message || 'Authentication failed'
    }
  } finally {
    isLoading.value = false
  }
}

const setMode = (newMode: AuthMode) => {
  mode.value = newMode
  error.value = null
}
</script>

<template>
  <div v-if="!auth">Firebase not configured</div>
  <div v-else class="firebase-auth-container">
    <div class="auth-tabs">
      <button
        type="button"
        :class="{ active: mode === 'signin' }"
        @click="setMode('signin')"
      >
        Sign In
      </button>
      <button
        type="button"
        :class="{ active: mode === 'signup' }"
        @click="setMode('signup')"
      >
        Create Account
      </button>
    </div>

    <form @submit.prevent="handleEmailAuth" class="auth-form">
      <input
        type="email"
        v-model="email"
        placeholder="Email"
        :disabled="isLoading"
      />
      <input
        type="password"
        v-model="password"
        placeholder="Password"
        :disabled="isLoading"
      />
      <button type="submit" :disabled="isLoading || !email || !password">
        {{ isLoading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Create Account' }}
      </button>
    </form>

    <div class="auth-divider"><span>or</span></div>

    <button
      type="button"
      @click="handleGoogleSignIn"
      :disabled="isLoading"
      class="google-signin-btn"
    >
      Sign in with Google
    </button>

    <div v-if="error" class="auth-error">{{ error }}</div>
  </div>
</template>

<style scoped>
.firebase-auth-container {
  display: flex;
  flex-direction: column;
  gap: 1em;
  padding: 1em;
  max-width: 300px;
  margin: 0 auto;
}

.auth-tabs {
  display: flex;
  gap: 0.5em;
}

.auth-tabs button {
  flex: 1;
}

.auth-tabs button.active {
  border-color: #00dc82;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 0.75em;
}

.auth-divider {
  display: flex;
  align-items: center;
  gap: 1em;
  color: rgba(255, 255, 255, 0.5);
}

.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.2);
}

.auth-error {
  padding: 0.5em;
  color: #ff6b6b;
  background: rgba(255, 107, 107, 0.1);
  border-radius: 4px;
  font-size: 0.9em;
}

button {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0.6em 1.2em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  color: white;
  background-color: #1a1a1a;
  cursor: pointer;
  transition: border-color 0.25s;
}

button:not(:disabled):hover {
  border-color: #00dc82;
}

button:focus,
button:focus-visible {
  outline: 4px auto -webkit-focus-ring-color;
}

button:disabled {
  opacity: 0.75;
  cursor: default;
  color: #999;
}

input[type='email'],
input[type='password'] {
  border-radius: 8px;
  border: 1px solid #1a1a1a;
  padding: 0.6em 0.9em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  background-color: #1a1a1a;
  color: #ffffff;
  transition: border-color 0.25s;
}

@media (prefers-color-scheme: light) {
  .auth-divider {
    color: rgba(0, 0, 0, 0.5);
  }

  .auth-divider::before,
  .auth-divider::after {
    background: rgba(0, 0, 0, 0.2);
  }

  button {
    background-color: #f9f9f9;
    border-color: #cacaca;
    color: #1a1a1a;
  }

  button:disabled {
    border-color: #dddddd;
  }

  input[type='email'],
  input[type='password'] {
    background-color: #f9f9f9;
    color: #000000;
    border-color: #cacaca;
  }
}
</style>
