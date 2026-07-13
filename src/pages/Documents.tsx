import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FolderPlus,
  Upload,
  Folder,
  FileText,
  ChevronRight,
  Home,
  Pencil,
  Trash2,
  Download,
} from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Button, Card, PageHeader, Field, TextField } from '@/components/forms'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { UploadProgress } from '@/components/UploadProgress'
import { formatDate } from '@/lib/format'
import type { DocEntry } from '@/types'
import {
  listDocEntries,
  createFolder,
  createFileEntry,
  renameDocEntry,
  deleteDocEntry,
} from '@/lib/repos/documents'
import { uploadDocument } from '@/lib/upload'
import { logAudit } from '@/lib/audit'

function formatBytes(n?: number): string {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export default function Documents() {
  const { building } = useAppData()
  const { isManager, user, profile } = useAuth()
  const [entries, setEntries] = useState<DocEntry[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [folderOpen, setFolderOpen] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [renaming, setRenaming] = useState<DocEntry | null>(null)
  const [renameName, setRenameName] = useState('')
  const [toDelete, setToDelete] = useState<DocEntry | null>(null)
  const [upload, setUpload] = useState<{ current: number; total: number; name: string; pct: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function load() {
    if (!building) return
    setLoading(true)
    try {
      setEntries(await listDocEntries(building.id))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setCurrentId(null)
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building])

  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries])

  // Breadcrumb from root to current folder.
  const trail = useMemo(() => {
    const path: DocEntry[] = []
    let cur = currentId ? byId.get(currentId) : undefined
    while (cur) {
      path.unshift(cur)
      cur = cur.parentId ? byId.get(cur.parentId) : undefined
    }
    return path
  }, [currentId, byId])

  const children = useMemo(() => {
    return entries
      .filter((e) => (e.parentId ?? null) === currentId)
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
        return a.name.localeCompare(b.name, 'el')
      })
  }, [entries, currentId])

  async function saveFolder() {
    if (!building || !folderName.trim()) return
    setBusy(true)
    try {
      await createFolder({
        buildingId: building.id,
        name: folderName.trim(),
        parentId: currentId,
        createdBy: user?.email ?? undefined,
      })
      await logAudit({
        buildingId: building.id,
        userEmail: user?.email ?? '',
        userName: profile?.name ?? user?.email ?? '',
        action: 'create',
        entity: 'document-folder',
        entityId: folderName.trim(),
      })
      setFolderName('')
      setFolderOpen(false)
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function onFilesChosen(files: FileList | null) {
    if (!building || !files || files.length === 0) return
    setError(null)
    setBusy(true)
    const list = Array.from(files)
    let done = 0
    try {
      for (const file of list) {
        setUpload({ current: done + 1, total: list.length, name: file.name, pct: 0 })
        const up = await uploadDocument(file, building.id, (pct) =>
          setUpload({ current: done + 1, total: list.length, name: file.name, pct }),
        )
        await createFileEntry({
          buildingId: building.id,
          name: file.name,
          parentId: currentId,
          url: up.url,
          path: up.path,
          size: file.size,
          contentType: file.type || undefined,
          createdBy: user?.email ?? undefined,
        })
        done++
      }
      await logAudit({
        buildingId: building.id,
        userEmail: user?.email ?? '',
        userName: profile?.name ?? user?.email ?? '',
        action: 'upload',
        entity: 'document',
        entityId: `${list.length} αρχείο(α)`,
      })
      await load()
    } catch (err) {
      setError(
        `Το ανέβασμα απέτυχε${done ? ` μετά από ${done} αρχείο(α)` : ''}: ${(err as Error).message}`,
      )
      await load()
    } finally {
      setBusy(false)
      setUpload(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function saveRename() {
    if (!renaming || !renameName.trim()) return
    setBusy(true)
    try {
      await renameDocEntry(renaming.id, renameName.trim())
      setRenaming(null)
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    if (!toDelete || !building) return
    setBusy(true)
    try {
      await deleteDocEntry(toDelete, entries)
      await logAudit({
        buildingId: building.id,
        userEmail: user?.email ?? '',
        userName: profile?.name ?? user?.email ?? '',
        action: 'delete',
        entity: toDelete.kind === 'folder' ? 'document-folder' : 'document',
        entityId: toDelete.name,
      })
      setToDelete(null)
      await load()
    } finally {
      setBusy(false)
    }
  }

  if (!building) {
    return (
      <div>
        <PageHeader title="Έγγραφα" subtitle="Έγγραφα πολυκατοικίας" />
        <Card>
          <p className="py-6 text-center text-sm text-gray-400">
            Δεν έχει επιλεγεί πολυκατοικία.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Έγγραφα"
        subtitle="Οικοδομική άδεια, κανονισμός & λοιπά έγγραφα της πολυκατοικίας"
        actions={
          isManager && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setFolderOpen(true)}>
                <FolderPlus size={18} /> Νέος φάκελος
              </Button>
              <Button onClick={() => fileInputRef.current?.click()} disabled={busy}>
                <Upload size={18} /> Ανέβασμα
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => onFilesChosen(e.target.files)}
              />
            </div>
          )
        }
      />

      {/* Breadcrumb */}
      <nav className="mb-3 flex flex-wrap items-center gap-1 text-sm text-gray-500">
        <button
          onClick={() => setCurrentId(null)}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-gray-100 hover:text-gray-700"
        >
          <Home size={14} /> Έγγραφα
        </button>
        {trail.map((f) => (
          <span key={f.id} className="inline-flex items-center gap-1">
            <ChevronRight size={14} className="text-gray-300" />
            <button
              onClick={() => setCurrentId(f.id)}
              className="rounded px-1.5 py-0.5 hover:bg-gray-100 hover:text-gray-700"
            >
              {f.name}
            </button>
          </span>
        ))}
      </nav>

      {upload && (
        <div className="mb-3">
          <UploadProgress
            value={upload.pct}
            label={
              upload.total > 1
                ? `Ανέβασμα ${upload.current}/${upload.total}: ${upload.name}`
                : `Ανέβασμα: ${upload.name}`
            }
          />
        </div>
      )}
      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card className="p-0">
        {loading ? (
          <p className="py-10 text-center text-sm text-gray-400">Φόρτωση…</p>
        ) : children.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-gray-400">
            <Folder size={28} />
            <p className="text-sm">Ο φάκελος είναι κενός.</p>
            {isManager && <p className="text-xs">Ανεβάστε αρχεία ή δημιουργήστε φάκελο.</p>}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {children.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                {e.kind === 'folder' ? (
                  <button
                    onClick={() => setCurrentId(e.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <Folder size={20} className="shrink-0 text-amber-500" />
                    <span className="truncate font-medium text-gray-800">{e.name}</span>
                  </button>
                ) : (
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <FileText size={20} className="shrink-0 text-blue-500" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-gray-800 hover:underline">
                        {e.name}
                      </span>
                      <span className="block text-xs text-gray-400">
                        {formatBytes(e.size)}
                        {e.size ? ' · ' : ''}
                        {formatDate(e.createdAt)}
                      </span>
                    </span>
                  </a>
                )}
                <div className="flex shrink-0 items-center gap-1">
                  {e.kind === 'file' && (
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                      title="Άνοιγμα / λήψη"
                    >
                      <Download size={16} />
                    </a>
                  )}
                  {isManager && (
                    <>
                      <button
                        onClick={() => {
                          setRenaming(e)
                          setRenameName(e.name)
                        }}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                        title="Μετονομασία"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => setToDelete(e)}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                        title="Διαγραφή"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* New folder */}
      <Modal
        open={folderOpen}
        onClose={() => setFolderOpen(false)}
        title="Νέος φάκελος"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFolderOpen(false)}>
              Ακύρωση
            </Button>
            <Button onClick={saveFolder} disabled={!folderName.trim() || busy}>
              Δημιουργία
            </Button>
          </>
        }
      >
        <Field label="Όνομα φακέλου">
          <TextField
            autoFocus
            placeholder="π.χ. Άδειες / Πιστοποιητικά"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveFolder()}
          />
        </Field>
      </Modal>

      {/* Rename */}
      <Modal
        open={!!renaming}
        onClose={() => setRenaming(null)}
        title="Μετονομασία"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenaming(null)}>
              Ακύρωση
            </Button>
            <Button onClick={saveRename} disabled={!renameName.trim() || busy}>
              Αποθήκευση
            </Button>
          </>
        }
      >
        <Field label="Όνομα">
          <TextField
            autoFocus
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveRename()}
          />
        </Field>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        message={
          toDelete?.kind === 'folder'
            ? `Διαγραφή φακέλου «${toDelete?.name}» και όλων των περιεχομένων του;`
            : `Διαγραφή αρχείου «${toDelete?.name}»;`
        }
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
