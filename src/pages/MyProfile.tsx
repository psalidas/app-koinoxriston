import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Pencil, Save, X, Building2, KeyRound } from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Card, PageHeader, Field, TextField, Button, Toggle } from '@/components/forms'
import { mille } from '@/lib/format'
import type { ContactVisibility } from '@/types'
import { getProfile, saveContact } from '@/lib/repos/directory'

type Contact = { displayName: string; phone: string; mobile: string; email: string; note: string }
const EMPTY: Contact = { displayName: '', phone: '', mobile: '', email: '', note: '' }

const FIELDS: { key: keyof Contact; visKey: keyof ContactVisibility; label: string; type?: string }[] = [
  { key: 'displayName', visKey: 'name', label: 'Όνομα που εμφανίζεται' },
  { key: 'phone', visKey: 'phone', label: 'Σταθερό τηλέφωνο' },
  { key: 'mobile', visKey: 'mobile', label: 'Κινητό' },
  { key: 'email', visKey: 'email', label: 'Email επικοινωνίας', type: 'email' },
  { key: 'note', visKey: 'note', label: 'Σημείωση (π.χ. ώρες επικοινωνίας)' },
]

export default function MyProfile() {
  const { profile, setPassword } = useAuth()
  const { building, apartments } = useAppData()
  const [params] = useSearchParams()
  const identifier = profile?.email ?? ''
  const isEmailUser = identifier.includes('@')

  // Κωδικός πρόσβασης (μόνο email λογαριασμοί)
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const wantSetPw = params.get('setpw') === '1'

  async function savePassword() {
    if (pw1.length < 8) {
      setPwMsg({ ok: false, text: 'Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.' })
      return
    }
    if (pw1 !== pw2) {
      setPwMsg({ ok: false, text: 'Οι κωδικοί δεν ταιριάζουν.' })
      return
    }
    setPwBusy(true)
    setPwMsg(null)
    try {
      await setPassword(pw1)
      setPw1('')
      setPw2('')
      setPwMsg({ ok: true, text: 'Ο κωδικός αποθηκεύτηκε. Μπορείτε πλέον να μπαίνετε και με κωδικό.' })
    } catch (e) {
      const code = (e as { code?: string })?.code ?? ''
      setPwMsg({
        ok: false,
        text: code.includes('requires-recent-login')
          ? 'Για ασφάλεια, ξανασυνδεθείτε με σύνδεσμο εισόδου και δοκιμάστε ξανά.'
          : 'Αποτυχία: ' + ((e as Error).message || 'άγνωστο σφάλμα'),
      })
    } finally {
      setPwBusy(false)
    }
  }

  // Ιδιοκτησία & χιλιοστά — μόνο για ιδιοκτήτες/ενοίκους με διαμερίσματα.
  const isOwnerOrResident = profile?.role === 'owner' || profile?.role === 'resident'
  const myApartments = useMemo(() => {
    const ids = profile?.apartmentIds ?? []
    return apartments
      .filter((a) => ids.includes(a.id))
      .sort((a, b) => a.orderNo - b.orderNo)
  }, [apartments, profile])
  const scales = building?.scales ?? []

  const [contact, setContact] = useState<Contact>(EMPTY)
  const [visibility, setVisibility] = useState<ContactVisibility>({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function load() {
    if (!identifier) return
    setLoading(true)
    try {
      const p = await getProfile(identifier)
      if (p) {
        setContact({
          displayName: p.displayName ?? '',
          phone: p.phone ?? '',
          mobile: p.mobile ?? '',
          email: p.email ?? '',
          note: p.note ?? '',
        })
        setVisibility(p.visibility ?? {})
      } else {
        setContact({ ...EMPTY, displayName: profile?.name ?? '' })
        setVisibility({})
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identifier])

  async function save() {
    if (!identifier || !profile) return
    setSaving(true)
    setMsg(null)
    try {
      const myApts = apartments.filter((a) => (profile.apartmentIds ?? []).includes(a.id))
      await saveContact(
        identifier,
        { ...contact, visibility },
        { role: profile.role, name: profile.name, apartmentCodes: myApts.map((a) => a.code) },
      )
      setEditing(false)
      setMsg('Αποθηκεύτηκε.')
    } finally {
      setSaving(false)
    }
  }

  function cancel() {
    setEditing(false)
    setMsg(null)
    void load()
  }

  if (loading) return <div className="text-gray-400">Φόρτωση…</div>

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Τα στοιχεία μου"
        subtitle="Στοιχεία επικοινωνίας & τι εμφανίζεται στον κατάλογο"
        actions={
          editing ? (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={cancel} disabled={saving}>
                <X size={16} /> Ακύρωση
              </Button>
              <Button onClick={save} disabled={saving}>
                <Save size={16} /> {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
              </Button>
            </div>
          ) : (
            <Button onClick={() => { setMsg(null); setEditing(true) }}>
              <Pencil size={16} /> Επεξεργασία
            </Button>
          )
        }
      />

      {msg && <div className="mb-3 rounded-md bg-green-50 p-2 text-sm text-green-700">{msg}</div>}

      {isOwnerOrResident && myApartments.length > 0 && (
        <Card className="mb-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Building2 size={16} /> Η ιδιοκτησία μου & χιλιοστά
          </h2>
          <div className="space-y-4">
            {myApartments.map((a) => (
              <div key={a.id}>
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="font-medium text-gray-900">
                    Διαμέρισμα {a.code}
                    {a.floor ? ` · ${a.floor}` : ''}
                  </span>
                  <span className="text-xs text-gray-500">{a.ownerName}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                  {scales.map((s) => (
                    <div key={s.key} className="flex justify-between">
                      <span className="text-gray-500">{s.label}</span>
                      <span className="tnum font-medium">{mille(a.millesimes?.[s.key] ?? 0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-1 text-sm font-semibold text-gray-700">Στοιχεία επικοινωνίας</h2>
        <p className="mb-4 mt-1 text-xs text-gray-500">
          Ο διακόπτης «Ορατό» καθορίζει αν το πεδίο εμφανίζεται στον εσωτερικό{' '}
          <Link to="/directory" className="text-blue-600 hover:underline">κατάλογο</Link>. Ο
          διαχειριστής βλέπει πάντα όλα τα στοιχεία.
        </p>

        <div className="space-y-4">
          {FIELDS.map((f) => (
            <div key={f.key} className="flex items-end gap-3">
              <div className="min-w-0 flex-1">
                <Field label={f.label}>
                  <TextField
                    type={f.type}
                    value={contact[f.key]}
                    disabled={!editing}
                    onChange={(e) => setContact({ ...contact, [f.key]: e.target.value })}
                  />
                </Field>
              </div>
              <div className="flex flex-col items-center gap-1 pb-1.5">
                <Toggle
                  checked={!!visibility[f.visKey]}
                  disabled={!editing}
                  onChange={(b) => setVisibility({ ...visibility, [f.visKey]: b })}
                  label={`Ορατό: ${f.label}`}
                />
                <span className="text-[10px] text-gray-400">
                  {visibility[f.visKey] ? 'Ορατό' : 'Κρυφό'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {isEmailUser && (
        <Card className={`mt-4 ${wantSetPw ? 'ring-2 ring-blue-400' : ''}`}>
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <KeyRound size={16} /> Κωδικός πρόσβασης
          </h2>
          <p className="mb-3 text-xs text-gray-500">
            Προαιρετικό. Αν ορίσεις κωδικό, θα μπορείς να μπαίνεις και με email + κωδικό (εκτός από
            τον σύνδεσμο εισόδου).
          </p>
          {pwMsg && (
            <div
              className={`mb-3 rounded-md p-2 text-sm ${pwMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}
            >
              {pwMsg.text}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Νέος κωδικός">
              <TextField
                type="password"
                autoFocus={wantSetPw}
                value={pw1}
                onChange={(e) => setPw1(e.target.value)}
              />
            </Field>
            <Field label="Επιβεβαίωση">
              <TextField type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </Field>
          </div>
          <div className="mt-3">
            <Button onClick={savePassword} disabled={pwBusy || !pw1 || !pw2}>
              <Save size={16} /> {pwBusy ? 'Αποθήκευση…' : 'Αποθήκευση κωδικού'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
