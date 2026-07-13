import { doc, getDoc, setDoc } from 'firebase/firestore'
import { requireDb, clean } from '../db'
import type { InviteSettings } from '@/types'

export const DEFAULT_INVITE_SETTINGS: InviteSettings = {
  enabled: true,
  appUrl: 'https://app-koinoxriston.web.app',
  fromEmail: '',
  fromName: 'Διαχείριση Πολυκατοικίας',
  smsSender: 'Diaxeirisi',
}

export async function getInviteSettings(): Promise<InviteSettings> {
  const snap = await getDoc(doc(requireDb(), 'settings', 'invites'))
  return { ...DEFAULT_INVITE_SETTINGS, ...(snap.exists() ? (snap.data() as Partial<InviteSettings>) : {}) }
}

export async function saveInviteSettings(s: InviteSettings): Promise<void> {
  await setDoc(doc(requireDb(), 'settings', 'invites'), clean(s as unknown as Record<string, unknown>), {
    merge: true,
  })
}
