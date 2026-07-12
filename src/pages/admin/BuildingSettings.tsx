import { useEffect, useState } from 'react'
import { Plus, Trash2, Save } from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Button, Card, PageHeader, Field, TextField, NumberField } from '@/components/forms'
import type { Building, MillesimeScale } from '@/types'
import { saveBuilding } from '@/lib/repos/buildings'
import { logAudit } from '@/lib/audit'

function slug(label: string): string {
  const base = label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
  return base || 'scale'
}

export default function BuildingSettings() {
  const { building, refresh } = useAppData()
  const { user, profile } = useAuth()
  const [form, setForm] = useState<Building | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (building) setForm({ ...building })
  }, [building])

  if (!form) return <div className="text-gray-500">Δεν υπάρχει πολυκατοικία.</div>

  function set<K extends keyof Building>(key: K, value: Building[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f))
  }

  function updateScale(i: number, label: string) {
    setForm((f) => {
      if (!f) return f
      const scales = [...f.scales]
      scales[i] = { ...scales[i], label }
      return { ...f, scales }
    })
  }

  function addScale() {
    setForm((f) => {
      if (!f) return f
      const label = 'Νέος πίνακας'
      return { ...f, scales: [...f.scales, { key: slug(label + f.scales.length), label }] }
    })
  }

  function removeScale(i: number) {
    setForm((f) => (f ? { ...f, scales: f.scales.filter((_, idx) => idx !== i) } : f))
  }

  async function save() {
    if (!form) return
    setSaving(true)
    setMsg(null)
    try {
      const { id, ...data } = form
      await saveBuilding(id, data as Omit<Building, 'id'>)
      await logAudit({
        buildingId: id,
        userEmail: user?.email ?? '',
        userName: profile?.name ?? user?.email ?? '',
        action: 'update',
        entity: 'building',
        entityId: id,
        after: { name: data.name, scales: data.scales.length },
      })
      await refresh()
      setMsg('Αποθηκεύτηκε.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Ρυθμίσεις κτιρίου"
        actions={
          <Button onClick={save} disabled={saving}>
            <Save size={18} /> {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
          </Button>
        }
      />

      {msg && <div className="mb-3 rounded-md bg-green-50 p-2 text-sm text-green-700">{msg}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold text-gray-900">Στοιχεία</h2>
          <div className="space-y-3">
            <Field label="Ονομασία">
              <TextField value={form.name} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Κωδικός">
                <TextField value={form.code} onChange={(e) => set('code', e.target.value)} />
              </Field>
              <Field label="Περιοχή">
                <TextField value={form.area} onChange={(e) => set('area', e.target.value)} />
              </Field>
            </div>
            <Field label="Διεύθυνση">
              <TextField value={form.address} onChange={(e) => set('address', e.target.value)} />
            </Field>
            <Field label="Διαχειριστής">
              <TextField value={form.managerName} onChange={(e) => set('managerName', e.target.value)} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="ΙΒΑΝ (προαιρετικό)">
                <TextField value={form.iban ?? ''} onChange={(e) => set('iban', e.target.value)} />
              </Field>
              <Field label="ΑΦΜ (προαιρετικό)">
                <TextField value={form.afm ?? ''} onChange={(e) => set('afm', e.target.value)} />
              </Field>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 font-semibold text-gray-900">Παράμετροι κοινοχρήστων</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Έκδοση λογ/σμών ανά διαμ. (€)" hint="Πάγιο ανά διαμέρισμα σε κάθε έκδοση.">
                <NumberField
                  step="0.01"
                  value={form.billingFeePerApartment}
                  onChange={(e) => set('billingFeePerApartment', Number(e.target.value))}
                />
              </Field>
              <Field label="Κλειστά % θέρμανσης" hint="Ποσοστό θέρμανσης που πληρώνει κλειστό διαμέρισμα.">
                <NumberField
                  value={form.heatingClosedPercent}
                  onChange={(e) => set('heatingClosedPercent', Number(e.target.value))}
                />
              </Field>
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Πίνακες χιλιοστών</h2>
              <Button variant="secondary" onClick={addScale}>
                <Plus size={16} /> Προσθήκη
              </Button>
            </div>
            <div className="space-y-2">
              {form.scales.map((s: MillesimeScale, i) => (
                <div key={s.key} className="flex items-center gap-2">
                  <TextField
                    value={s.label}
                    onChange={(e) => updateScale(i, e.target.value)}
                    className="flex-1"
                  />
                  <code className="hidden text-xs text-gray-400 sm:inline">{s.key}</code>
                  <button
                    onClick={() => removeScale(i)}
                    className="rounded p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-400">
              Οι τιμές χιλιοστών ανά διαμέρισμα επεξεργάζονται στη σελίδα «Πίνακας
              Χιλιοστών».
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
