import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Gavel, ChevronRight } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Button, Card, PageHeader, Field, TextField, Badge } from '@/components/forms'
import { Modal } from '@/components/Modal'
import { formatDate } from '@/lib/format'
import type { Assembly } from '@/types'
import { listAssemblies, createAssembly } from '@/lib/repos/assemblies'

export default function Assemblies() {
  const { building, apartments } = useAppData()
  const { isManager, user } = useAuth()
  const [items, setItems] = useState<Assembly[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ title: '', scheduledAt: '', invitation: '' })

  async function load() {
    if (!building) return
    setItems(await listAssemblies(building.id))
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building])

  async function save() {
    if (!building || !form.title.trim()) return
    const totalWeight = apartments.reduce((s, a) => s + (a.millesimes['genika'] ?? 0), 0)
    await createAssembly({
      buildingId: building.id,
      title: form.title.trim(),
      scheduledAt: form.scheduledAt ? Timestamp.fromDate(new Date(form.scheduledAt)) : undefined,
      invitation: form.invitation.trim() || undefined,
      status: 'planned',
      totalWeight,
      createdBy: user?.email ?? undefined,
    })
    setForm({ title: '', scheduledAt: '', invitation: '' })
    setModalOpen(false)
    await load()
  }

  return (
    <div>
      <PageHeader
        title="Γενικές Συνελεύσεις"
        subtitle="Προσκλήσεις, πρακτικά & αποφάσεις"
        actions={
          isManager && (
            <Button onClick={() => setModalOpen(true)}>
              <Plus size={18} /> Νέα συνέλευση
            </Button>
          )
        }
      />

      {items.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-8 text-center text-gray-400">
            <Gavel size={28} />
            <p className="text-sm">Καμία συνέλευση.</p>
          </div>
        </Card>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-gray-100">
            {items.map((a) => (
              <li key={a.id}>
                <Link to={`/assemblies/${a.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900">{a.title}</div>
                    <div className="text-xs text-gray-500">{formatDate(a.scheduledAt)}</div>
                  </div>
                  <Badge color={a.status === 'held' ? 'green' : 'amber'}>
                    {a.status === 'held' ? 'Πραγματοποιήθηκε' : 'Προγραμματισμένη'}
                  </Badge>
                  <ChevronRight className="text-gray-300" size={18} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Νέα συνέλευση"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Ακύρωση
            </Button>
            <Button onClick={save}>Δημιουργία</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Τίτλος">
            <TextField
              placeholder="π.χ. Τακτική Γενική Συνέλευση 2026"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <Field label="Ημερομηνία">
            <TextField
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
            />
          </Field>
          <Field label="Πρόσκληση / Ημερήσια διάταξη">
            <textarea
              rows={5}
              value={form.invitation}
              onChange={(e) => setForm({ ...form, invitation: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
