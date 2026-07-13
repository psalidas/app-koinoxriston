import { useEffect, useMemo, useState } from 'react'
import { Phone, Smartphone, Mail, Building2, StickyNote } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useAppData } from '@/lib/appData'
import { Card, PageHeader, Badge } from '@/components/forms'
import { ROLE_LABELS, type Role } from '@/types'
import { listDirectory, listProfiles } from '@/lib/repos/directory'
import { listUsers } from '@/lib/repos/users'
import { compareEl } from '@/lib/format'

interface Row {
  identifier: string
  name?: string
  role: Role
  apartmentCodes: string[]
  phone?: string
  mobile?: string
  email?: string
  note?: string
}

export default function Directory() {
  const { isManager } = useAuth()
  const { apartments } = useAppData()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  const codesOf = useMemo(() => {
    const m = new Map(apartments.map((a) => [a.id, a.code]))
    return (ids: string[]) => ids.map((id) => m.get(id)).filter((c): c is string => !!c)
  }, [apartments])

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        let next: Row[]
        if (isManager) {
          // Πλήρης προβολή: όλοι οι χρήστες + πλήρη στοιχεία επικοινωνίας.
          const [users, profiles] = await Promise.all([listUsers(), listProfiles()])
          const pById = new Map(profiles.map((p) => [p.identifier, p]))
          next = users.map((u) => {
            const p = pById.get(u.email)
            return {
              identifier: u.email,
              name: p?.displayName || u.name || u.email,
              role: u.role,
              apartmentCodes: codesOf(u.apartmentIds ?? []),
              phone: p?.phone,
              mobile: p?.mobile,
              email: p?.email,
              note: p?.note,
            }
          })
        } else {
          // Φιλτραρισμένος κατάλογος (μόνο ό,τι επέλεξε ο καθένας).
          const dir = await listDirectory()
          next = dir.map((d) => ({
            identifier: d.identifier,
            name: d.name,
            role: d.role,
            apartmentCodes: d.apartmentCodes ?? [],
            phone: d.phone,
            mobile: d.mobile,
            email: d.email,
            note: d.note,
          }))
        }
        next.sort((a, b) => compareEl(a.name || a.identifier, b.name || b.identifier))
        setRows(next)
      } finally {
        setLoading(false)
      }
    })()
  }, [isManager, codesOf])

  return (
    <div>
      <PageHeader
        title="Κατάλογος"
        subtitle={
          isManager
            ? 'Ιδιοκτήτες & ένοικοι — πλήρη στοιχεία (προβολή διαχειριστή)'
            : 'Ιδιοκτήτες & ένοικοι — όσα στοιχεία επέλεξε ο καθένας'
        }
      />

      {loading ? (
        <Card>
          <p className="py-8 text-center text-sm text-gray-400">Φόρτωση…</p>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-gray-400">Ο κατάλογος είναι κενός.</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((r) => (
            <Card key={r.identifier}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-gray-900">{r.name || '—'}</div>
                  {r.apartmentCodes.length > 0 && (
                    <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-gray-500">
                      <Building2 size={13} /> {r.apartmentCodes.join(', ')}
                    </div>
                  )}
                </div>
                <Badge color={r.role === 'owner' ? 'blue' : 'gray'}>{ROLE_LABELS[r.role]}</Badge>
              </div>

              <div className="mt-2 space-y-1 text-sm">
                <ContactLine icon={<Phone size={14} />} value={r.phone} href={r.phone ? `tel:${r.phone}` : undefined} />
                <ContactLine icon={<Smartphone size={14} />} value={r.mobile} href={r.mobile ? `tel:${r.mobile}` : undefined} />
                <ContactLine icon={<Mail size={14} />} value={r.email} href={r.email ? `mailto:${r.email}` : undefined} />
                <ContactLine icon={<StickyNote size={14} />} value={r.note} />
              </div>

              {isManager && (
                <div className="mt-2 border-t border-gray-100 pt-2 text-xs text-gray-400">
                  Είσοδος: {r.identifier}
                </div>
              )}

              {!r.phone && !r.mobile && !r.email && !r.note && (
                <p className="mt-2 text-xs text-gray-400">Δεν έχει δημοσιεύσει στοιχεία επικοινωνίας.</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function ContactLine({ icon, value, href }: { icon: React.ReactNode; value?: string; href?: string }) {
  if (!value) return null
  return (
    <div className="flex items-center gap-2 text-gray-700">
      <span className="text-gray-400">{icon}</span>
      {href ? (
        <a href={href} className="text-blue-600 hover:underline">
          {value}
        </a>
      ) : (
        <span>{value}</span>
      )}
    </div>
  )
}
