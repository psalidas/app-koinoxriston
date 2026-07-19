import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'
import { ArrowLeft, Printer } from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { Button } from '@/components/forms'
import { NoticeDocument } from '@/components/NoticeDocument'
import type { Statement, StatementRow } from '@/types'
import { getStatement } from '@/lib/repos/statements'
import { rfReference, epcQrPayload } from '@/lib/paymentRef'

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

      <div className="print-area rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <NoticeDocument st={st} row={row} iban={iban} qr={qr} area={building?.area} />
      </div>
    </div>
  )
}
