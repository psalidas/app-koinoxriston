import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Phone, Search, ArrowUpDown, ArrowUp, ArrowDown, ExternalLink } from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Button, Card, PageHeader, Field, TextField, SelectField, Badge } from '@/components/forms'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { ContactEntry } from '@/types'
import { CONTACT_CATEGORIES } from '@/types'
import { listContacts, createContact, updateContact, deleteContact } from '@/lib/repos/contacts'
import { logAudit } from '@/lib/audit'

type SortKey = 'name' | 'category' | 'phone'

const blankForm = () => ({
  name: '',
  category: CONTACT_CATEGORIES[0] as string,
  phone: '',
  phone2: '',
  email: '',
  link: '',
  note: '',
})

/** Εξασφαλίζει ότι ο σύνδεσμος έχει σχήμα (https://) για σωστό href. */
function normalizeUrl(u: string): string {
  const t = u.trim()
  if (!t) return ''
  return /^https?:\/\//i.test(t) ? t : `https://${t}`
}

export default function Contacts() {
  const { building } = useAppData()
  const { isManager, user, profile } = useAuth()
  const [items, setItems] = useState<ContactEntry[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState<'all' | string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('category')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ContactEntry | null>(null)
  const [form, setForm] = useState(blankForm())
  const [toDelete, setToDelete] = useState<ContactEntry | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    if (!building) return
    setLoading(true)
    try {
      setItems(await listContacts(building.id))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building])

  // Κατηγορίες που υπάρχουν πραγματικά (για το φίλτρο).
  const usedCategories = useMemo(
    () => Array.from(new Set(items.map((c) => c.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'el')),
    [items],
  )

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = items
    if (catFilter !== 'all') list = list.filter((c) => c.category === catFilter)
    if (q) {
      list = list.filter((c) =>
        [c.name, c.category, c.phone, c.phone2, c.email, c.link, c.note]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(q)),
      )
    }
    const dir = sortDir === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      const av = (a[sortKey] ?? '') as string
      const bv = (b[sortKey] ?? '') as string
      const cmp = av.localeCompare(bv, 'el', { numeric: true })
      // Δευτερεύουσα ταξινόμηση κατά όνομα όταν ταξινομούμε κατά κατηγορία.
      return cmp !== 0 ? cmp * dir : a.name.localeCompare(b.name, 'el')
    })
  }, [items, search, catFilter, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function openNew() {
    setEditing(null)
    setForm(blankForm())
    setModalOpen(true)
  }

  function openEdit(c: ContactEntry) {
    setEditing(c)
    setForm({
      name: c.name,
      category: c.category || CONTACT_CATEGORIES[0],
      phone: c.phone ?? '',
      phone2: c.phone2 ?? '',
      email: c.email ?? '',
      link: c.link ?? '',
      note: c.note ?? '',
    })
    setModalOpen(true)
  }

  async function save() {
    if (!building || !form.name.trim() || !form.phone.trim()) return
    setBusy(true)
    try {
      const data = {
        buildingId: building.id,
        name: form.name.trim(),
        category: form.category,
        phone: form.phone.trim(),
        phone2: form.phone2.trim() || undefined,
        email: form.email.trim() || undefined,
        link: normalizeUrl(form.link) || undefined,
        note: form.note.trim() || undefined,
      }
      if (editing) await updateContact(editing.id, data)
      else await createContact({ ...data, createdBy: user?.email ?? undefined })
      await logAudit({
        buildingId: building.id,
        userEmail: user?.email ?? '',
        userName: profile?.name ?? user?.email ?? '',
        action: editing ? 'update' : 'create',
        entity: 'contact',
        entityId: editing?.id ?? form.name.trim(),
      })
      setModalOpen(false)
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    if (!toDelete) return
    await deleteContact(toDelete.id)
    setToDelete(null)
    await load()
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ArrowUpDown size={13} className="text-gray-300" />
    return sortDir === 'asc' ? <ArrowUp size={13} className="text-blue-600" /> : <ArrowDown size={13} className="text-blue-600" />
  }

  return (
    <div>
      <PageHeader
        title="Τηλέφωνα"
        subtitle="Χρήσιμες επαφές — συνεργεία, υπηρεσίες, έκτακτης ανάγκης"
        actions={
          isManager && (
            <Button onClick={openNew}>
              <Plus size={18} /> Νέα επαφή
            </Button>
          )
        }
      />

      <Card className="mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Αναζήτηση (όνομα, τηλέφωνο, σημείωση…)"
              className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="all">Όλες οι κατηγορίες</option>
            {usedCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase text-gray-500">
              <th className="px-3 py-2">
                <button onClick={() => toggleSort('name')} className="inline-flex items-center gap-1 hover:text-gray-700">
                  Όνομα <SortIcon k="name" />
                </button>
              </th>
              <th className="px-3 py-2">
                <button onClick={() => toggleSort('category')} className="inline-flex items-center gap-1 hover:text-gray-700">
                  Κατηγορία <SortIcon k="category" />
                </button>
              </th>
              <th className="px-3 py-2">
                <button onClick={() => toggleSort('phone')} className="inline-flex items-center gap-1 hover:text-gray-700">
                  Τηλέφωνο <SortIcon k="phone" />
                </button>
              </th>
              <th className="px-3 py-2">Σημείωση</th>
              {isManager && <th className="px-3 py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={isManager ? 5 : 4} className="px-3 py-8 text-center text-gray-400">
                  Φόρτωση…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={isManager ? 5 : 4} className="px-3 py-8 text-center text-gray-400">
                  {items.length === 0 ? 'Δεν υπάρχουν επαφές ακόμη.' : 'Καμία επαφή με αυτά τα κριτήρια.'}
                </td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900">{c.name}</div>
                    {c.email && <div className="text-xs text-gray-400">{c.email}</div>}
                    {c.link && (
                      <a
                        href={c.link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        <ExternalLink size={12} /> Σύνδεσμος
                      </a>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Badge color="gray">{c.category}</Badge>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1.5 font-medium text-blue-600 hover:underline">
                      <Phone size={14} /> {c.phone}
                    </a>
                    {c.phone2 && (
                      <a href={`tel:${c.phone2}`} className="ml-2 text-gray-500 hover:underline">
                        {c.phone2}
                      </a>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{c.note || '—'}</td>
                  {isManager && (
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(c)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => setToDelete(c)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Επεξεργασία επαφής' : 'Νέα επαφή'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Ακύρωση
            </Button>
            <Button onClick={save} disabled={busy || !form.name.trim() || !form.phone.trim()}>
              Αποθήκευση
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Όνομα / επωνυμία">
            <TextField value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Κατηγορία">
            <SelectField value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CONTACT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectField>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Τηλέφωνο">
              <TextField type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="2ο τηλέφωνο (προαιρετικό)">
              <TextField type="tel" value={form.phone2} onChange={(e) => setForm({ ...form, phone2: e.target.value })} />
            </Field>
          </div>
          <Field label="Email (προαιρετικό)">
            <TextField type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Σύνδεσμος (προαιρετικό)" hint="Ιστότοπος ή σελίδα — π.χ. www.example.gr">
            <TextField
              type="url"
              placeholder="https://…"
              value={form.link}
              onChange={(e) => setForm({ ...form, link: e.target.value })}
            />
          </Field>
          <Field label="Σημείωση (προαιρετικό)">
            <textarea
              rows={2}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        message={`Διαγραφή επαφής «${toDelete?.name}»;`}
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
