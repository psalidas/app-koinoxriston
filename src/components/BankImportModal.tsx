import { useMemo, useState } from 'react'
import { Sparkles, FileText } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { Button, Badge } from '@/components/forms'
import { Modal } from '@/components/Modal'
import { money, latinize } from '@/lib/format'
import type { Apartment, Building, Payment } from '@/types'
import { analyzeBankStatement, type BankTxn } from '@/lib/ocr'
import { createPayment } from '@/lib/repos/payments'
import { paymentCodeFor } from '@/lib/paymentCode'

interface Row {
  date: string // YYYY-MM-DD
  description: string
  amount: number
  apartmentId: string
  include: boolean
  duplicate: boolean
}

function toISO(d?: string): string {
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : new Date().toISOString().slice(0, 10)
}

export function BankImportModal({
  open,
  onClose,
  building,
  apartments,
  existing,
  onImported,
}: {
  open: boolean
  onClose: () => void
  building: Building
  apartments: Apartment[]
  existing: Payment[]
  onImported: () => void
}) {
  const [analyzing, setAnalyzing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  // Προϋπολογισμένα αντιστοιχίσεις: κωδικός πληρωμής, κωδικός διαμ., επώνυμο.
  const matchData = useMemo(
    () =>
      apartments.map((a) => ({
        id: a.id,
        code: latinize(a.code),
        payCode: latinize(paymentCodeFor(a, building.code)),
        tokens: latinize(a.ownerName || '').split(/[^a-z0-9]+/).filter((t) => t.length >= 4),
      })),
    [apartments, building.code],
  )

  function matchApartment(description: string): string {
    const d = latinize(description)
    // 1) Κωδικός αιτιολογίας πληρωμής
    for (const m of matchData) if (m.payCode && d.includes(m.payCode)) return m.id
    // 2) Κωδικός διαμερίσματος (π.χ. Δ1) ως ξεχωριστή λέξη
    for (const m of matchData) {
      if (m.code && m.code.length >= 2 && new RegExp(`(^|[^a-z0-9])${m.code.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}([^a-z0-9]|$)`).test(d)) return m.id
    }
    // 3) Επώνυμο ιδιοκτήτη
    for (const m of matchData) if (m.tokens.some((t) => d.includes(t))) return m.id
    return ''
  }

  function isDuplicate(apartmentId: string, amount: number, dateISO: string): boolean {
    return existing.some((p) => {
      if (p.apartmentId !== apartmentId || Math.abs(p.amount - amount) > 0.001) return false
      const pd = p.date?.toDate?.()
      return pd ? pd.toISOString().slice(0, 10) === dateISO : false
    })
  }

  async function onFile(file: File) {
    setAnalyzing(true)
    setError(null)
    setMsg(null)
    setRows(null)
    try {
      const txns = await analyzeBankStatement(file)
      const built = txns.map((t: BankTxn): Row => {
        const amount = Number(t.amount) || 0
        const date = toISO(t.date)
        const description = t.description || ''
        const apartmentId = amount > 0 ? matchApartment(description) : ''
        const duplicate = apartmentId ? isDuplicate(apartmentId, amount, date) : false
        return { date, description, amount, apartmentId, include: amount > 0 && !!apartmentId && !duplicate, duplicate }
      })
      setRows(built)
      if (built.length === 0) setMsg('Δεν βρέθηκαν κινήσεις στο αρχείο.')
    } catch (e) {
      setError('Αποτυχία ανάλυσης: ' + ((e as Error).message || 'άγνωστο'))
    } finally {
      setAnalyzing(false)
    }
  }

  function update(i: number, patch: Partial<Row>) {
    setRows((prev) => (prev ? prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) : prev))
  }

  const toImport = (rows ?? []).filter((r) => r.include && r.apartmentId && r.amount > 0)

  async function doImport() {
    if (!building || toImport.length === 0) return
    setImporting(true)
    setError(null)
    try {
      for (const r of toImport) {
        await createPayment({
          buildingId: building.id,
          apartmentId: r.apartmentId,
          amount: r.amount,
          date: Timestamp.fromDate(new Date(r.date)),
          method: 'bank',
          note: `Extré: ${r.description}`.slice(0, 200),
        })
      }
      setMsg(`Εισήχθησαν ${toImport.length} πληρωμές.`)
      setRows(null)
      onImported()
    } catch (e) {
      setError('Σφάλμα εισαγωγής: ' + ((e as Error).message || 'άγνωστο'))
    } finally {
      setImporting(false)
    }
  }

  const aptLabel = (id: string) => {
    const a = apartments.find((x) => x.id === id)
    return a ? `${a.code}${a.ownerName ? ` — ${a.ownerName}` : ''}` : ''
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Εισαγωγή κινήσεων από extré"
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={importing}>Κλείσιμο</Button>
          {rows && (
            <Button onClick={doImport} disabled={importing || toImport.length === 0}>
              {importing ? 'Εισαγωγή…' : `Εισαγωγή (${toImport.length})`}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-3">
        {error && <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</div>}
        {msg && <div className="rounded-md bg-green-50 p-2 text-sm text-green-700">{msg}</div>}

        {!rows && (
          <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-center">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-blue-700">
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f) }}
              />
              <Sparkles size={16} />
              {analyzing ? 'Ανάλυση extré…' : 'Επιλογή αρχείου extré (PDF ή φωτογραφία)'}
            </label>
            <p className="mt-2 text-xs text-gray-500">
              Η AI διαβάζει τις κινήσεις και προτείνει αυτόματα το διαμέρισμα για κάθε είσπραξη. Ελέγξτε πριν την εισαγωγή.
            </p>
          </div>
        )}

        {rows && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{rows.length} κινήσεις — επιλεγμένες για εισαγωγή: <b>{toImport.length}</b></span>
              <button onClick={() => setRows(null)} className="text-xs text-blue-600 hover:underline">Νέο αρχείο</button>
            </div>
            <div className="max-h-[22rem] overflow-y-auto rounded-md border border-gray-200">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 text-left text-gray-500">
                  <tr>
                    <th className="px-2 py-1"></th>
                    <th className="px-2 py-1">Ημ/νία</th>
                    <th className="px-2 py-1">Περιγραφή</th>
                    <th className="px-2 py-1 text-right">Ποσό</th>
                    <th className="px-2 py-1">Διαμέρισμα</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const credit = r.amount > 0
                    return (
                      <tr key={i} className={`border-t border-gray-100 ${!credit ? 'bg-gray-50/60 text-gray-400' : ''}`}>
                        <td className="px-2 py-1">
                          <input
                            type="checkbox"
                            disabled={!credit || !r.apartmentId}
                            checked={r.include}
                            onChange={(e) => update(i, { include: e.target.checked })}
                          />
                        </td>
                        <td className="whitespace-nowrap px-2 py-1">{r.date}</td>
                        <td className="px-2 py-1">
                          <div className="max-w-[16rem] truncate" title={r.description}>{r.description}</div>
                          {r.duplicate && <Badge color="amber">πιθανό διπλό</Badge>}
                        </td>
                        <td className={`px-2 py-1 text-right tnum font-medium ${credit ? 'text-green-700' : 'text-gray-400'}`}>
                          {money(r.amount)}
                        </td>
                        <td className="px-2 py-1">
                          {credit ? (
                            <select
                              value={r.apartmentId}
                              onChange={(e) => update(i, { apartmentId: e.target.value, include: !!e.target.value })}
                              className="w-full rounded border border-gray-300 px-1 py-0.5 text-xs"
                            >
                              <option value="">— (παράλειψη)</option>
                              {apartments.map((a) => (
                                <option key={a.id} value={a.id}>{aptLabel(a.id)}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-gray-400">χρέωση</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-gray-400">
              <FileText size={13} /> Οι εισπράξεις γίνονται πληρωμές με τρόπο «Τραπεζική κατάθεση». Οι χρεώσεις αγνοούνται.
            </p>
          </>
        )}
      </div>
    </Modal>
  )
}
