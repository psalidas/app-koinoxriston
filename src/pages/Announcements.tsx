import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Pin, Paperclip, X, Upload } from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Button, Card, PageHeader, Field, TextField } from '@/components/forms'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { formatDate } from '@/lib/format'
import type { Announcement, AnnouncementAttachment } from '@/types'
import {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from '@/lib/repos/announcements'
import { uploadDocument } from '@/lib/upload'
import { logAudit } from '@/lib/audit'

function isImage(a: AnnouncementAttachment): boolean {
  return (a.contentType ?? '').startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(a.name)
}

export default function Announcements() {
  const { building } = useAppData()
  const { isManager, user, profile } = useAuth()
  const [items, setItems] = useState<Announcement[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [form, setForm] = useState({ title: '', body: '', pinned: false })
  const [attachments, setAttachments] = useState<AnnouncementAttachment[]>([])
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
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
    setAttachments([])
    setNewFiles([])
    setModalOpen(true)
  }

  function openEdit(a: Announcement) {
    setEditing(a)
    setForm({ title: a.title, body: a.body, pinned: !!a.pinned })
    setAttachments(a.attachments ?? [])
    setNewFiles([])
    setModalOpen(true)
  }

  async function save() {
    if (!building || saving) return
    setSaving(true)
    try {
      const uploaded: AnnouncementAttachment[] = []
      for (const f of newFiles) {
        const up = await uploadDocument(f, building.id)
        uploaded.push({ url: up.url, name: up.name, path: up.path, contentType: f.type || '' })
      }
      const data = {
        buildingId: building.id,
        title: form.title.trim(),
        body: form.body.trim(),
        pinned: form.pinned,
        attachments: [...attachments, ...uploaded],
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
    } finally {
      setSaving(false)
    }
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
              {a.attachments && a.attachments.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {a.attachments.map((f, i) =>
                    isImage(f) ? (
                      <a key={i} href={f.url} target="_blank" rel="noreferrer" title={f.name}>
                        <img
                          src={f.url}
                          alt={f.name}
                          className="h-20 w-20 rounded-md border border-gray-200 object-cover hover:opacity-90"
                        />
                      </a>
                    ) : (
                      <a
                        key={i}
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex max-w-[12rem] items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700 hover:border-blue-300 hover:text-blue-700"
                      >
                        <Paperclip size={13} className="shrink-0" />
                        <span className="truncate">{f.name}</span>
                      </a>
                    ),
                  )}
                </div>
              )}
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
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Ακύρωση
            </Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Αποθήκευση…' : 'Αποθήκευση'}</Button>
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

          <Field label="Επισυναπτόμενα (φωτογραφίες & έγγραφα)">
            <div className="space-y-2">
              {(attachments.length > 0 || newFiles.length > 0) && (
                <ul className="space-y-1">
                  {attachments.map((f, i) => (
                    <li key={`a${i}`} className="flex items-center gap-2 rounded-md border border-gray-200 px-2 py-1 text-sm">
                      <Paperclip size={14} className="shrink-0 text-gray-400" />
                      <a href={f.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-blue-600 hover:underline">{f.name}</a>
                      <button
                        onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                        className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                        title="Αφαίρεση"
                      >
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                  {newFiles.map((f, i) => (
                    <li key={`n${i}`} className="flex items-center gap-2 rounded-md border border-dashed border-gray-300 px-2 py-1 text-sm">
                      <Upload size={14} className="shrink-0 text-blue-400" />
                      <span className="min-w-0 flex-1 truncate text-gray-700">{f.name}</span>
                      <span className="shrink-0 text-xs text-gray-400">νέο</span>
                      <button
                        onClick={() => setNewFiles((prev) => prev.filter((_, idx) => idx !== i))}
                        className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                        title="Αφαίρεση"
                      >
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                  onChange={(e) => {
                    const fs = Array.from(e.target.files ?? [])
                    if (fs.length) setNewFiles((prev) => [...prev, ...fs])
                    e.target.value = ''
                  }}
                />
                <Plus size={16} /> Προσθήκη αρχείων
              </label>
            </div>
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
