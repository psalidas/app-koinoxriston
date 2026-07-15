import { useEffect, useMemo, useState } from 'react'
import { Save, Download, RotateCcw } from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Button, Card, PageHeader, Badge } from '@/components/forms'
import { mille } from '@/lib/format'
import { updateMillesimes } from '@/lib/repos/apartments'
import { listUsers } from '@/lib/repos/users'
import { exportMillesimes } from '@/lib/exports'
import { logAudit } from '@/lib/audit'
import type { Role, UserDoc } from '@/types'

const ROLE_SHORT: Record<Role, string> = {
  admin: 'Διαχειριστής',
  manager: 'Διαχειριστής',
  owner: 'Ιδιοκτήτης',
  resident: 'Ένοικος',
}

const ROLE_BADGE: Record<Role, 'blue' | 'green' | 'amber' | 'gray'> = {
  admin: 'blue',
  manager: 'blue',
  owner: 'green',
  resident: 'amber',
}

export default function Millesimes() {
  const { building, apartments, refresh } = useAppData()
  const { isManager, user, profile } = useAuth()
  const scales = building?.scales ?? []
  const [draft, setDraft] = useState<Record<string, Record<string, number>>>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [users, setUsers] = useState<UserDoc[]>([])

  useEffect(() => {
    listUsers()
      .then(setUsers)
      .catch(() => {})
  }, [])

  // Αντιστοίχιση διαμερίσματος → χρήστες (ιδιοκτήτες/ένοικοι/διαχειριστές).
  const usersByApt = useMemo(() => {
    const m: Record<string, { name: string; role: Role }[]> = {}
    for (const u of users) {
      for (const aptId of u.apartmentIds ?? []) {
        ;(m[aptId] ??= []).push({ name: u.name || u.email, role: u.role })
      }
    }
    return m
  }, [users])

  useEffect(() => {
    const initial: Record<string, Record<string, number>> = {}
    for (const a of apartments) initial[a.id] = { ...a.millesimes }
    setDraft(initial)
    setDirty(false)
  }, [apartments])

  function setCell(aptId: string, key: string, value: number) {
    setDraft((d) => ({ ...d, [aptId]: { ...d[aptId], [key]: value } }))
    setDirty(true)
  }

  const totals = useMemo(() => {
    const t: Record<string, number> = {}
    for (const s of scales) {
      t[s.key] = apartments.reduce((sum, a) => sum + (draft[a.id]?.[s.key] ?? 0), 0)
    }
    return t
  }, [draft, apartments, scales])

  async function save() {
    if (!building) return
    setSaving(true)
    try {
      const updates = apartments.map((a) => ({ id: a.id, millesimes: draft[a.id] ?? {} }))
      await updateMillesimes(updates)
      await logAudit({
        buildingId: building.id,
        userEmail: user?.email ?? '',
        userName: profile?.name ?? user?.email ?? '',
        action: 'update',
        entity: 'millesimes',
        entityId: building.id,
        after: { totals },
      })
      await refresh()
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  function reset() {
    const initial: Record<string, Record<string, number>> = {}
    for (const a of apartments) initial[a.id] = { ...a.millesimes }
    setDraft(initial)
    setDirty(false)
  }

  return (
    <div>
      <PageHeader
        title="Πίνακας Χιλιοστών"
        subtitle="Επεξεργάσιμοι πίνακες ανά κατηγορία. Οι αλλαγές καταγράφονται στο ιστορικό."
        actions={
          <>
            <Button variant="secondary" onClick={() => exportMillesimes(apartments, scales)}>
              <Download size={18} /> Excel
            </Button>
            {isManager && dirty && (
              <>
                <Button variant="ghost" onClick={reset}>
                  <RotateCcw size={18} /> Επαναφορά
                </Button>
                <Button onClick={save} disabled={saving}>
                  <Save size={18} /> {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
                </Button>
              </>
            )}
          </>
        }
      />

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-xs uppercase text-gray-500">
              <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left">Διαμ.</th>
              <th className="px-3 py-2 text-left">Ιδιοκτήτης</th>
              <th className="px-3 py-2 text-left">Χρήστες (αντιστοίχιση)</th>
              {scales.map((s) => (
                <th key={s.key} className="px-3 py-2 text-right">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {apartments.map((a) => (
              <tr key={a.id} className="border-t border-gray-100">
                <td className="sticky left-0 z-10 bg-white px-3 py-1.5 font-medium text-gray-900">
                  {a.code}
                </td>
                <td className="px-3 py-1.5 text-gray-600">{a.ownerName}</td>
                <td className="px-3 py-1.5">
                  {(usersByApt[a.id] ?? []).length === 0 ? (
                    <span className="text-xs text-gray-300">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {(usersByApt[a.id] ?? []).map((u, i) => (
                        <span key={i} className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-gray-700">
                          {u.name}
                          <Badge color={ROLE_BADGE[u.role]}>{ROLE_SHORT[u.role]}</Badge>
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                {scales.map((s) => (
                  <td key={s.key} className="px-2 py-1 text-right">
                    <input
                      type="number"
                      step="0.1"
                      disabled={!isManager}
                      value={draft[a.id]?.[s.key] ?? 0}
                      onChange={(e) => setCell(a.id, s.key, Number(e.target.value))}
                      className="tnum w-20 rounded border border-transparent px-1 py-0.5 text-right hover:border-gray-200 focus:border-blue-400 focus:outline-none disabled:bg-transparent"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
              <td className="sticky left-0 z-10 bg-gray-50 px-3 py-2">ΣΥΝΟΛΟ</td>
              <td></td>
              <td></td>
              {scales.map((s) => (
                <td key={s.key} className="tnum px-3 py-2 text-right">
                  {mille(totals[s.key])}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </Card>
    </div>
  )
}
