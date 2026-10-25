import { useMemo, useState } from 'react'
import { Sparkles, FileText } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { Button, Badge } from '@/components/forms'
import { Modal } from '@/components/Modal'
import { money, latinize } from '@/lib/format'
import type { Apartment, Building, Payment } from '@/types'
import { analyzeBankStatement, type BankTxn } from '@/lib/ocr'
import { createPayment } from '@/lib/repos/payments'
import { createExpense } from '@/lib/repos/expenses'
import { paymentCodeFor } from '@/lib/paymentCode'

// Τρόπος χειρισμού μιας χρέωσης (debit):
//  • 'deduct'  → προμήθεια μεταφοράς· αφαιρείται από την πληρωμή του καταθέτη
//               (ώστε να οφείλει το πλήρες ποσό των κοινοχρήστων).
//  • 'expense' → λοιπή τραπεζική δαπάνη· καταχωρείται ως γενικό έξοδο κτιρίου.
type FeeMode = 'deduct' | 'expense'

interface Row {
  id: number
  date: string // YYYY-MM-DD
  description: string
  amount: number
  apartmentId: string // για εισπράξεις (credit)
  category: string // για χρεώσεις-έξοδα (debit → δαπάνη)
  feeMode: FeeMode // μόνο για χρεώσεις
  deductFromId: number | null // χρέωση σε mode 'deduct': σε ποια είσπραξη αφαιρείται
  include: boolean
  duplicate: boolean
}

function toISO(d?: string): string {
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : new Date().toISOString().slice(0, 10)
}

/** Αναγνωρίζει χρεώσεις προμήθειας/εξόδων τράπεζας. */
function isFee(description: string): boolean {
  const d = latinize(description)
  return /\bcom\b|promith|proemith|eksoda|charge|\bfee\b|commission/.test(d)
}

export function BankImportModal({
  open,
  onClose,
  building,
  apartments,
  existing,
  balances,
  onImported,
}: {
  open: boolean
  onClose: () => void
  building: Building
  apartments: Apartment[]
  existing: Payment[]
  balances: Record<string, number>
  onImported: () => void
}) {
  const [analyzing, setAnalyzing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const aptById = useMemo(() => {
    const m: Record<string, Apartment> = {}
    for (const a of apartments) m[a.id] = a
    return m
  }, [apartments])

  function aptLabel(id: string): string {
    const a = aptById[id]
    if (!a) return id
    return `${a.code}${a.ownerName ? ` — ${a.ownerName}` : ''}`
  }

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

  function matchApartment(description: string, amount: number): string {
    const d = latinize(description)
    // 1) Κωδικός αιτιολογίας πληρωμής
    for (const m of matchData) if (m.payCode && d.includes(m.payCode)) return m.id
    // 2) Κωδικός διαμερίσματος (π.χ. Δ1) ως ξεχωριστή λέξη
    for (const m of matchData) {
      if (m.code && m.code.length >= 2 && new RegExp(`(^|[^a-z0-9])${m.code.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}([^a-z0-9]|$)`).test(d)) return m.id
    }
    // 3) Επώνυμο ιδιοκτήτη
    for (const m of matchData) if (m.tokens.some((t) => d.includes(t))) return m.id
    // 4) Fallback: μοναδικό διαμέρισμα με οφειλή ίση με το ποσό
    if (amount > 0) {
      const hits = apartments.filter((a) => Math.abs((balances[a.id] ?? 0) - amount) < 0.01)
      if (hits.length === 1) return hits[0].id
    }
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
      const built: Row[] = []
      let lastMatchedCreditId: number | null = null
      txns.forEach((t: BankTxn, idx: number) => {
        const amount = Number(t.amount) || 0
        const date = toISO(t.date)
        const description = t.description || ''
        if (amount > 0) {
          const apartmentId = matchApartment(description, amount)
          const duplicate = apartmentId ? isDuplicate(apartmentId, amount, date) : false
          if (apartmentId) lastMatchedCreditId = idx
          built.push({
            id: idx, date, description, amount, apartmentId,
            category: '', feeMode: 'expense', deductFromId: null,
            include: !!apartmentId && !duplicate, duplicate,
          })
          return
        }
        // Χρέωση. Προμήθεια αμέσως μετά από αντιστοιχισμένη είσπραξη →
        // αφαιρείται από εκείνη την πληρωμή (ο καταθέτης οφείλει την προμήθεια).
        const fee = isFee(description)
        if (fee && lastMatchedCreditId != null) {
          built.push({
            id: idx, date, description, amount, apartmentId: '',
            category: '', feeMode: 'deduct', deductFromId: lastMatchedCreditId,
            include: true, duplicate: false,
          })
          return
        }
        // Λοιπή τραπεζική χρέωση → γενικό έξοδο.
        built.push({
          id: idx, date, description, amount, apartmentId: '',
          category: fee ? 'Τραπεζικά έξοδα' : description.slice(0, 60),
          feeMode: 'expense', deductFromId: null,
          include: fee, duplicate: false,
        })
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

  const rr = rows ?? []

  // Υποψήφιες εισπράξεις για αφαίρεση προμήθειας (αντιστοιχισμένες σε διαμ.).
  const creditTargets = rr.filter((r) => r.amount > 0 && r.apartmentId)
  const includedCreditIds = useMemo(
    () => new Set(rr.filter((r) => r.amount > 0 && r.include && r.apartmentId).map((r) => r.id)),
    [rows],
  )

  // Σύνολο προμήθειας ανά είσπραξη (μόνο όταν η είσπραξη εισάγεται).
  const feeByCredit = useMemo(() => {
    const m: Record<number, number> = {}
    for (const r of rr) {
      if (r.amount < 0 && r.include && r.feeMode === 'deduct' && r.deductFromId != null && includedCreditIds.has(r.deductFromId)) {
        m[r.deductFromId] = (m[r.deductFromId] ?? 0) + Math.abs(r.amount)
      }
    }
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, includedCreditIds])

  const payRows = rr
    .filter((r) => r.amount > 0 && r.include && r.apartmentId)
    .map((r) => {
      const fee = feeByCredit[r.id] ?? 0
      return { row: r, fee, net: Math.max(0, Math.round((r.amount - fee) * 100) / 100) }
    })
  const expenseRows = rr.filter((r) => r.amount < 0 && r.include && r.feeMode === 'expense' && r.category.trim())
  const appliedDeducts = rr.filter(
    (r) => r.amount < 0 && r.include && r.feeMode === 'deduct' && r.deductFromId != null && includedCreditIds.has(r.deductFromId),
  ).length
  const totalToImport = payRows.length + expenseRows.length

  async function doImport() {
    if (!building || totalToImport === 0) return
    setImporting(true)
    setError(null)
    try {
      for (const p of payRows) {
        const note = (p.fee > 0
          ? `Extré: ${p.row.description} (−προμήθεια ${money(p.fee)})`
          : `Extré: ${p.row.description}`
        ).slice(0, 200)
        await createPayment({
          buildingId: building.id,
          apartmentId: p.row.apartmentId,
          amount: p.net,
          date: Timestamp.fromDate(new Date(p.row.date)),
          method: 'bank',
          note,
        })
      }
      for (const r of expenseRows) {
        await createExpense({
          buildingId: building.id,
          period: r.date.slice(0, 7),
          date: r.date,
          group: 'koinoxrista',
          category: r.category.trim(),
          amount: Math.abs(r.amount),
          method: 'millesime',
          scaleKey: 'genika',
          note: `Extré: ${r.description}`.slice(0, 200),
        })
      }
      const parts: string[] = []
      if (payRows.length) parts.push(`${payRows.length} πληρωμές`)
      if (appliedDeducts) parts.push(`${appliedDeducts} προμήθειες αφαιρέθηκαν`)
      if (expenseRows.length) parts.push(`${expenseRows.length} δαπάνες`)
      setMsg(`Εισήχθησαν: ${parts.join(' · ')}.`)
      setRows(null)
      onImported()
    } catch (e) {
      setError('Σφάλμα εισαγωγής: ' + ((e as Error).message || 'άγνωστο'))
    } finally {
      setImporting(false)
    }
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
            <Button onClick={doImport} disabled={importing || totalToImport === 0}>
              {importing ? 'Εισαγωγή…' : `Εισαγωγή (${totalToImport})`}
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
              <span className="text-gray-600">{rows.length} κινήσεις — επιλεγμένες για εισαγωγή: <b>{totalToImport}</b></span>
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
                    <th className="px-2 py-1">Αντιστοίχιση</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const credit = r.amount > 0
                    const fee = credit ? feeByCredit[r.id] ?? 0 : 0
                    const net = credit ? Math.max(0, Math.round((r.amount - fee) * 100) / 100) : 0
                    return (
                      <tr key={r.id} className={`border-t border-gray-100 ${!credit ? 'bg-amber-50/40' : ''}`}>
                        <td className="px-2 py-1">
                          <input
                            type="checkbox"
                            disabled={credit ? !r.apartmentId : r.feeMode === 'deduct' ? r.deductFromId == null : !r.category.trim()}
                            checked={r.include}
                            onChange={(e) => update(i, { include: e.target.checked })}
                          />
                        </td>
                        <td className="whitespace-nowrap px-2 py-1">{r.date}</td>
                        <td className="px-2 py-1">
                          <div className="max-w-[16rem] truncate" title={r.description}>{r.description}</div>
                          {r.duplicate && <Badge color="amber">πιθανό διπλό</Badge>}
                          {credit && fee > 0 && (
                            <div className="text-[11px] text-amber-700">
                              καθαρό: <b>{money(net)}</b> (−προμήθεια {money(fee)})
                            </div>
                          )}
                        </td>
                        <td className={`px-2 py-1 text-right tnum font-medium ${credit ? 'text-green-700' : 'text-red-700'}`}>
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
                              {apartments.map((a) => {
                                const owed = balances[a.id] ?? 0
                                const near = Math.abs(owed - r.amount) < 0.01
                                return (
                                  <option key={a.id} value={a.id}>
                                    {a.code}{a.ownerName ? ` — ${a.ownerName}` : ''} · οφειλή {money(owed)}{near ? ' ✓' : ''}
                                  </option>
                                )
                              })}
                            </select>
                          ) : (
                            <div className="space-y-1">
                              <select
                                value={r.feeMode === 'deduct' && r.deductFromId != null ? `d:${r.deductFromId}` : 'expense'}
                                onChange={(e) => {
                                  const v = e.target.value
                                  if (v === 'expense') {
                                    update(i, { feeMode: 'expense', deductFromId: null, include: !!r.category.trim() })
                                  } else {
                                    update(i, { feeMode: 'deduct', deductFromId: Number(v.slice(2)), include: true })
                                  }
                                }}
                                className="w-full rounded border border-gray-300 px-1 py-0.5 text-xs"
                              >
                                <option value="expense">Γενικό έξοδο (δαπάνη κτιρίου)</option>
                                {creditTargets.map((c) => (
                                  <option key={c.id} value={`d:${c.id}`}>
                                    Αφαίρεση από: {aptLabel(c.apartmentId)} · {money(c.amount)}
                                  </option>
                                ))}
                              </select>
                              {r.feeMode === 'expense' && (
                                <input
                                  type="text"
                                  value={r.category}
                                  placeholder="Κατηγορία δαπάνης"
                                  onChange={(e) => update(i, { category: e.target.value, include: !!e.target.value.trim() })}
                                  className="w-full rounded border border-gray-300 px-1 py-0.5 text-xs"
                                />
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="flex items-start gap-1.5 text-xs text-gray-400">
              <FileText size={13} className="mt-0.5 shrink-0" />
              <span>
                Οι εισπράξεις γίνονται πληρωμές («Τραπεζική κατάθεση»). Η προμήθεια μεταφοράς αφαιρείται από την πληρωμή του
                καταθέτη, ώστε να οφείλει το πλήρες ποσό των κοινοχρήστων. Λοιπές τραπεζικές χρεώσεις καταχωρούνται ως γενικά
                έξοδα κτιρίου.
              </span>
            </p>
          </>
        )}
      </div>
    </Modal>
  )
}
