import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
  type User,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import type { Role, UserDoc } from '@/types'

const BOOTSTRAP_ADMIN = 'michael@crowdpolicy.com'
const EMAIL_LINK_KEY = 'koino:emailForSignIn'

interface AuthState {
  loading: boolean
  user: User | null
  profile: UserDoc | null
  /** true if the user is allowed into the app (has a profile or is bootstrap). */
  hasAccess: boolean
  role: Role | null
  isManager: boolean
}

interface AuthContextValue extends AuthState {
  signInWithGoogle: () => Promise<void>
  sendEmailLink: (email: string) => Promise<void>
  sendPhoneOtp: (phone: string, containerId: string) => Promise<ConfirmationResult>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** The membership doc id: email when present, else the phone number. */
async function loadProfile(identifier: string | null): Promise<UserDoc | null> {
  if (!identifier || !db) return null
  const snap = await getDoc(doc(db, 'users', identifier))
  if (!snap.exists()) return null
  return { email: identifier, ...(snap.data() as Omit<UserDoc, 'email'>) }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    loading: true,
    user: null,
    profile: null,
    hasAccess: false,
    role: null,
    isManager: false,
  })

  useEffect(() => {
    if (!auth) {
      setState((s) => ({ ...s, loading: false }))
      return
    }

    // Complete a passwordless email-link sign-in if we arrived via one.
    if (isSignInWithEmailLink(auth, window.location.href)) {
      let email = window.localStorage.getItem(EMAIL_LINK_KEY)
      if (!email) {
        email = window.prompt('Επιβεβαιώστε το email σας για την είσοδο:') || ''
      }
      if (email) {
        signInWithEmailLink(auth, email, window.location.href)
          .then(() => {
            window.localStorage.removeItem(EMAIL_LINK_KEY)
            // Clean the link params from the URL.
            window.history.replaceState({}, document.title, window.location.pathname)
          })
          .catch((err) => console.error('Email-link sign-in failed', err))
      }
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({
          loading: false,
          user: null,
          profile: null,
          hasAccess: false,
          role: null,
          isManager: false,
        })
        return
      }
      const identifier = user.email ?? user.phoneNumber
      const profile = await loadProfile(identifier)
      const isBootstrap = user.email === BOOTSTRAP_ADMIN
      const role: Role | null = profile?.role ?? (isBootstrap ? 'admin' : null)
      const hasAccess = isBootstrap || (!!profile && profile.active !== false)
      const isManager =
        isBootstrap || role === 'admin' || role === 'manager'
      setState({ loading: false, user, profile, hasAccess, role, isManager })
    })
    return () => unsub()
  }, [])

  async function signInWithGoogle() {
    if (!auth) throw new Error('Firebase δεν έχει ρυθμιστεί')
    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)
  }

  async function sendEmailLink(email: string) {
    if (!auth) throw new Error('Firebase δεν έχει ρυθμιστεί')
    const actionCodeSettings = {
      url: window.location.origin,
      handleCodeInApp: true,
    }
    await sendSignInLinkToEmail(auth, email, actionCodeSettings)
    window.localStorage.setItem(EMAIL_LINK_KEY, email)
  }

  async function sendPhoneOtp(phone: string, containerId: string) {
    if (!auth) throw new Error('Firebase δεν έχει ρυθμιστεί')
    const verifier = new RecaptchaVerifier(auth, containerId, { size: 'invisible' })
    return signInWithPhoneNumber(auth, phone, verifier)
  }

  async function signOut() {
    if (!auth) return
    await fbSignOut(auth)
  }

  return (
    <AuthContext.Provider
      value={{ ...state, signInWithGoogle, sendEmailLink, sendPhoneOtp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
