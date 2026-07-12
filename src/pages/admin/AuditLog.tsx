import { useEffect, useState } from 'react'
import { getDocs, query, where, orderBy, limit } from 'firebase/firestore'
import { useAppData } from '@/lib/appData'
import { Card, PageHeader, Badge } from '@/components/forms'
import { col } from '@/lib/db'
import { formatDateTime } from '@/lib/format'
import type { AuditLogEntry } from '@/types'

const ACTION_COLOR: Record<string, 'green' | 'blue' | 'red' | 'amber' | 'gray'> = {
  create: 'green',
  update: 'blue',
  delete: 'red',
  import: 'amber',
  export: 'amber',
}

export default function AuditLog() {
  const { building } = useAppData()
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!building) return
    void (async () => {
      setLoading(true)
      try {
        const snap = await getDocs(
          query(
            col('auditLogs'),
            where('buildingId', '==', building.id),
            orderBy('timestamp', 'desc'),
            limit(200),
          ),
        )
        setEntries(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLogEntry, 'id'>) })))
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    })()
  }, [building])

  return (
    <div>
      <PageHeader title="Ιστορικό" subtitle="Καταγραφή ενεργειών (audit log)" />
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase text-gray-500">
              <th className="px-3 py-2">Ημ/νία</th>
              <th className="px-3 py-2">Χρήστης</th>
              <th className="px-3 py-2">Ενέργεια</th>
              <th className="px-3 py-2">Οντότητα</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-gray-400">
                  Φόρτωση…
                </td>
              </tr>
            )}
            {!loading && entries.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-gray-400">
                  Καμία καταγραφή.
                </td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-gray-100">
                <td className="whitespace-nowrap px-3 py-2 text-gray-500">{formatDateTime(e.timestamp)}</td>
                <td className="px-3 py-2 text-gray-700">{e.userName || e.userEmail}</td>
                <td className="px-3 py-2">
                  <Badge color={ACTION_COLOR[e.action] ?? 'gray'}>{e.action}</Badge>
                </td>
                <td className="px-3 py-2 text-gray-600">
                  {e.entity} · <span className="text-gray-400">{e.entityId}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
