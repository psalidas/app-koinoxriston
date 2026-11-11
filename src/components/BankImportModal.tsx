import { useMemo, useState } from 'react'
import { Sparkles, FileText, Plus, X } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { Button, Badge } from '@/components/forms'
import { Modal } from '@/components/Modal'
import { money, latinize } from '@/lib/format'
import type { Apartment, Building, Expense, FundEntry, Payment } from '@/types'
import { analyzeBankStatement, type BankTxn } from '@/lib/ocr'
import { createPayment } from '@/lib/repos/payments'
import { createExpense, listExpenses } from '@/lib/repos/expenses'
import { createFundEntry, listFundEntries } from '@/lib/repos/fund'
import { paymentCodeFor } from '@/lib/paymentCode'

// Τρόπος χειρισμού μιας χρέωσης (debit):
//  • 'deduct'  → προμήθεια μεταφοράς· αφαιρείται από την πληρωμή του καταθέτη.
//  • 'expense' → λοιπή τραπεζική δαπάνη· καταχωρείται ως γενικό έξοδο κτιρίου.
type FeeMode = 'deduct' | 'expense'

/** Επιμερισμός μιας είσπραξης σε διαμέρισμα (μπορεί να είναι πολλά). */
interface Alloc {
  apartmentId: string
  amount: number
}

interface Row {
  id: number
  date: string // YYYY-MM-DD
  description: string
  amount: number
  // Είσπραξη (credit) → πληρωμές διαμερισμάτων (επιμερισμός σε ένα ή πολλά).
  allocations: Alloc[]
  toFund: boolean // είσπραξη με «άλλη αιτιολογία» → κίνηση Ταμείου (in)
  fundTransfer: boolean // κίνηση Ταμείου που είναι εσωτερική μεταφορά (δεν μετρά)
  category: string // debit → κατηγορία δαπάνης· credit+toFund → αιτιολογία Ταμείου
  feeMode: FeeMode // μόνο για χρεώσεις
  deductFromId: number | null // χρέωση σε mode 'deduct': σε ποια είσπραξη αφαιρείται
  include: boolean
  alreadyImported: boolean // ταιριάζει με ήδη εισαγμένη κίνηση → εκτός by default
}

function toISO(d?: string): string {
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : new Date().toISOString().slice(0, 10)
}

/** Αναγνωρίζει χρεώσεις προμήθειας/εξόδων τράπεζας. */
function isFee(description: string): boolean {
  const d = latinize(description)
  return /\bcom\b|promith|proemith|eksoda|charge|\bfee\b|commission/.test(d)
}

/** Κωδικοί αναφοράς μέσα σε μια περιγραφή (αλφαριθμητικά ≥8 χαρακτήρων). */
function refTokens(description: string): string[] {
  return latinize(description).match(/[a-z0-9]{8,}/g) ?? []
}

/** Κατάθεση μετρητών ταμείου στην τράπεζα → εσωτερική μεταφορά (δεν μετρά). */
function isCashTransfer(description: string): boolean {
  const d = latinize(description)
  return /katathes/.test(d) && /(metr|tamei)/.test(d)
}

/** Κανονικοποιημένη περιγραφή για κλειδί κίνησης. */
function normDesc(description: string): string {
  return latinize(description).replace(/\s+/g, '').slice(0, 80)
}
/** Ακριβές κλειδί κίνησης (ημ/νία|ποσό|περιγραφή). */
function keyExact(dateISO: string, amount: number, description: string): string {
  return `${dateISO}|${amount.toFixed(2)}|${normDesc(description)}`
}
/** Χαλαρό κλειδί (ημ/νία|περιγραφή) — για παλιές εγγραφές χωρίς importKey. */
function keyLoose(dateISO: string, description: string): string {
  return `${dateISO}|${normDesc(description)}`
}
function isoOf(ts?: Timestamp): string {
  const d = ts?.toDate?.()
  return d ? d.toISOString().slice(0, 10) : ''
}
/** Περιγραφή από σημείωση «Extré: …», χωρίς το επίθεμα προμήθειας. */
function descFromNote(note?: string): string {
  if (!note) return ''
  const m = /^Extré:\s*([\s\S]*?)(?:\s*\(−προμήθεια[\s\S]*)?$/.exec(note)
  return (m ? m[1] : note).trim()
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

  /** Όλα τα διαμερίσματα που εντοπίζονται στην περιγραφή (για επιμερισμό). */
  function matchApartmentsAll(description: string): string[] {
    const d = latinize(description)
    const ids: string[] = []
    const add = (id: string) => { if (id && !ids.includes(id)) ids.push(id) }
    for (const m of matchData) if (m.payCode && d.includes(m.payCode)) add(m.id)
    for (const m of matchData) {
      if (m.code && m.code.length >= 2 && new RegExp(`(^|[^a-z0-9])${m.code.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}([^a-z0-9]|$)`).test(d)) add(m.id)
    }
    for (const m of matchData) if (m.tokens.some((t) => d.includes(t))) add(m.id)
    return ids
  }

  function matchApartment(description: string, amount: number): string {
    const hits = matchApartmentsAll(description)
    if (hits.length) return hits[0]
    // Fallback: μοναδικό διαμέρισμα με οφειλή ίση με το ποσό.
    if (amount > 0) {
      const owed = apartments.filter((a) => Math.abs((balances[a.id] ?? 0) - amount) < 0.01)
      if (owed.length === 1) return owed[0].id
    }
    return ''
  }

  async function onFile(file: File) {
    setAnalyzing(true)
    setError(null)
    setMsg(null)
    setRows(null)
    try {
      // Κλειδιά ήδη εισαγμένων κινήσεων (πληρωμές + δαπάνες + κινήσεις Ταμείου).
      const [exps, funds] = await Promise.all([listExpenses(building.id), listFundEntries(building.id)])
      const exactKeys = new Set<string>() // importKey (κινήσεις από extré)
      const looseKeys = new Set<string>() // ημ/νία|περιγραφή (από σημείωση «Extré:»)
      const addRecord = (importKey: string | undefined, note: string | undefined, dISO: string) => {
        if (importKey) {
          exactKeys.add(importKey)
          return
        }
        const desc = descFromNote(note)
        if (dISO && desc) looseKeys.add(keyLoose(dISO, desc))
      }
      for (const p of existing) addRecord(p.importKey, p.note, isoOf(p.date))
      for (const e of exps) addRecord((e as Expense).importKey, e.note, e.date ?? `${e.period}-01`)
      for (const f of funds) addRecord((f as FundEntry).importKey, f.note, isoOf(f.date))

      // Χειροκίνητες εγγραφές (χωρίς «Extré:»): αντιστοίχιση κατά ποσό.
      //  • πληρωμές: ημ/νία|ποσό|διαμέρισμα  •  δαπάνες: ποσό|ημ/νία & ποσό|μήνα  •  ταμείο: ημ/νία|ποσό
      const amt = (n: number) => (Math.round((n || 0) * 100) / 100).toFixed(2)
      const payByKey = new Set(existing.map((p) => `${isoOf(p.date)}|${amt(p.amount)}|${p.apartmentId}`))
      const fundByKey = new Set(funds.map((f) => `${isoOf(f.date)}|${amt(f.amount)}`))
      const expByDate = new Set(exps.map((e) => `${e.date ?? `${e.period}-01`}|${amt(e.amount)}`))
      const expByPeriod = new Set(exps.map((e) => `${e.period}|${amt(e.amount)}`))

      const txns = await analyzeBankStatement(file)
      // 1ο πέρασμα: χτίσε τις γραμμές.
      const built: Row[] = txns.map((t: BankTxn, idx: number): Row => {
        const amount = Number(t.amount) || 0
        const date = toISO(t.date)
        const description = t.description || ''
        const base = exactKeys.has(keyExact(date, amount, description)) || looseKeys.has(keyLoose(date, description))
        if (amount > 0) {
          const hits = matchApartmentsAll(description)
          const one = hits.length ? hits[0] : matchApartment(description, amount)
          // Επιμερισμός: ένα διαμέρισμα → όλο το ποσό· πολλά → κατά οφειλή.
          const allocations: Alloc[] =
            hits.length > 1
              ? hits.map((id) => ({ apartmentId: id, amount: Math.max(0, Math.round((balances[id] ?? 0) * 100) / 100) }))
              : one
              ? [{ apartmentId: one, amount }]
              : []
          const already =
            base ||
            (!!one && payByKey.has(`${date}|${amt(amount)}|${one}`)) ||
            fundByKey.has(`${date}|${amt(amount)}`)
          return {
            id: idx, date, description, amount, allocations,
            toFund: false, fundTransfer: isCashTransfer(description),
            category: '', feeMode: 'expense', deductFromId: null,
            include: allocations.length > 0 && !already, alreadyImported: already,
          }
        }
        const fee = isFee(description)
        const abs = amt(Math.abs(amount))
        const already =
          base ||
          expByDate.has(`${date}|${abs}`) ||
          expByPeriod.has(`${date.slice(0, 7)}|${abs}`) ||
          fundByKey.has(`${date}|${abs}`)
        return {
          id: idx, date, description, amount, allocations: [],
          toFund: false, fundTransfer: false,
          category: fee ? 'Τραπεζικά έξοδα' : description.slice(0, 60),
          feeMode: 'expense', deductFromId: null,
          include: fee && !already, alreadyImported: already,
        }
      })
      // 2ο πέρασμα: σύνδεσε κάθε προμήθεια με τη μεταφορά της (κοινός κωδικός ή ίδια ημ/νία).
      const credits = built.filter((r) => r.amount > 0)
      const creditTok = new Map<number, Set<string>>(credits.map((c) => [c.id, new Set(refTokens(c.description))]))
      for (const r of built) {
        if (r.amount >= 0 || !isFee(r.description)) continue
        const ftoks = refTokens(r.description)
        let target = credits.find((c) => ftoks.some((t) => creditTok.get(c.id)!.has(t)))
        if (!target) target = credits.find((c) => c.allocations.length > 0 && c.date === r.date)
        if (target) {
          r.feeMode = 'deduct'
          r.deductFromId = target.id
          if (!r.alreadyImported) r.include = true
        }
      }
      // 3ο πέρασμα: αφαίρεσε την προμήθεια από την προεπιλεγμένη (μονή) γραμμή
      // επιμερισμού, ώστε η πληρωμή να καταχωρηθεί καθαρή (ο καταθέτης οφείλει
      // την προμήθεια). Αν ο χρήστης έχει ήδη επιμερίσει, δεν την πειράζουμε.
      const feeByCreditInit: Record<number, number> = {}
      for (const r of built) {
        if (r.amount < 0 && r.include && r.feeMode === 'deduct' && r.deductFromId != null) {
          feeByCreditInit[r.deductFromId] = (feeByCreditInit[r.deductFromId] ?? 0) + Math.abs(r.amount)
        }
      }
      for (const r of built) {
        if (r.amount <= 0 || r.allocations.length !== 1) continue
        const fee = feeByCreditInit[r.id] ?? 0
        if (fee > 0 && Math.abs(r.allocations[0].amount - r.amount) < 0.001) {
          r.allocations[0].amount = Math.max(0, Math.round((r.amount - fee) * 100) / 100)
        }
      }
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
  function updateAlloc(i: number, ai: number, patch: Partial<Alloc>) {
    setRows((prev) =>
      prev
        ? prev.map((r, idx) =>
            idx === i ? { ...r, allocations: r.allocations.map((a, k) => (k === ai ? { ...a, ...patch } : a)), include: true } : r,
          )
        : prev,
    )
  }
  function addAlloc(i: number) {
    setRows((prev) =>
      prev ? prev.map((r, idx) => (idx === i ? { ...r, allocations: [...r.allocations, { apartmentId: '', amount: 0 }] } : r)) : prev,
    )
  }
  function removeAlloc(i: number, ai: number) {
    setRows((prev) =>
      prev ? prev.map((r, idx) => (idx === i ? { ...r, allocations: r.allocations.filter((_, k) => k !== ai) } : r)) : prev,
    )
  }

  const rr = rows ?? []

  const creditIsPay = (r: Row) =>
    r.amount > 0 && r.include && !r.toFund && r.allocations.some((a) => a.apartmentId && a.amount > 0)

  const creditTargets = rr.filter((r) => r.amount > 0)
  const includedCreditIds = useMemo(
    () => new Set(rr.filter(creditIsPay).map((r) => r.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const netOf = (r: Row) => Math.max(0, Math.round((r.amount - (feeByCredit[r.id] ?? 0)) * 100) / 100)
  const allocSum = (r: Row) => Math.round(r.allocations.reduce((s, a) => s + (Number(a.amount) || 0), 0) * 100) / 100

  const payCredits = rr.filter(creditIsPay)
  const payCount = payCredits.reduce((s, r) => s + r.allocations.filter((a) => a.apartmentId && a.amount > 0).length, 0)
  const fundRows = rr.filter((r) => r.amount > 0 && r.include && r.toFund && r.category.trim())
  const expenseRows = rr.filter((r) => r.amount < 0 && r.include && r.feeMode === 'expense' && r.category.trim())
  const appliedDeducts = rr.filter(
    (r) => r.amount < 0 && r.include && r.feeMode === 'deduct' && r.deductFromId != null && includedCreditIds.has(r.deductFromId),
  ).length
  const totalToImport = payCount + fundRows.length + expenseRows.length

  async function doImport() {
    if (!building || totalToImport === 0) return
    setImporting(true)
    setError(null)
    try {
      for (const r of payCredits) {
        const fee = feeByCredit[r.id] ?? 0
        const key = keyExact(r.date, r.amount, r.description)
        const base = fee > 0 ? `Extré: ${r.description} (−προμήθεια ${money(fee)})` : `Extré: ${r.description}`
        for (const a of r.allocations) {
          if (!a.apartmentId || !(a.amount > 0)) continue
          await createPayment({
            buildingId: building.id,
            apartmentId: a.apartmentId,
            amount: Math.round(a.amount * 100) / 100,
            date: Timestamp.fromDate(new Date(r.date)),
            method: 'bank',
            note: base.slice(0, 200),
            importKey: key,
          })
        }
      }
      for (const r of fundRows) {
        await createFundEntry({
          buildingId: building.id,
          date: Timestamp.fromDate(new Date(r.date)),
          type: 'in',
          amount: r.amount,
          category: r.category.trim(),
          note: `Extré: ${r.description}`.slice(0, 200),
          transfer: r.fundTransfer || undefined,
          importKey: keyExact(r.date, r.amount, r.description),
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
          importKey: keyExact(r.date, r.amount, r.description),
        })
      }
      const parts: string[] = []
      if (payCount) parts.push(`${payCount} πληρωμές`)
      if (appliedDeducts) parts.push(`${appliedDeducts} προμήθειες αφαιρέθηκαν`)
      if (fundRows.length) parts.push(`${fundRows.length} κινήσεις Ταμείου`)
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
              Η AI διαβάζει τις κινήσεις και προτείνει αυτόματα το διαμέρισμα. Κινήσεις που έχουν ήδη εισαχθεί
              εντοπίζονται και παραλείπονται. Ελέγξτε πριν την εισαγωγή.
            </p>
          </div>
        )}

        {rows && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{rows.length} κινήσεις — για εισαγωγή: <b>{totalToImport}</b></span>
              <button onClick={() => setRows(null)} className="text-xs text-blue-600 hover:underline">Νέο αρχείο</button>
            </div>
            <div className="max-h-[24rem] overflow-y-auto rounded-md border border-gray-200">
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
                    const net = credit ? netOf(r) : 0
                    const remaining = credit ? Math.round((net - allocSum(r)) * 100) / 100 : 0
                    return (
                      <tr key={r.id} className={`border-t border-gray-100 ${r.alreadyImported ? 'opacity-60' : ''} ${!credit ? 'bg-amber-50/40' : ''}`}>
                        <td className="px-2 py-1 align-top">
                          <input
                            type="checkbox"
                            disabled={
                              credit
                                ? r.toFund ? !r.category.trim() : !r.allocations.some((a) => a.apartmentId && a.amount > 0)
                                : r.feeMode === 'deduct' ? r.deductFromId == null : !r.category.trim()
                            }
                            checked={r.include}
                            onChange={(e) => update(i, { include: e.target.checked })}
                          />
                        </td>
                        <td className="whitespace-nowrap px-2 py-1 align-top">{r.date}</td>
                        <td className="px-2 py-1 align-top">
                          <div className="max-w-[15rem] truncate" title={r.description}>{r.description}</div>
                          {r.alreadyImported && <Badge color="gray">ήδη καταχωρημένο</Badge>}
                          {credit && fee > 0 && (
                            <div className="text-[11px] text-amber-700">καθαρό: <b>{money(net)}</b> (−προμήθεια {money(fee)})</div>
                          )}
                        </td>
                        <td className={`px-2 py-1 text-right align-top tnum font-medium ${credit ? 'text-green-700' : 'text-red-700'}`}>
                          {money(r.amount)}
                        </td>
                        <td className="px-2 py-1 align-top">
                          {credit ? (
                            <div className="space-y-1">
                              <select
                                value={r.toFund ? 'fund' : 'pay'}
                                onChange={(e) => {
                                  if (e.target.value === 'fund') {
                                    const reason = (r.category || r.description).trim()
                                    update(i, { toFund: true, allocations: [], category: reason, include: !!reason })
                                  } else {
                                    update(i, { toFund: false, include: false })
                                  }
                                }}
                                className="w-full rounded border border-gray-300 px-1 py-0.5 text-xs"
                              >
                                <option value="pay">Πληρωμή διαμερίσματος</option>
                                <option value="fund">Άλλη αιτιολογία (κίνηση Ταμείου)</option>
                              </select>

                              {!r.toFund && (
                                <>
                                  {r.allocations.map((al, ai) => (
                                    <div key={ai} className="flex items-center gap-1">
                                      <select
                                        value={al.apartmentId}
                                        onChange={(e) => updateAlloc(i, ai, { apartmentId: e.target.value })}
                                        className="min-w-0 flex-1 rounded border border-gray-300 px-1 py-0.5 text-xs"
                                      >
                                        <option value="">— διαμέρισμα —</option>
                                        {apartments.map((a) => {
                                          const owed = balances[a.id] ?? 0
                                          return (
                                            <option key={a.id} value={a.id}>
                                              {a.code}{a.ownerName ? ` — ${a.ownerName}` : ''} · οφειλή {money(owed)}
                                            </option>
                                          )
                                        })}
                                      </select>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={al.amount || ''}
                                        onChange={(e) => updateAlloc(i, ai, { amount: Number(e.target.value) || 0 })}
                                        className="w-16 rounded border border-gray-300 px-1 py-0.5 text-right text-xs tnum"
                                      />
                                      {r.allocations.length > 1 && (
                                        <button onClick={() => removeAlloc(i, ai)} className="shrink-0 rounded p-0.5 text-gray-400 hover:text-red-600" title="Αφαίρεση">
                                          <X size={13} />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                  <div className="flex items-center justify-between">
                                    <button onClick={() => addAlloc(i)} className="inline-flex items-center gap-0.5 text-[11px] text-blue-600 hover:underline">
                                      <Plus size={12} /> διαμέρισμα
                                    </button>
                                    {r.allocations.length > 0 && Math.abs(remaining) >= 0.01 && (
                                      <span className={`text-[11px] ${remaining > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                                        υπόλοιπο: {money(remaining)}
                                      </span>
                                    )}
                                  </div>
                                </>
                              )}

                              {r.toFund && (
                                <>
                                  <input
                                    type="text"
                                    value={r.category}
                                    placeholder="Αιτιολογία (π.χ. ΚΑΤΑΘΕΣΗ ΤΑΜΕΙΟΥ ΜΕΤΡΗΤΩΝ)"
                                    onChange={(e) => update(i, { category: e.target.value, include: !!e.target.value.trim() })}
                                    className="w-full rounded border border-gray-300 px-1 py-0.5 text-xs"
                                  />
                                  <label className="flex items-start gap-1 text-[11px] text-gray-500">
                                    <input type="checkbox" className="mt-0.5" checked={r.fundTransfer}
                                      onChange={(e) => update(i, { fundTransfer: e.target.checked })} />
                                    <span>Εσωτερική μεταφορά (δεν μετρά στο υπόλοιπο)</span>
                                  </label>
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <select
                                value={r.feeMode === 'deduct' && r.deductFromId != null ? `d:${r.deductFromId}` : 'expense'}
                                onChange={(e) => {
                                  const v = e.target.value
                                  if (v === 'expense') update(i, { feeMode: 'expense', deductFromId: null, include: !!r.category.trim() })
                                  else update(i, { feeMode: 'deduct', deductFromId: Number(v.slice(2)), include: true })
                                }}
                                className="w-full rounded border border-gray-300 px-1 py-0.5 text-xs"
                              >
                                <option value="expense">Γενικό έξοδο (δαπάνη κτιρίου)</option>
                                {creditTargets.map((c) => (
                                  <option key={c.id} value={`d:${c.id}`}>
                                    Αφαίρεση από: {c.allocations[0]?.apartmentId ? aptLabel(c.allocations[0].apartmentId) : 'κατάθεση'} · {money(c.amount)} · {c.date}
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
                Μια είσπραξη μπορεί να επιμεριστεί σε <b>πολλά διαμερίσματα</b> (προσθήκη γραμμών). Για ένα διαμέρισμα σε
                πολλούς μήνες, μία πληρωμή καλύπτει τις παλαιότερες οφειλές. Κινήσεις που έχουν ήδη καταχωρηθεί (από extré ή
                <b> χειροκίνητα</b> — ίδιο ποσό/ημ/νία/διαμέρισμα, ή ποσό/μήνας για δαπάνες) σημειώνονται «ήδη καταχωρημένο» και
                παραλείπονται. Λοιπές τραπεζικές χρεώσεις → γενικά έξοδα κτιρίου.
              </span>
            </p>
          </>
        )}
      </div>
    </Modal>
  )
}
