import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { Button } from '@/components/forms'
import { NoticeDocument } from '@/components/NoticeDocument'
import type { Statement, StatementRow } from '@/types'
import { getStatement } from '@/lib/repos/statements'
import { paymentCodeFor } from '@/lib/paymentCode'

export default function NoticeView() {
  const { id, apartmentId } = useParams()
  const navigate = useNavigate()
  const { building, apartments } = useAppData()
  const [st, setSt] = useState<Statement | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    getStatement(id)
      .then(setSt)
      .finally(() => setLoading(false))
  }, [id])

  const row: StatementRow | undefined = st?.rows.find((r) => r.apartmentId === apartmentId)
  const iban = building?.iban ?? ''

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
        <NoticeDocument
          st={st}
          row={row}
          iban={iban}
          bankName={building?.bankName}
          companyName={building?.companyName}
          paymentCode={paymentCodeFor(
            apartments.find((a) => a.id === row.apartmentId),
            st.buildingCode,
            row.code,
          )}
          dueDays={building?.paymentDueDays}
          area={building?.area}
        />
      </div>
    </div>
  )
}
