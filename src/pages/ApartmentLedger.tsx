import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { Card, PageHeader, Badge } from '@/components/forms'
import { money, formatDate, formatPeriod } from '@/lib/format'
import { round2 } from '@/lib/allocation'
import type { Payment, Statement } from '@/types'
import { listStatements } from '@/lib/repos/statements'
import { listPayments } from '@/lib/repos/payments'

interface Tx {
  date: number
  label: string
  charge: number
  payment: number
}

export default function ApartmentLedger() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { building, apartments } = useAppData()
  const apt = apartments.find((a) => a.id === id)
  const [statements, setStatements] = useState<Statement[]>([])
  const [payments, setPayments] = useState<Payment[]>([])

  useEffect(() => {
    if (!building || !id) return
    void (async () => {
      const [st, pm] = await Promise.all([
        listStatements(building.id),
        listPayments(building.id, id),
      ])
      setStatements(st.filter((s) => s.status === 'issued'))
      setPayments(pm)
    })()
  }, [building, id])

  const txs = useMemo<Tx[]>(() => {
    const list: Tx[] = []
    for (const s of statements) {
      const row = s.rows.find((r) => r.apartmentId === id)
      if (row) {
        list.push({
          date: s.issuedAt?.toMillis?.() ?? s.createdAt?.toMillis?.() ?? 0,
          label: `Κοινόχρηστα ${formatPeriod(s.period)}`,
          charge: row.currentCharge,
          payment: 0,
        })
      }
    }
    for (const p of payments) {
      list.push({
        date: p.date?.toMillis?.() ?? 0,
        label: 'Πληρωμή',
        charge: 0,
        payment: p.amount,
      })
    }
    return list.sort((a, b) => a.date - b.date)
  }, [statements, payments, id])

  let running = 0
  const rows = txs.map((t) => {
    running = round2(running + t.charge - t.payment)
    return { ...t, running }
  })
  const balance = running

  if (!apt) return <div className="text-gray-500">Το διαμέρισμα δεν βρέθηκε.</div>

  return (
    <div>
      <button
        onClick={() => navigate('/apartments')}
        className="no-print mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={16} /> Διαμερίσματα
      </button>
      <PageHeader
        title={`Καρτέλα ${apt.code}`}
        subtitle={apt.ownerName}
        actions={
          <Badge color={balance > 0 ? 'red' : balance < 0 ? 'green' : 'gray'}>
            Υπόλοιπο: {money(balance)}
          </Badge>
        }
      />

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase text-gray-500">
              <th className="px-3 py-2">Ημ/νία</th>
              <th className="px-3 py-2">Κίνηση</th>
              <th className="px-3 py-2 text-right">Χρέωση</th>
              <th className="px-3 py-2 text-right">Πληρωμή</th>
              <th className="px-3 py-2 text-right">Υπόλοιπο</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-gray-400">
                  Καμία κίνηση ακόμη.
                </td>
              </tr>
            )}
            {rows.map((t, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="px-3 py-2 text-gray-500">{formatDate(new Date(t.date))}</td>
                <td className="px-3 py-2 text-gray-800">{t.label}</td>
                <td className="px-3 py-2 text-right tnum text-gray-700">{t.charge ? money(t.charge) : ''}</td>
                <td className="px-3 py-2 text-right tnum text-green-700">{t.payment ? money(t.payment) : ''}</td>
                <td className="px-3 py-2 text-right tnum font-medium">{money(t.running)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
