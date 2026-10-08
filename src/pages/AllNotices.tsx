import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { Button } from '@/components/forms'
import { NoticeDocument } from '@/components/NoticeDocument'
import type { Statement } from '@/types'
import { getStatement } from '@/lib/repos/statements'

export default function AllNotices() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { building } = useAppData()
  const [st, setSt] = useState<Statement | null>(null)
  const [loading, setLoading] = useState(true)

  const iban = building?.iban ?? ''

  useEffect(() => {
    if (!id) return
    getStatement(id)
      .then(setSt)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="text-gray-400">Φόρτωση…</div>
  if (!st) return <div className="text-gray-500">Η έκδοση δεν βρέθηκε.</div>

  return (
    <div className="mx-auto max-w-md">
      <div className="no-print mb-4 flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(`/statements/${st.id}`)}>
          <ArrowLeft size={18} /> Πίσω
        </Button>
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer size={18} /> Εκτύπωση όλων ({st.rows.length})
        </Button>
      </div>

      <div className="space-y-4">
        {st.rows.map((row) => (
          <div
            key={row.apartmentId}
            className="print-page print-area rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
          >
            <NoticeDocument
              st={st}
              row={row}
              iban={iban}
              bankName={building?.bankName}
              companyName={building?.companyName}
              dueDays={building?.paymentDueDays}
              area={building?.area}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
