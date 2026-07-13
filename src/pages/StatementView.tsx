import { Fragment, useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Printer, Download, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Button, Badge } from '@/components/forms'
import { amount, mille, formatDate } from '@/lib/format'
import type { ExpenseGroup, Statement } from '@/types'
import { GROUP_LABELS, GROUP_ORDER, GROUP_SCALE_KEY } from '@/types'
import { getStatement, markIssued } from '@/lib/repos/statements'
import { exportStatement } from '@/lib/exports'

export default function StatementView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isManager, user } = useAuth()
  const [st, setSt] = useState<Statement | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    getStatement(id)
      .then(setSt)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="text-gray-400">Φόρτωση…</div>
  if (!st) return <div className="text-gray-500">Η έκδοση δεν βρέθηκε.</div>

  const activeGroups: ExpenseGroup[] = GROUP_ORDER.filter(
    (g) => (st.totals.byGroup[g] ?? 0) !== 0,
  )
  const linesByGroup = (g: ExpenseGroup) => st.expenseLines.filter((l) => l.group === g)

  async function issue() {
    if (!st) return
    await markIssued(st.id, user?.email ?? '')
    setSt({ ...st, status: 'issued' })
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
          <Button variant="secondary" onClick={() => navigate(`/statements/${st.id}/notices`)}>
            <Printer size={18} /> Όλα τα ειδοποιητήρια
          </Button>
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
          <table className="w-full border border-gray-300 text-[10px]">
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
                <th className="border border-gray-300 px-1 py-1">Έκδοση</th>
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
                <th className="border border-gray-300"></th>
                <th className="border border-gray-300"></th>
                <th className="border border-gray-300"></th>
                <th className="border border-gray-300"></th>
              </tr>
            </thead>
            <tbody>
              {st.rows.map((r, idx) => (
                <tr key={r.apartmentId} className="text-center">
                  <td className="border border-gray-300 px-1 tnum">{String(idx + 1).padStart(3, '0')}</td>
                  <td className="border border-gray-300 px-2 text-left">{r.ownerName}</td>
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
                  <td className="border border-gray-300 px-1 tnum text-right">{amount(r.billingFee)}</td>
                  <td className="border border-gray-300 px-1 tnum text-right">{amount(r.previousBalance)}</td>
                  <td className="border border-gray-300 px-1 tnum text-right">{amount(r.currentCharge)}</td>
                  <td className="border border-gray-300 px-1 tnum text-right font-semibold">{amount(r.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 text-center font-bold">
                <td className="border border-gray-300 px-1" colSpan={3}>
                  ΣΥΝΟΛΑ
                </td>
                {activeGroups.map((g) =>
                  GROUP_SCALE_KEY[g] ? (
                    <Fragment key={g}>
                      <td className="border border-gray-300"></td>
                      <td className="border border-gray-300 px-1 tnum text-right">
                        {amount(st.totals.byGroup[g] ?? 0)}
                      </td>
                    </Fragment>
                  ) : (
                    <td key={g} className="border border-gray-300 px-1 tnum text-right">
                      {amount(st.totals.byGroup[g] ?? 0)}
                    </td>
                  ),
                )}
                <td className="border border-gray-300 px-1 tnum text-right">{amount(st.totals.billingFees)}</td>
                <td className="border border-gray-300"></td>
                <td className="border border-gray-300"></td>
                <td className="border border-gray-300 px-1 tnum text-right">{amount(st.totals.grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-3 text-right text-[10px] text-gray-500">
          Γενικό σύνολο δαπανών: <span className="tnum font-bold text-gray-900">{amount(st.totals.grandTotal)} €</span>
        </div>
      </div>

      {/* Individual notices */}
      <div className="no-print mt-6">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Ατομικά ειδοποιητήρια</h2>
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
