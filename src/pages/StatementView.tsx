import { Fragment, useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Printer, Download, CheckCircle2, RefreshCw, Trash2 } from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Button, Badge } from '@/components/forms'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Footer } from '@/components/Footer'
import { amount, mille, formatDate } from '@/lib/format'
import type { ExpenseGroup, Statement } from '@/types'
import { GROUP_LABELS, GROUP_ORDER, GROUP_SCALE_KEY } from '@/types'
import {
  getStatement,
  markIssued,
  updateStatement,
  deleteStatement,
  listStatements,
} from '@/lib/repos/statements'
import { listExpenses } from '@/lib/repos/expenses'
import { listPayments } from '@/lib/repos/payments'
import { computeStatement } from '@/lib/allocation'
import { balancesByApartment } from '@/lib/balances'
import { exportStatement } from '@/lib/exports'

export default function StatementView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { building, apartments } = useAppData()
  const { isManager, user } = useAuth()
  const [st, setSt] = useState<Statement | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  useEffect(() => {
    if (!id) return
    getStatement(id)
      .then(setSt)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="text-gray-400">Φόρτωση…</div>
  if (!st) return <div className="text-gray-500">Η έκδοση δεν βρέθηκε.</div>

  // Η στήλη «Ειδικές δαπάνες» εμφανίζεται πάντα (σταθερή στήλη), όπως και οι
  // κατηγορίες που έχουν ποσό.
  const activeGroups: ExpenseGroup[] = GROUP_ORDER.filter(
    (g) => g === 'eidikes' || (st.totals.byGroup[g] ?? 0) !== 0,
  )
  // Στήλη «Έκδοση λογαριασμών» μόνο αν το κτίριο χρεώνει έκδοση (>0).
  const showBilling = (st.totals.billingFees ?? 0) !== 0
  const linesByGroup = (g: ExpenseGroup) => st.expenseLines.filter((l) => l.group === g)

  // Αθροίσματα στηλών (χιλιοστά + ποσά) για τη γραμμή «ΣΥΝΟΛΑ».
  const milleTotal = (scaleKey: string) => st.rows.reduce((s, r) => s + (r.millesimes[scaleKey] ?? 0), 0)
  const groupTotal = (g: ExpenseGroup) => st.rows.reduce((s, r) => s + (r.amounts[g] ?? 0), 0)
  const prevTotal = st.rows.reduce((s, r) => s + r.previousBalance, 0)
  const chargeTotal = st.rows.reduce((s, r) => s + r.currentCharge, 0)
  const rowsGrandTotal = st.rows.reduce((s, r) => s + r.total, 0)

  async function issue() {
    if (!st) return
    await markIssued(st.id, user?.email ?? '')
    setSt({ ...st, status: 'issued' })
  }

  /** Ξαναϋπολογίζει το πρόχειρο ώστε να συμπεριλάβει νέες δαπάνες της περιόδου. */
  async function refreshDraft() {
    if (!st || !building) return
    setBusy(true)
    try {
      const from = st.periodFrom ?? st.period
      const to = st.periodTo ?? st.period
      const [expenses, allStatements, payments] = await Promise.all([
        listExpenses(building.id),
        listStatements(building.id),
        listPayments(building.id),
      ])
      // Όλες οι δαπάνες της περιόδου· οι «Έκτακτες» πάνε στη στήλη «Ειδικές δαπάνες».
      const selected = expenses.filter((e) => e.period >= from && e.period <= to)
      const prior = allStatements.filter(
        (s) => s.status === 'issued' && s.id !== st.id && s.period < to,
      )
      const previousBalances = balancesByApartment(prior, payments)
      const { rows, totals, expenseLines } = computeStatement({
        building,
        apartments,
        expenses: selected,
        previousBalances,
      })
      await updateStatement(st.id, { rows, totals, expenseLines })
      setSt({ ...st, rows, totals, expenseLines })
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!st) return
    await deleteStatement(st.id)
    navigate('/statements')
  }

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" onClick={() => navigate('/statements')}>
          <ArrowLeft size={18} /> Πίσω
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Badge color={st.status === 'issued' ? 'green' : 'amber'}>
            {st.status === 'issued' ? 'Οριστική' : 'Πρόχειρη'}
          </Badge>
          <Button variant="secondary" onClick={() => exportStatement(st)}>
            <Download size={18} /> Excel
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer size={18} /> Εκτύπωση
          </Button>
          {isManager && (
            <>
              <Button variant="secondary" onClick={() => navigate(`/statements/${st.id}/notices`)}>
                <Printer size={18} /> Όλα τα ειδοποιητήρια
              </Button>
              <Button variant="secondary" onClick={() => navigate(`/statements/${st.id}/receipts`)}>
                <Printer size={18} /> Όλες οι αποδείξεις
              </Button>
            </>
          )}
          {isManager && st.status !== 'issued' && st.kind !== 'special' && (
            <Button variant="secondary" onClick={refreshDraft} disabled={busy}>
              <RefreshCw size={18} /> {busy ? 'Ανανέωση…' : 'Ανανέωση'}
            </Button>
          )}
          {isManager && st.status !== 'issued' && (
            <Button variant="danger" onClick={() => setShowDelete(true)}>
              <Trash2 size={18} /> Διαγραφή
            </Button>
          )}
          {isManager && st.status !== 'issued' && (
            <Button onClick={issue}>
              <CheckCircle2 size={18} /> Οριστικοποίηση
            </Button>
          )}
        </div>
      </div>

      <div className="print-area print-landscape rounded-lg border border-gray-200 bg-white p-4 text-[11px] text-gray-900 shadow-sm">
        {/* Header */}
        <div className="mb-3 border-b border-gray-300 pb-2 text-center">
          <h1 className="text-base font-bold tracking-wide">ΣΥΓΚΕΝΤΡΩΤΙΚΗ ΚΑΤΑΣΤΑΣΗ ΔΑΠΑΝΩΝ</h1>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
          <Info label="Κωδικός" value={st.buildingCode} />
          <Info label="Περίοδος" value={st.periodLabel} />
          <Info label="Διαχειριστής" value={st.managerName} />
          <Info label="Ημερομηνία" value={formatDate(st.createdAt)} />
          <Info label="Διεύθυνση" value={st.buildingAddress} />
          <Info label="Πολυκατοικία" value={st.buildingName} />
        </div>

        {/* Σύνολα ανά κατηγορία (σύνοψη) */}
        <div className="mb-3 rounded border border-gray-300">
          <div className="bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase">Σύνολα ανά κατηγορία</div>
          <div className="flex flex-wrap items-stretch divide-x divide-gray-200">
            {activeGroups.map((g) => (
              <div key={g} className="min-w-[110px] flex-1 px-3 py-1.5">
                <div className="text-[9px] uppercase text-gray-500">{GROUP_LABELS[g]}</div>
                <div className="tnum font-semibold">{amount(st.totals.byGroup[g] ?? 0)}</div>
              </div>
            ))}
            {showBilling && (
              <div className="min-w-[110px] flex-1 px-3 py-1.5">
                <div className="text-[9px] uppercase text-gray-500">Έκδοση λογ/σμών</div>
                <div className="tnum font-semibold">{amount(st.totals.billingFees)}</div>
              </div>
            )}
            <div className="min-w-[120px] flex-1 bg-gray-50 px-3 py-1.5">
              <div className="text-[9px] uppercase text-gray-500">Γενικό σύνολο</div>
              <div className="tnum font-bold">{amount(st.totals.grandTotal)}</div>
            </div>
          </div>
        </div>

        {/* Expense breakdown */}
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {activeGroups.map((g) => (
            <div key={g} className="rounded border border-gray-200">
              <div className="bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase">
                {GROUP_LABELS[g]}
              </div>
              <table className="w-full">
                <tbody>
                  {linesByGroup(g).map((l, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-2 py-0.5">{l.category}</td>
                      <td className="tnum px-2 py-0.5 text-right">{amount(l.amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-gray-300 font-semibold">
                    <td className="px-2 py-0.5">ΣΥΝΟΛΟ</td>
                    <td className="tnum px-2 py-0.5 text-right">{amount(st.totals.byGroup[g] ?? 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {/* Main allocation table */}
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border border-gray-300 text-[10px]">
            <colgroup>
              <col style={{ width: '1.8rem' }} />
              <col style={{ width: '7rem' }} />
              <col style={{ width: '2.2rem' }} />
              {activeGroups.map((g) =>
                GROUP_SCALE_KEY[g] ? (
                  <Fragment key={g}>
                    <col />
                    <col />
                  </Fragment>
                ) : (
                  // «Δαπάνες σε ίσα μέρη» — λίγο στενότερη στήλη
                  <col key={g} style={{ width: '4.5rem' }} />
                ),
              )}
              {showBilling && <col style={{ width: '3rem' }} />}
              <col />
              <col />
              <col />
            </colgroup>
            <thead>
              <tr className="bg-gray-100 text-center">
                <th className="border border-gray-300 px-1 py-1">Α/Α</th>
                <th className="border border-gray-300 px-2 py-1 text-left">Ονοματεπώνυμο</th>
                <th className="border border-gray-300 px-1 py-1">Διαμ.</th>
                {activeGroups.map((g) => (
                  <th key={g} className="border border-gray-300 px-1 py-1" colSpan={GROUP_SCALE_KEY[g] ? 2 : 1}>
                    {GROUP_LABELS[g]}
                  </th>
                ))}
                {showBilling && <th className="border border-gray-300 px-1 py-1">Έκδοση</th>}
                <th className="border border-gray-300 px-1 py-1">Προηγ. υπόλ.</th>
                <th className="border border-gray-300 px-1 py-1">Σύνολο περ.</th>
                <th className="border border-gray-300 px-1 py-1">Γενικό σύνολο</th>
              </tr>
              <tr className="bg-gray-50 text-center text-[9px] text-gray-500">
                <th className="border border-gray-300"></th>
                <th className="border border-gray-300"></th>
                <th className="border border-gray-300"></th>
                {activeGroups.map((g) =>
                  GROUP_SCALE_KEY[g] ? (
                    <Fragment key={g}>
                      <th className="border border-gray-300 px-1">χιλ.</th>
                      <th className="border border-gray-300 px-1">ποσό</th>
                    </Fragment>
                  ) : (
                    <th key={g} className="border border-gray-300 px-1">ποσό</th>
                  ),
                )}
                {showBilling && <th className="border border-gray-300"></th>}
                <th className="border border-gray-300"></th>
                <th className="border border-gray-300"></th>
                <th className="border border-gray-300"></th>
              </tr>
            </thead>
            <tbody>
              {st.rows.map((r, idx) => (
                <tr
                  key={r.apartmentId}
                  className="text-center"
                  style={idx % 2 === 1 ? { backgroundColor: '#dfe3e8' } : undefined}
                >
                  <td className="border border-gray-300 px-1 tnum">{String(idx + 1).padStart(3, '0')}</td>
                  <td className="border border-gray-300 px-2 text-left leading-tight break-words">{r.ownerName}</td>
                  <td className="border border-gray-300 px-1 font-medium">{r.code}</td>
                  {activeGroups.map((g) => {
                    const scaleKey = GROUP_SCALE_KEY[g]
                    return scaleKey ? (
                      <Fragment key={g}>
                        <td className="border border-gray-300 px-1 tnum">
                          {mille(r.millesimes[scaleKey] ?? 0)}
                        </td>
                        <td className="border border-gray-300 px-1 tnum text-right">
                          {amount(r.amounts[g] ?? 0)}
                        </td>
                      </Fragment>
                    ) : (
                      <td key={g} className="border border-gray-300 px-1 tnum text-right">
                        {amount(r.amounts[g] ?? 0)}
                      </td>
                    )
                  })}
                  {showBilling && (
                    <td className="border border-gray-300 px-1 tnum text-right">{amount(r.billingFee)}</td>
                  )}
                  <td className="border border-gray-300 px-1 tnum text-right">{amount(r.previousBalance)}</td>
                  <td className="border border-gray-300 px-1 tnum text-right">{amount(r.currentCharge)}</td>
                  <td className="border border-gray-300 px-1 tnum text-right font-semibold">{amount(r.total)}</td>
                </tr>
              ))}
              {/* ΣΥΝΟΛΑ ως τελευταία γραμμή του σώματος — εμφανίζεται μία φορά στο
                  τέλος (το tfoot επαναλαμβανόταν σε κάθε σελίδα εκτύπωσης). */}
              <tr className="bg-gray-200 text-center font-bold" style={{ breakInside: 'avoid' }}>
                <td className="border border-gray-300 px-1" colSpan={3}>
                  ΣΥΝΟΛΑ
                </td>
                {activeGroups.map((g) => {
                  const scaleKey = GROUP_SCALE_KEY[g]
                  return scaleKey ? (
                    <Fragment key={g}>
                      <td className="border border-gray-300 px-1 tnum">{mille(milleTotal(scaleKey))}</td>
                      <td className="border border-gray-300 px-1 tnum text-right">{amount(groupTotal(g))}</td>
                    </Fragment>
                  ) : (
                    <td key={g} className="border border-gray-300 px-1 tnum text-right">
                      {amount(groupTotal(g))}
                    </td>
                  )
                })}
                {showBilling && (
                  <td className="border border-gray-300 px-1 tnum text-right">{amount(st.totals.billingFees)}</td>
                )}
                <td className="border border-gray-300 px-1 tnum text-right">{amount(prevTotal)}</td>
                <td className="border border-gray-300 px-1 tnum text-right">{amount(chargeTotal)}</td>
                <td className="border border-gray-300 px-1 tnum text-right">{amount(rowsGrandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-right text-[10px] text-gray-500">
          Γενικό σύνολο δαπανών: <span className="tnum font-bold text-gray-900">{amount(st.totals.grandTotal)} €</span>
        </div>

        <Footer className="print-only mt-2 border-t border-gray-100" />
      </div>

      {/* Individual notices — μόνο για διαχειριστές */}
      {isManager && (
      <>
      <div className="no-print mt-6">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Ειδοποιητήρια Διαμερίσματος</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {st.rows.map((r) => (
            <Link
              key={r.apartmentId}
              to={`/statements/${st.id}/notice/${r.apartmentId}`}
              className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm transition hover:border-blue-300"
            >
              <span className="font-medium text-gray-900">{r.code}</span>
              <span className="tnum text-gray-500">{amount(r.total)}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Αποδείξεις Ενοίκου / Ιδιοκτήτη */}
      <div className="no-print mt-6">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Αποδείξεις Ενοίκου / Ιδιοκτήτη</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {st.rows.map((r) => (
            <Link
              key={r.apartmentId}
              to={`/statements/${st.id}/receipt/${r.apartmentId}`}
              className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm transition hover:border-blue-300"
            >
              <span className="font-medium text-gray-900">{r.code}</span>
              <span className="tnum text-gray-500">{amount(r.total)}</span>
            </Link>
          ))}
        </div>
      </div>
      </>
      )}

      <ConfirmDialog
        open={showDelete}
        message="Διαγραφή αυτής της πρόχειρης έκδοσης;"
        onCancel={() => setShowDelete(false)}
        onConfirm={remove}
      />
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[10px] uppercase text-gray-400">{label}: </span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
