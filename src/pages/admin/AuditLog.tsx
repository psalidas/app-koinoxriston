import { useEffect, useMemo, useState } from 'react'
import { getDocs, query, where, orderBy, limit } from 'firebase/firestore'
import { ArrowUpDown, ArrowUp, ArrowDown, Search } from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { Card, PageHeader, Badge } from '@/components/forms'
import { col } from '@/lib/db'
import { formatDateTime } from '@/lib/format'
import type { AuditLogEntry } from '@/types'

const ACTION_COLOR: Record<string, 'green' | 'blue' | 'red' | 'amber' | 'gray' | 'purple'> = {
  create: 'green',
  update: 'blue',
  delete: 'red',
  import: 'amber',
  export: 'amber',
  login: 'purple',
}

const ACTION_LABEL: Record<string, string> = {
  create: 'Δημιουργία',
  update: 'Ενημέρωση',
  delete: 'Διαγραφή',
  import: 'Εισαγωγή',
  export: 'Εξαγωγή',
  login: 'Είσοδος',
}

const ENTITY_LABEL: Record<string, string> = {
  user: 'Χρήστης',
  settings: 'Ρυθμίσεις',
  work: 'Εργασία',
  contact: 'Επαφή',
  session: 'Συνεδρία',
  building: 'Κτίριο',
  apartment: 'Διαμέρισμα',
  expense: 'Δαπάνη',
  statement: 'Κοινόχρηστα',
  payment: 'Πληρωμή',
}

const actionLabel = (a: string) => ACTION_LABEL[a] ?? a
const entityLabel = (e: string) => ENTITY_LABEL[e] ?? e

type SortKey = 'timestamp' | 'user' | 'action' | 'entity'

export default function AuditLog() {
  const { building } = useAppData()
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)

  const [userFilter, setUserFilter] = useState<'all' | string>('all')
  const [actionFilter, setActionFilter] = useState<'all' | string>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('timestamp')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

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
            limit(500),
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

  // Λίστες για τα φίλτρα.
  const users = useMemo(() => {
    const map = new Map<string, string>()
    entries.forEach((e) => map.set(e.userEmail, e.userName || e.userEmail))
    return Array.from(map, ([email, name]) => ({ email, name })).sort((a, b) =>
      a.name.localeCompare(b.name, 'el'),
    )
  }, [entries])

  const actions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.action))).sort(),
    [entries],
  )

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const fromMs = from ? new Date(from + 'T00:00:00').getTime() : null
    const toMs = to ? new Date(to + 'T23:59:59').getTime() : null
    let list = entries.filter((e) => {
      if (userFilter !== 'all' && e.userEmail !== userFilter) return false
      if (actionFilter !== 'all' && e.action !== actionFilter) return false
      const ms = e.timestamp?.toMillis?.() ?? 0
      if (fromMs !== null && ms < fromMs) return false
      if (toMs !== null && ms > toMs) return false
      if (q) {
        const hay = [
          e.userName,
          e.userEmail,
          actionLabel(e.action),
          entityLabel(e.entity),
          e.entityId,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    const dir = sortDir === 'asc' ? 1 : -1
    list = [...list].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'timestamp') {
        cmp = (a.timestamp?.toMillis?.() ?? 0) - (b.timestamp?.toMillis?.() ?? 0)
      } else if (sortKey === 'user') {
        cmp = (a.userName || a.userEmail).localeCompare(b.userName || b.userEmail, 'el')
      } else if (sortKey === 'action') {
        cmp = actionLabel(a.action).localeCompare(actionLabel(b.action), 'el')
      } else {
        cmp = entityLabel(a.entity).localeCompare(entityLabel(b.entity), 'el')
      }
      return cmp * dir
    })
    return list
  }, [entries, userFilter, actionFilter, from, to, search, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'timestamp' ? 'desc' : 'asc')
    }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ArrowUpDown size={13} className="text-gray-300" />
    return sortDir === 'asc' ? (
      <ArrowUp size={13} className="text-blue-600" />
    ) : (
      <ArrowDown size={13} className="text-blue-600" />
    )
  }

  const Th = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th className="px-3 py-2">
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-gray-700">
        {children} <SortIcon k={k} />
      </button>
    </th>
  )

  function resetFilters() {
    setUserFilter('all')
    setActionFilter('all')
    setFrom('')
    setTo('')
    setSearch('')
  }

  const hasFilters = userFilter !== 'all' || actionFilter !== 'all' || !!from || !!to || !!search

  return (
    <div>
      <PageHeader
        title="Ιστορικό"
        subtitle="Καταγραφή ενεργειών & εισόδων χρηστών (audit log)"
      />

      <Card className="mb-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Αναζήτηση…"
              className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="all">Όλοι οι χρήστες</option>
            {users.map((u) => (
              <option key={u.email} value={u.email}>
                {u.name}
              </option>
            ))}
          </select>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="all">Όλες οι ενέργειες</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {actionLabel(a)}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
            />
            <span className="text-gray-400">–</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <span>{rows.length} εγγραφές</span>
          {hasFilters && (
            <button onClick={resetFilters} className="text-blue-600 hover:underline">
              Καθαρισμός φίλτρων
            </button>
          )}
        </div>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase text-gray-500">
              <Th k="timestamp">Ημ/νία</Th>
              <Th k="user">Χρήστης</Th>
              <Th k="action">Ενέργεια</Th>
              <Th k="entity">Οντότητα</Th>
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
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-gray-400">
                  {entries.length === 0 ? 'Καμία καταγραφή.' : 'Καμία εγγραφή με αυτά τα φίλτρα.'}
                </td>
              </tr>
            )}
            {rows.map((e) => (
              <tr key={e.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="whitespace-nowrap px-3 py-2 text-gray-500">{formatDateTime(e.timestamp)}</td>
                <td className="px-3 py-2 text-gray-700">{e.userName || e.userEmail}</td>
                <td className="px-3 py-2">
                  <Badge color={ACTION_COLOR[e.action] ?? 'gray'}>{actionLabel(e.action)}</Badge>
                </td>
                <td className="px-3 py-2 text-gray-600">
                  {entityLabel(e.entity)} · <span className="text-gray-400">{e.entityId}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
