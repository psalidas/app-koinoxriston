import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Pin, Paperclip, X, Upload, MessageSquarePlus, Send } from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Button, Card, PageHeader, Field, TextField } from '@/components/forms'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { formatDate, formatDateTime } from '@/lib/format'
import type { Announcement, AnnouncementAttachment, AnnouncementComment } from '@/types'
import {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from '@/lib/repos/announcements'
import {
  listAnnouncementComments,
  createAnnouncementComment,
  deleteAnnouncementComment,
} from '@/lib/repos/announcementComments'
import { uploadDocument } from '@/lib/upload'
import { logAudit } from '@/lib/audit'

function isImage(a: AnnouncementAttachment): boolean {
  return (a.contentType ?? '').startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(a.name)
}

export default function Announcements() {
  const { building } = useAppData()
  const { isManager, user, profile, authIdentifier } = useAuth()
  const [items, setItems] = useState<Announcement[]>([])
  const [comments, setComments] = useState<AnnouncementComment[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [form, setForm] = useState({ title: '', body: '', pinned: false })
  const [attachments, setAttachments] = useState<AnnouncementAttachment[]>([])
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState<Announcement | null>(null)
  // Σύνθεση σχολίου ανά ανακοίνωση
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [posting, setPosting] = useState<string | null>(null)
  const [commentToDelete, setCommentToDelete] = useState<AnnouncementComment | null>(null)

  const commentsByAnn = useMemo(() => {
    const m: Record<string, AnnouncementComment[]> = {}
    for (const c of comments) (m[c.announcementId] ??= []).push(c)
    return m
  }, [comments])

  async function load() {
    if (!building) return
    const [anns, cmts] = await Promise.all([
      listAnnouncements(building.id),
      listAnnouncementComments(building.id),
    ])
    setItems(anns)
    setComments(cmts)
  }

  async function postComment(a: Announcement) {
    if (!building) return
    const body = (draft[a.id] ?? '').trim()
    if (!body) return
    setPosting(a.id)
    try {
      await createAnnouncementComment({
        buildingId: building.id,
        announcementId: a.id,
        body,
        authorName: profile?.name ?? user?.email ?? 'Μέλος',
        createdBy: authIdentifier ?? user?.email ?? undefined,
      })
      setDraft((d) => ({ ...d, [a.id]: '' }))
      await load()
    } finally {
      setPosting(null)
    }
  }

  async function confirmDeleteComment() {
    if (!commentToDelete) return
    await deleteAnnouncementComment(commentToDelete.id)
    setCommentToDelete(null)
    await load()
  }

  const canDeleteComment = (c: AnnouncementComment) =>
    isManager || (!!authIdentifier && c.createdBy === authIdentifier) || (!!user?.email && c.createdBy === user.email)

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

              {/* Σχόλια / πρόσθετα σημεία */}
              <div className="mt-3 border-t border-gray-100 pt-3">
                {(commentsByAnn[a.id]?.length ?? 0) > 0 && (
                  <ul className="space-y-2">
                    {commentsByAnn[a.id].map((c) => (
                      <li key={c.id} className="rounded-md bg-gray-50 px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="whitespace-pre-wrap text-sm text-gray-700">{c.body}</p>
                          {canDeleteComment(c) && (
                            <button
                              onClick={() => setCommentToDelete(c)}
                              className="shrink-0 rounded p-0.5 text-gray-300 hover:bg-gray-100 hover:text-red-600"
                              title="Διαγραφή σχολίου"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                        <div className="mt-1 text-[11px] text-gray-400">
                          {c.authorName} · {formatDateTime(c.createdAt)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-2 flex items-start gap-2">
                  <MessageSquarePlus size={16} className="mt-2 shrink-0 text-gray-400" />
                  <textarea
                    rows={1}
                    value={draft[a.id] ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, [a.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void postComment(a)
                    }}
                    placeholder="Προσθήκη σχολίου ή πρόσθετου σημείου…"
                    className="min-h-[2.25rem] w-full resize-y rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <Button
                    onClick={() => void postComment(a)}
                    disabled={posting === a.id || !(draft[a.id] ?? '').trim()}
                    className="shrink-0"
                  >
                    <Send size={15} /> {posting === a.id ? '…' : 'Σχόλιο'}
                  </Button>
                </div>
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

      <ConfirmDialog
        open={!!commentToDelete}
        message="Διαγραφή σχολίου;"
        onCancel={() => setCommentToDelete(null)}
        onConfirm={confirmDeleteComment}
      />
    </div>
  )
}
