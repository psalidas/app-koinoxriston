import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Home, Megaphone, ChevronRight, Receipt } from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Card, PageHeader, Badge } from '@/components/forms'
import { money, formatPeriod, formatDate } from '@/lib/format'
import type { Announcement, Payment, Statement } from '@/types'
import { listStatements } from '@/lib/repos/statements'
import { listPayments } from '@/lib/repos/payments'
import { listAnnouncements } from '@/lib/repos/announcements'
import { ledgerFor, type LedgerRow } from '@/lib/balances'

interface AptView {
  id: string
  code: string
  ownerName: string
  balance: number
  rows: LedgerRow[]
  statements: Statement[]
}

export default function Portal() {
  const { building, apartments } = useAppData()
  const { profile, user } = useAuth()
  const [views, setViews] = useState<AptView[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  const myApartmentIds = profile?.apartmentIds ?? []

  useEffect(() => {
    if (!building) return
    void (async () => {
      setLoading(true)
      try {
        const [statements, payments, anns] = await Promise.all([
          listStatements(building.id),
          listPayments(building.id),
          listAnnouncements(building.id),
        ])
        const issued = statements.filter((s) => s.status === 'issued')
        const mine = apartments.filter((a) => myApartmentIds.includes(a.id))
        setViews(
          mine.map((a) => {
            const { rows, balance } = ledgerFor(a.id, issued, payments as Payment[], formatPeriod)
            return {
              id: a.id,
              code: a.code,
              ownerName: a.ownerName,
              balance,
              rows,
              statements: issued.filter((s) => s.rows.some((r) => r.apartmentId === a.id)),
            }
          }),
        )
        setAnnouncements(anns.slice(0, 3))
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building, apartments, profile])

  return (
    <div>
      <PageHeader
        title={`Καλώς ήρθατε${profile?.name ? ', ' + profile.name : ''}`}
        subtitle={building?.name}
      />

      {loading ? (
        <div className="text-gray-400">Φόρτωση…</div>
      ) : views.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-8 text-center text-gray-500">
            <Home className="text-gray-300" size={28} />
            <p className="text-sm">
              Δεν έχει συνδεθεί διαμέρισμα με τον λογαριασμό σας
              {user?.email ? ` (${user.email})` : ''}. Επικοινωνήστε με τον
              διαχειριστή.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {views.map((v) => (
            <div key={v.id}>
              <div className="mb-2 flex items-center justify-between rounded-lg bg-blue-600 px-4 py-3 text-white">
                <div>
                  <div className="text-xs opacity-80">Διαμέρισμα {v.code}</div>
                  <div className="font-semibold">{v.ownerName}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs opacity-80">Υπόλοιπο</div>
                  <div className="tnum text-xl font-bold">{money(v.balance)}</div>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <Card className="p-0">
                  <div className="border-b border-gray-100 px-4 py-2 text-sm font-semibold text-gray-700">
                    Κινήσεις
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full text-sm">
                      <tbody>
                        {v.rows.length === 0 && (
                          <tr>
                            <td className="px-4 py-6 text-center text-gray-400">Καμία κίνηση.</td>
                          </tr>
                        )}
                        {v.rows.map((t, i) => (
                          <tr key={i} className="border-t border-gray-50">
                            <td className="px-4 py-1.5 text-gray-500">{formatDate(new Date(t.date))}</td>
                            <td className="px-4 py-1.5 text-gray-700">{t.label}</td>
                            <td className="px-4 py-1.5 text-right tnum">
                              {t.charge ? (
                                <span className="text-gray-700">{money(t.charge)}</span>
                              ) : (
                                <span className="text-green-700">−{money(t.payment)}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                <Card className="p-0">
                  <div className="border-b border-gray-100 px-4 py-2 text-sm font-semibold text-gray-700">
                    Ειδοποιητήρια κοινοχρήστων
                  </div>
                  <ul className="divide-y divide-gray-50">
                    {v.statements.length === 0 && (
                      <li className="px-4 py-6 text-center text-sm text-gray-400">Κανένα ακόμη.</li>
                    )}
                    {v.statements.map((s) => {
                      const row = s.rows.find((r) => r.apartmentId === v.id)
                      return (
                        <li key={s.id}>
                          <Link
                            to={`/statements/${s.id}/notice/${v.id}`}
                            className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50"
                          >
                            <Receipt size={16} className="text-gray-400" />
                            <span className="flex-1 text-sm text-gray-800">{formatPeriod(s.period)}</span>
                            <span className="tnum text-sm font-medium">{money(row?.total ?? 0)}</span>
                            <ChevronRight size={16} className="text-gray-300" />
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </Card>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Announcements */}
      <div className="mt-6">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Megaphone size={16} /> Πρόσφατες ανακοινώσεις
        </h2>
        {announcements.length === 0 ? (
          <Card>
            <p className="py-4 text-center text-sm text-gray-400">Καμία ανακοίνωση.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {announcements.map((a) => (
              <Card key={a.id}>
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">{a.title}</h3>
                  {a.pinned && <Badge color="amber">Καρφιτσωμένο</Badge>}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{a.body}</p>
                <div className="mt-2 text-xs text-gray-400">
                  {a.authorName} · {formatDate(a.createdAt)}
                </div>
              </Card>
            ))}
            <Link to="/announcements" className="block text-center text-sm text-blue-600 hover:underline">
              Όλες οι ανακοινώσεις →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
