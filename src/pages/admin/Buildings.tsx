import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Building2, ExternalLink, Check, X } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useAppData } from '@/lib/appData'
import { Button, Card, PageHeader, Field, TextField, Badge } from '@/components/forms'
import { Modal } from '@/components/Modal'
import type { Building } from '@/types'
import {
  listBuildings,
  createBuilding,
  uniqueSlug,
  updateBuilding,
} from '@/lib/repos/buildings'
import { saveMember } from '@/lib/repos/members'
import { addUserToBuilding } from '@/lib/repos/users'
import { seedDemoBuilding } from '@/lib/seedDemo'
import { DEFAULT_SCALES } from '@/data/seed'
import { normalizeIdentifier } from '@/lib/format'
import { logAudit } from '@/lib/audit'

const blank = () => ({
  name: '',
  address: '',
  area: '',
  code: '',
  managerEmail: '',
  seed: true,
})

export default function Buildings() {
  const { superadmin, authIdentifier, profile } = useAuth()
  const { buildings: myBuildings, refresh, setBuildingId } = useAppData()
  const navigate = useNavigate()
  const [all, setAll] = useState<Building[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      setAll(superadmin ? await listBuildings() : myBuildings)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [superadmin, myBuildings])

  const rows = useMemo(
    () => [...all].sort((a, b) => a.name.localeCompare(b.name, 'el')),
    [all],
  )

  async function create() {
    if (!form.name.trim()) return
    setBusy(true)
    setMsg(null)
    try {
      const managerId = superadmin
        ? normalizeIdentifier(form.managerEmail) || (authIdentifier ?? '')
        : authIdentifier ?? ''
      const slug = await uniqueSlug(form.name || form.address)
      const id = await createBuilding({
        code: form.code.trim(),
        slug,
        name: form.name.trim(),
        address: form.address.trim(),
        area: form.area.trim(),
        managerName: profile?.name ?? '',
        managerIds: managerId ? [managerId] : [],
        active: true,
        scales: DEFAULT_SCALES,
        billingFeePerApartment: 0,
        heatingClosedPercent: 100,
      })
      if (managerId) {
        await saveMember(id, managerId, {
          name: superadmin ? '' : profile?.name ?? '',
          role: 'manager',
          apartmentIds: [],
          active: true,
        })
        await addUserToBuilding(managerId, id, { role: 'manager' })
      }
      if (form.seed) {
        await seedDemoBuilding(id, DEFAULT_SCALES.map((s) => s.key))
      }
      await logAudit({
        buildingId: id,
        userEmail: authIdentifier ?? '',
        userName: profile?.name ?? authIdentifier ?? '',
        action: 'create',
        entity: 'building',
        entityId: slug,
      })
      setOpen(false)
      setForm(blank())
      await refresh()
      setBuildingId(id)
      navigate(`/b/${slug}`)
    } catch (e) {
      setMsg('Σφάλμα: ' + ((e as Error).message || 'άγνωστο'))
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(b: Building) {
    await updateBuilding(b.id, { active: !(b.active !== false) })
    await load()
  }

  return (
    <div>
      <PageHeader
        title="Κτίρια"
        subtitle={superadmin ? 'Όλα τα κτίρια της πλατφόρμας' : 'Τα κτίρια που διαχειρίζεστε'}
        actions={
          <Button onClick={() => { setForm(blank()); setMsg(null); setOpen(true) }}>
            <Plus size={18} /> Νέο κτίριο
          </Button>
        }
      />

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase text-gray-500">
              <th className="px-3 py-2">Κτίριο</th>
              <th className="px-3 py-2">URL</th>
              {superadmin && <th className="px-3 py-2">Διαχειριστές</th>}
              <th className="px-3 py-2">Κατάσταση</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">Φόρτωση…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">Κανένα κτίριο ακόμη.</td></tr>
            ) : (
              rows.map((b) => (
                <tr key={b.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2 font-medium text-gray-900">
                      <Building2 size={16} className="text-gray-400" /> {b.name}
                    </div>
                    <div className="text-xs text-gray-400">{b.address}{b.area ? `, ${b.area}` : ''}</div>
                  </td>
                  <td className="px-3 py-2">
                    {b.slug ? <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">/b/{b.slug}</code> : <span className="text-gray-300">—</span>}
                  </td>
                  {superadmin && (
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {(b.managerIds ?? []).join(', ') || <span className="text-gray-300">—</span>}
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <Badge color={b.active !== false ? 'green' : 'gray'}>
                      {b.active !== false ? 'Ενεργό' : 'Ανενεργό'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => { setBuildingId(b.id); navigate(b.slug ? `/b/${b.slug}` : '/') }}
                        className="inline-flex items-center gap-1 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                        title="Άνοιγμα"
                      >
                        <ExternalLink size={16} />
                      </button>
                      {superadmin && (
                        <button
                          onClick={() => toggleActive(b)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100"
                          title={b.active !== false ? 'Απενεργοποίηση' : 'Ενεργοποίηση'}
                        >
                          {b.active !== false ? <X size={16} /> : <Check size={16} />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Νέο κτίριο"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Ακύρωση</Button>
            <Button onClick={create} disabled={busy || !form.name.trim()}>
              {busy ? 'Δημιουργία…' : 'Δημιουργία'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {msg && <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{msg}</div>}
          <Field label="Όνομα πολυκατοικίας">
            <TextField value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="π.χ. Πολυκατοικία Ελ. Βενιζέλου 5" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Διεύθυνση">
              <TextField value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <Field label="Περιοχή">
              <TextField value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
            </Field>
          </div>
          <Field label="Κωδικός (προαιρετικό)">
            <TextField value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </Field>
          {superadmin && (
            <Field label="Διαχειριστής (email ή κινητό)" hint="Θα οριστεί ως διαχειριστής του κτιρίου· αν δεν υπάρχει, θα λάβει πρόσκληση. Κενό = εσείς.">
              <TextField value={form.managerEmail} onChange={(e) => setForm({ ...form, managerEmail: e.target.value })} placeholder="π.χ. manager@example.gr" />
            </Field>
          )}
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.seed} onChange={(e) => setForm({ ...form, seed: e.target.checked })} />
            Προσθήκη ενδεικτικών (demo) δεδομένων για επίδειξη
          </label>
          <p className="text-xs text-gray-400">
            Το URL θα δημιουργηθεί αυτόματα (π.χ. /b/venizelou-5). Οι πίνακες χιλιοστών προστίθενται προεπιλεγμένοι και μπορείτε να τους αλλάξετε.
          </p>
        </div>
      </Modal>
    </div>
  )
}
