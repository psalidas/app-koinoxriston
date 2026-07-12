import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, Trash2, Pin, Lock, Paperclip, Plus } from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Button, Card, Field, TextField, NumberField, Badge } from '@/components/forms'
import { Modal } from '@/components/Modal'
import { money, formatDateTime } from '@/lib/format'
import type { Comment, Offer, Topic } from '@/types'
import {
  getTopic,
  updateTopic,
  deleteTopic,
  listComments,
  createComment,
  deleteComment,
  listOffers,
  createOffer,
  deleteOffer,
} from '@/lib/repos/topics'
import { uploadReceipt } from '@/lib/upload'

export default function TopicView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { building } = useAppData()
  const { isManager, user, profile } = useAuth()
  const [topic, setTopic] = useState<Topic | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [offers, setOffers] = useState<Offer[]>([])
  const [text, setText] = useState('')
  const [offerOpen, setOfferOpen] = useState(false)
  const [offerForm, setOfferForm] = useState({ vendor: '', amount: 0, description: '' })
  const [offerFile, setOfferFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  const authorName = profile?.name ?? user?.email ?? 'Χρήστης'

  async function load() {
    if (!id) return
    const [t, c, o] = await Promise.all([getTopic(id), listComments(id), listOffers(id)])
    setTopic(t)
    setComments(c)
    setOffers(o)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function addComment() {
    if (!building || !id || !text.trim()) return
    await createComment({
      buildingId: building.id,
      topicId: id,
      body: text.trim(),
      authorName,
      createdBy: user?.email ?? undefined,
    })
    setText('')
    await load()
  }

  async function addOffer() {
    if (!building || !id) return
    setBusy(true)
    try {
      let f: { fileUrl?: string; filePath?: string; fileName?: string } = {}
      if (offerFile) {
        const up = await uploadReceipt(offerFile, building.id)
        f = { fileUrl: up.url, filePath: up.path, fileName: up.name }
      }
      await createOffer({
        buildingId: building.id,
        topicId: id,
        vendor: offerForm.vendor.trim(),
        amount: Number(offerForm.amount) || undefined,
        description: offerForm.description.trim() || undefined,
        authorName,
        createdBy: user?.email ?? undefined,
        ...f,
      })
      setOfferForm({ vendor: '', amount: 0, description: '' })
      setOfferFile(null)
      setOfferOpen(false)
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function togglePin() {
    if (!topic) return
    await updateTopic(topic.id, { pinned: !topic.pinned })
    await load()
  }
  async function toggleClose() {
    if (!topic) return
    await updateTopic(topic.id, { closed: !topic.closed })
    await load()
  }
  async function removeTopic() {
    if (!topic) return
    await deleteTopic(topic.id)
    navigate('/topics')
  }

  if (!topic) return <div className="text-gray-400">Φόρτωση…</div>

  return (
    <div className="mx-auto max-w-3xl">
      <button
        onClick={() => navigate('/topics')}
        className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={16} /> Συζήτηση
      </button>

      <Card>
        <div className="flex items-start justify-between gap-2">
          <h1 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            {topic.pinned && <Pin size={16} className="text-amber-500" />}
            {topic.closed && <Lock size={16} className="text-gray-400" />}
            {topic.title}
          </h1>
          {isManager && (
            <div className="flex gap-1">
              <button onClick={togglePin} className="rounded p-1 text-gray-400 hover:bg-gray-100" title="Καρφίτσωμα">
                <Pin size={16} />
              </button>
              <button onClick={toggleClose} className="rounded p-1 text-gray-400 hover:bg-gray-100" title="Κλείσιμο">
                <Lock size={16} />
              </button>
              <button onClick={removeTopic} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600">
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>
        {topic.body && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{topic.body}</p>}
        <div className="mt-2 text-xs text-gray-400">
          {topic.authorName} · {formatDateTime(topic.createdAt)}
        </div>
      </Card>

      {/* Offers */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Προσφορές</h2>
          <Button variant="secondary" onClick={() => setOfferOpen(true)}>
            <Plus size={16} /> Προσφορά
          </Button>
        </div>
        {offers.length === 0 ? (
          <p className="text-sm text-gray-400">Καμία προσφορά.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {offers.map((o) => (
              <Card key={o.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{o.vendor}</div>
                    {o.description && <div className="text-sm text-gray-600">{o.description}</div>}
                  </div>
                  {o.amount != null && <Badge color="blue">{money(o.amount)}</Badge>}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  {o.fileUrl ? (
                    <a
                      href={o.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <Paperclip size={12} /> {o.fileName ?? 'Αρχείο'}
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400">{o.authorName}</span>
                  )}
                  {isManager && (
                    <button
                      onClick={() => deleteOffer(o.id).then(load)}
                      className="text-gray-300 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Comments */}
      <div className="mt-4">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Σχόλια ({comments.length})</h2>
        <div className="space-y-2">
          {comments.map((c) => (
            <Card key={c.id} className="py-2">
              <div className="flex items-start justify-between gap-2">
                <p className="whitespace-pre-wrap text-sm text-gray-700">{c.body}</p>
                {isManager && (
                  <button
                    onClick={() => deleteComment(c.id).then(load)}
                    className="shrink-0 text-gray-300 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <div className="mt-1 text-xs text-gray-400">
                {c.authorName} · {formatDateTime(c.createdAt)}
              </div>
            </Card>
          ))}
        </div>

        {!topic.closed && (
          <div className="mt-3 flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addComment()}
              placeholder="Γράψτε σχόλιο…"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <Button onClick={addComment}>
              <Send size={16} />
            </Button>
          </div>
        )}
      </div>

      <Modal
        open={offerOpen}
        onClose={() => setOfferOpen(false)}
        title="Νέα προσφορά"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOfferOpen(false)}>
              Ακύρωση
            </Button>
            <Button onClick={addOffer} disabled={busy}>
              {busy ? 'Αποθήκευση…' : 'Αποθήκευση'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Πάροχος / Συνεργείο">
            <TextField value={offerForm.vendor} onChange={(e) => setOfferForm({ ...offerForm, vendor: e.target.value })} />
          </Field>
          <Field label="Ποσό (€)">
            <NumberField
              step="0.01"
              value={offerForm.amount}
              onChange={(e) => setOfferForm({ ...offerForm, amount: Number(e.target.value) })}
            />
          </Field>
          <Field label="Περιγραφή">
            <TextField
              value={offerForm.description}
              onChange={(e) => setOfferForm({ ...offerForm, description: e.target.value })}
            />
          </Field>
          <Field label="Αρχείο προσφοράς (PDF/εικόνα)">
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setOfferFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
            />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
