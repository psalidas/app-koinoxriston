import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getAuth, type Auth } from 'firebase/auth'
import { getStorage, type FirebaseStorage } from 'firebase/storage'
import { getFunctions, type Functions } from 'firebase/functions'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId,
)

let app: FirebaseApp | null = null
let dbInstance: Firestore | null = null
let authInstance: Auth | null = null
let storageInstance: FirebaseStorage | null = null
let functionsInstance: Functions | null = null

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig)
  dbInstance = getFirestore(app)
  authInstance = getAuth(app)
  storageInstance = getStorage(app)
  // Region πρέπει να ταιριάζει με τα Cloud Functions (setGlobalOptions).
  functionsInstance = getFunctions(app, 'europe-west1')
}

export {
  app,
  dbInstance as db,
  authInstance as auth,
  storageInstance as storage,
  functionsInstance as functions,
}
