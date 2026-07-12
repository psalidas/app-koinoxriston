import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Pin } from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Button, Card, PageHeader, Field, TextField } from '@/components/forms'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { formatDate } from '@/lib/format'
import type { Announcement } from '@/types'
import {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from '@/lib/repos/announcements'
import { logAudit } from '@/lib/audit'

export default function Announcements() {
  const { building } = useAppData()
  const { isManager, user, profile } = useAuth()
  const [items, setItems] = useState<Announcement[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [form, setForm] = useState({ title: '', body: '', pinned: false })
  const [toDelete, setToDelete] = useState<Announcement | null>(null)

  async function load() {
    if (!building) return
    setItems(await listAnnouncements(building.id))
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building])

  function openNew() {
    setEditing(null)
    setForm({ title: '', body: '', pinned: false })
    setModalOpen(true)
  }

  function openEdit(a: Announcement) {
    setEditing(a)
    setForm({ title: a.title, body: a.body, pinned: !!a.pinned })
    setModalOpen(true)
  }

  async function save() {
    if (!building) return
    const data = {
      buildingId: building.id,
      title: form.title.trim(),
      body: form.body.trim(),
      pinned: form.pinned,
      authorName: profile?.name ?? user?.email ?? 'Διαχειριστής',
      createdBy: user?.email ?? undefined,
    }
    if (editing) await updateAnnouncement(editing.id, data)
    else await createAnnouncement(data)
    await logAudit({
      buildingId: building.id,
      userEmail: user?.email ?? '',
      userName: profile?.name ?? user?.email ?? '',
      action: editing ? 'update' : 'create',
      entity: 'announcement',
      entityId: editing?.id ?? data.title,
    })
    setModalOpen(false)
    await load()
  }

  async function confirmDelete() {
    if (!toDelete) return
    await deleteAnnouncement(toDelete.id)
    setToDelete(null)
    await load()
  }

  return (
    <div>
      <PageHeader
        title="Ανακοινώσεις"
        actions={
          isManager && (
            <Button onClick={openNew}>
              <Plus size={18} /> Νέα ανακοίνωση
            </Button>
          )
        }
      />

      {items.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-gray-400">Καμία ανακοίνωση.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <Card key={a.id}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="flex items-center gap-2 font-medium text-gray-900">
                  {a.pinned && <Pin size={14} className="text-amber-500" />}
                  {a.title}
                </h3>
                {isManager && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(a)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setToDelete(a)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{a.body}</p>
              <div className="mt-2 text-xs text-gray-400">
                {a.authorName} · {formatDate(a.createdAt)}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Επεξεργασία ανακοίνωσης' : 'Νέα ανακοίνωση'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Ακύρωση
            </Button>
            <Button onClick={save}>Αποθήκευση</Button>
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
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.pinned}
              onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
            />
            Καρφίτσωμα στην κορυφή
          </label>
        </div>
      </Modal>

      {isManager && (
        <ConfirmDialog
          open={!!toDelete}
          message={`Διαγραφή ανακοίνωσης «${toDelete?.title}»;`}
          onCancel={() => setToDelete(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  )
}
