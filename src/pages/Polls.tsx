import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Vote as VoteIcon, ChevronRight } from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Button, Card, PageHeader, Badge } from '@/components/forms'
import { PollFormModal } from '@/components/PollFormModal'
import { formatDate } from '@/lib/format'
import type { Poll } from '@/types'
import { POLL_WEIGHT_LABELS } from '@/types'
import { listPolls } from '@/lib/repos/polls'

function statusBadge(status: Poll['status']) {
  if (status === 'open') return { color: 'green' as const, label: 'Ανοιχτή' }
  if (status === 'draft') return { color: 'amber' as const, label: 'Πρόχειρη' }
  return { color: 'gray' as const, label: 'Κλειστή' }
}

export default function Polls() {
  const { building, apartments } = useAppData()
  const { isManager } = useAuth()
  const [items, setItems] = useState<Poll[]>([])
  const [modalOpen, setModalOpen] = useState(false)

  async function load() {
    if (!building) return
    setItems(await listPolls(building.id))
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building])

  // Οι ένοικοι δεν βλέπουν πρόχειρες ψηφοφορίες.
  const visible = useMemo(
    () => (isManager ? items : items.filter((p) => p.status !== 'draft')),
    [items, isManager],
  )

  return (
    <div>
      <PageHeader
        title="Ψηφοφορίες"
        subtitle="Ηλεκτρονικές ψηφοφορίες με βάρος κατά χιλιοστά"
        actions={
          isManager && (
            <Button onClick={() => setModalOpen(true)}>
              <Plus size={18} /> Νέα ψηφοφορία
            </Button>
          )
        }
      />

      {visible.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-8 text-center text-gray-400">
            <VoteIcon size={28} />
            <p className="text-sm">Καμία ψηφοφορία.</p>
          </div>
        </Card>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-gray-100">
            {visible.map((p) => {
              const b = statusBadge(p.status)
              return (
                <li key={p.id}>
                  <Link to={`/polls/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-gray-900">{p.question}</div>
                      <div className="text-xs text-gray-500">
                        {POLL_WEIGHT_LABELS[p.weightMode]}
                        {p.deadline && ` · λήξη ${formatDate(p.deadline)}`}
                      </div>
                    </div>
                    <Badge color={b.color}>{b.label}</Badge>
                    <ChevronRight className="text-gray-300" size={18} />
                  </Link>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {building && (
        <PollFormModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          building={building}
          apartments={apartments}
          onSaved={load}
        />
      )}
    </div>
  )
}
