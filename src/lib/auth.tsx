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
  signInWithEmailAndPassword,
  updatePassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import { requestMagicLink } from './magic'
import { normalizeIdentifier } from './format'
import type { Role, UserDoc } from '@/types'

const BOOTSTRAP_ADMIN = 'michael@crowdpolicy.com'

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
  /** Στέλνει magic link σε email ή κινητό (ενιαία είσοδος). */
  sendMagicLink: (identifier: string) => Promise<void>
  /** Κλασική είσοδος με email & κωδικό. */
  signInWithPassword: (email: string, password: string) => Promise<void>
  /** Ορισμός/αλλαγή κωδικού για τον τρέχοντα (email) λογαριασμό. */
  setPassword: (newPassword: string) => Promise<void>
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

    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
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
        // Οι magic-link συνεδρίες φέρουν custom claim `identifier` (= το id του
        // /users doc). Το προτιμούμε ώστε να βρίσκουμε πάντα το σωστό doc,
        // ειδικά για κινητό (όπου user.phoneNumber μπορεί να λείπει).
        let identifier = user.email ?? user.phoneNumber
        try {
          const claims = (await user.getIdTokenResult()).claims
          if (typeof claims.identifier === 'string' && claims.identifier) {
            identifier = claims.identifier
          }
        } catch {
          // αγνόησε — θα χρησιμοποιήσουμε email/phone
        }
        // Κανονικοποίηση ώστε το lookup να ταιριάζει πάντα με το doc id
        // (π.χ. Google email vs αποθηκευμένο id με κρυφούς χαρακτήρες).
        identifier = identifier ? normalizeIdentifier(identifier) : identifier
        // Ποτέ να μη μείνει η εφαρμογή στο «Φόρτωση…» αν αποτύχει το read.
        let profile: UserDoc | null = null
        try {
          profile = await loadProfile(identifier)
        } catch (err) {
          console.error('loadProfile failed', err)
        }
        const isBootstrap = user.email === BOOTSTRAP_ADMIN
        const role: Role | null = profile?.role ?? (isBootstrap ? 'admin' : null)
        const hasAccess = isBootstrap || (!!profile && profile.active !== false)
        const isManager =
          isBootstrap || role === 'admin' || role === 'manager'
        setState({ loading: false, user, profile, hasAccess, role, isManager })
      } catch (err) {
        console.error('auth state handler failed', err)
        setState((s) => ({ ...s, loading: false }))
      }
    })
    return () => unsub()
  }, [])

  async function signInWithGoogle() {
    if (!auth) throw new Error('Firebase δεν έχει ρυθμιστεί')
    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)
  }

  async function sendMagicLink(identifier: string) {
    await requestMagicLink(identifier.trim())
  }

  async function signInWithPassword(email: string, password: string) {
    if (!auth) throw new Error('Firebase δεν έχει ρυθμιστεί')
    await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password)
  }

  async function setPassword(newPassword: string) {
    if (!auth?.currentUser) throw new Error('Δεν είστε συνδεδεμένος')
    await updatePassword(auth.currentUser, newPassword)
  }

  async function signOut() {
    if (!auth) return
    await fbSignOut(auth)
  }

  return (
    <AuthContext.Provider
      value={{ ...state, signInWithGoogle, sendMagicLink, signInWithPassword, setPassword, signOut }}
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
