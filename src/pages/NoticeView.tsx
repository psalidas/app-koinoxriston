import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'
import { ArrowLeft, Printer } from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { Button } from '@/components/forms'
import { money, formatPeriod, formatDate } from '@/lib/format'
import type { ExpenseGroup, Statement, StatementRow } from '@/types'
import { GROUP_LABELS, GROUP_ORDER } from '@/types'
import { getStatement } from '@/lib/repos/statements'
import { rfReference, groupRef, epcQrPayload } from '@/lib/paymentRef'

export default function NoticeView() {
  const { id, apartmentId } = useParams()
  const navigate = useNavigate()
  const { building } = useAppData()
  const [st, setSt] = useState<Statement | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    getStatement(id)
      .then(setSt)
      .finally(() => setLoading(false))
  }, [id])

  const row: StatementRow | undefined = st?.rows.find((r) => r.apartmentId === apartmentId)
  const iban = building?.iban ?? ''
  const amountDue = row?.total ?? 0
  const reference = st && row ? rfReference(`${st.buildingCode}${row.code}${st.period}`) : ''

  useEffect(() => {
    if (!st || !row) return
    if (!iban) {
      setQr(null)
      return
    }
    const payload = epcQrPayload({
      name: st.buildingName,
      iban,
      amount: amountDue,
      reference,
    })
    QRCode.toDataURL(payload, { margin: 1, width: 240 })
      .then(setQr)
      .catch(() => setQr(null))
  }, [st, row, iban, amountDue, reference])

  if (loading) return <div className="text-gray-400">Φόρτωση…</div>
  if (!st || !row) return <div className="text-gray-500">Το ειδοποιητήριο δεν βρέθηκε.</div>

  const activeGroups: ExpenseGroup[] = GROUP_ORDER.filter((g) => (row.amounts[g] ?? 0) !== 0)

  return (
    <div className="mx-auto max-w-md">
      <div className="no-print mb-4 flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(`/statements/${st.id}`)}>
          <ArrowLeft size={18} /> Πίσω
        </Button>
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer size={18} /> Εκτύπωση
        </Button>
      </div>

      <div className="print-area rounded-lg border border-gray-200 bg-white p-5 text-sm shadow-sm">
        <div className="mb-3 text-center">
          <h1 className="text-base font-bold">ΕΙΔΟΠΟΙΗΤΗΡΙΟ ΚΟΙΝΟΧΡΗΣΤΩΝ</h1>
          <p className="text-xs text-gray-500">{formatPeriod(st.period)} · {st.periodLabel}</p>
        </div>

        <div className="mb-4 rounded-md bg-gray-50 p-3 text-xs">
          <div className="font-semibold text-gray-900">{st.buildingName}</div>
          <div className="text-gray-600">{st.buildingAddress}</div>
          <div className="text-gray-600">Διαχειριστής: {st.managerName}</div>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500">Διαμέρισμα</div>
            <div className="text-lg font-bold">{row.code}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">Ιδιοκτήτης</div>
            <div className="font-medium">{row.ownerName}</div>
          </div>
        </div>

        <table className="mb-3 w-full text-sm">
          <tbody>
            {activeGroups.map((g) => (
              <tr key={g} className="border-t border-gray-100">
                <td className="py-1 text-gray-600">{GROUP_LABELS[g]}</td>
                <td className="py-1 text-right tnum">{money(row.amounts[g] ?? 0)}</td>
              </tr>
            ))}
            <tr className="border-t border-gray-100">
              <td className="py-1 text-gray-600">Έκδοση λογαριασμού</td>
              <td className="py-1 text-right tnum">{money(row.billingFee)}</td>
            </tr>
            <tr className="border-t border-gray-200">
              <td className="py-1 font-medium">Σύνολο περιόδου</td>
              <td className="py-1 text-right tnum font-medium">{money(row.currentCharge)}</td>
            </tr>
            {row.previousBalance !== 0 && (
              <tr className="border-t border-gray-100">
                <td className="py-1 text-gray-600">Προηγούμενο υπόλοιπο</td>
                <td className="py-1 text-right tnum">{money(row.previousBalance)}</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="mb-4 flex items-center justify-between rounded-md bg-blue-50 px-3 py-2">
          <span className="font-semibold text-blue-900">Πληρωτέο ποσό</span>
          <span className="tnum text-xl font-bold text-blue-900">{money(amountDue)}</span>
        </div>

        {/* Payment */}
        <div className="rounded-md border border-gray-200 p-3">
          <div className="mb-2 text-xs font-semibold uppercase text-gray-500">Πληρωμή</div>
          {iban ? (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 text-xs">
                <div className="text-gray-500">IBAN</div>
                <div className="break-all font-mono">{iban}</div>
                <div className="mt-2 text-gray-500">Κωδικός πληρωμής (RF)</div>
                <div className="break-all font-mono">{groupRef(reference)}</div>
              </div>
              {qr && <img src={qr} alt="QR πληρωμής" className="h-28 w-28 shrink-0" />}
            </div>
          ) : (
            <p className="text-xs text-gray-400">
              Ορίστε ΙΒΑΝ στις «Ρυθμίσεις κτιρίου» για να εμφανίζεται κωδικός & QR
              πληρωμής.
            </p>
          )}
        </div>

        <p className="mt-3 text-center text-[10px] text-gray-400">
          Έκδοση {formatDate(st.createdAt)} · {st.buildingCode}
        </p>
      </div>
    </div>
  )
}
