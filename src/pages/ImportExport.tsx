import { useState } from 'react'
import { Download, Upload, FileSpreadsheet } from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Button, Card, PageHeader } from '@/components/forms'
import { mille } from '@/lib/format'
import { exportMillesimes, parseApartmentsFile, type ImportedApartment } from '@/lib/exports'
import { createApartment, updateApartment } from '@/lib/repos/apartments'
import { logAudit } from '@/lib/audit'

export default function ImportExport() {
  const { building, apartments, refresh } = useAppData()
  const { user, profile } = useAuth()
  const scales = building?.scales ?? []
  const [preview, setPreview] = useState<ImportedApartment[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setMsg(null)
    try {
      setPreview(await parseApartmentsFile(file, scales))
    } catch (err) {
      setMsg('Σφάλμα ανάγνωσης αρχείου: ' + (err as Error).message)
    }
  }

  async function apply() {
    if (!building) return
    setBusy(true)
    let updated = 0
    let created = 0
    try {
      for (const row of preview) {
        const existing = apartments.find((a) => a.code === row.code)
        if (existing) {
          await updateApartment(existing.id, {
            ownerName: row.ownerName || existing.ownerName,
            millesimes: { ...existing.millesimes, ...row.millesimes },
          })
          updated++
        } else if (row.code) {
          await createApartment({
            buildingId: building.id,
            code: row.code,
            orderNo: row.orderNo,
            ownerName: row.ownerName,
            millesimes: row.millesimes,
          })
          created++
        }
      }
      await logAudit({
        buildingId: building.id,
        userEmail: user?.email ?? '',
        userName: profile?.name ?? user?.email ?? '',
        action: 'import',
        entity: 'apartment',
        entityId: building.id,
        context: { updated, created },
      })
      setMsg(`Ολοκληρώθηκε: ${updated} ενημερώσεις, ${created} νέα διαμερίσματα.`)
      setPreview([])
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="Εισαγωγή / Εξαγωγή" subtitle="Μαζική διαχείριση δεδομένων μέσω Excel" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-gray-900">
            <Download size={18} /> Εξαγωγή
          </h2>
          <p className="mb-3 text-sm text-gray-500">
            Κατεβάστε τον πίνακα χιλιοστών σε Excel για επεξεργασία ή αρχείο.
          </p>
          <Button variant="secondary" onClick={() => exportMillesimes(apartments, scales)}>
            <FileSpreadsheet size={18} /> Πίνακας χιλιοστών (.xlsx)
          </Button>
        </Card>

        <Card>
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-gray-900">
            <Upload size={18} /> Εισαγωγή διαμερισμάτων
          </h2>
          <p className="mb-3 text-sm text-gray-500">
            Ανεβάστε Excel με στήλες «Διαμέρισμα», «Ιδιοκτήτης» και μία στήλη ανά
            πίνακα χιλιοστών ({scales.map((s) => s.label).join(', ')}).
          </p>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={onFile}
            className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
          />
          {msg && <div className="mt-3 rounded-md bg-gray-50 p-2 text-sm text-gray-700">{msg}</div>}
        </Card>
      </div>

      {preview.length > 0 && (
        <Card className="mt-4 overflow-x-auto p-0">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h3 className="font-semibold text-gray-900">Προεπισκόπηση ({preview.length})</h3>
            <Button onClick={apply} disabled={busy}>
              {busy ? 'Εφαρμογή…' : 'Εφαρμογή αλλαγών'}
            </Button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <th className="px-3 py-2">Διαμ.</th>
                <th className="px-3 py-2">Ιδιοκτήτης</th>
                {scales.map((s) => (
                  <th key={s.key} className="px-3 py-2 text-right">
                    {s.label}
                  </th>
                ))}
                <th className="px-3 py-2">Κατάσταση</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((r, i) => {
                const exists = apartments.some((a) => a.code === r.code)
                return (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-1.5 font-medium">{r.code}</td>
                    <td className="px-3 py-1.5 text-gray-600">{r.ownerName}</td>
                    {scales.map((s) => (
                      <td key={s.key} className="px-3 py-1.5 text-right tnum">
                        {mille(r.millesimes[s.key] ?? 0)}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-xs text-gray-500">
                      {exists ? 'Ενημέρωση' : 'Νέο'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
