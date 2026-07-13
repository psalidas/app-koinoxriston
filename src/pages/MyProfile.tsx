import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Save, X } from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Card, PageHeader, Field, TextField, Button, Toggle } from '@/components/forms'
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
  const { profile } = useAuth()
  const { apartments } = useAppData()
  const identifier = profile?.email ?? ''

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

      <Card>
        <p className="mb-4 text-xs text-gray-500">
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
    </div>
  )
}
