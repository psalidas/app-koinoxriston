import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, MessageSquare, Pin, Lock, ChevronRight } from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Button, Card, PageHeader, Field, TextField } from '@/components/forms'
import { Modal } from '@/components/Modal'
import { formatDate } from '@/lib/format'
import type { Topic } from '@/types'
import { listTopics, createTopic } from '@/lib/repos/topics'

export default function Topics() {
  const { building } = useAppData()
  const { user, profile } = useAuth()
  const [items, setItems] = useState<Topic[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ title: '', body: '' })

  async function load() {
    if (!building) return
    setItems(await listTopics(building.id))
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building])

  async function save() {
    if (!building || !form.title.trim()) return
    await createTopic({
      buildingId: building.id,
      title: form.title.trim(),
      body: form.body.trim(),
      authorName: profile?.name ?? user?.email ?? 'Χρήστης',
      createdBy: user?.email ?? undefined,
    })
    setForm({ title: '', body: '' })
    setModalOpen(false)
    await load()
  }

  return (
    <div>
      <PageHeader
        title="Συζήτηση"
        subtitle="Θέματα, σχόλια και προσφορές για εργασίες"
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={18} /> Νέο θέμα
          </Button>
        }
      />

      {items.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-8 text-center text-gray-400">
            <MessageSquare size={28} />
            <p className="text-sm">Καμία συζήτηση ακόμη.</p>
          </div>
        </Card>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-gray-100">
            {items.map((t) => (
              <li key={t.id}>
                <Link to={`/topics/${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 font-medium text-gray-900">
                      {t.pinned && <Pin size={14} className="text-amber-500" />}
                      {t.closed && <Lock size={14} className="text-gray-400" />}
                      {t.title}
                    </div>
                    <div className="truncate text-xs text-gray-500">
                      {t.authorName} · {formatDate(t.createdAt)}
                    </div>
                  </div>
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
        title="Νέο θέμα συζήτησης"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Ακύρωση
            </Button>
            <Button onClick={save}>Δημοσίευση</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Τίτλος">
            <TextField value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Κείμενο">
            <textarea
              rows={5}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
