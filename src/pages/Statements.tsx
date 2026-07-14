import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileSpreadsheet, Plus, Trash2, ChevronRight } from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Button, Card, PageHeader, Field, TextField, Badge } from '@/components/forms'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { money, currentPeriod, formatPeriod, formatDate } from '@/lib/format'
import type { Expense, Statement } from '@/types'
import { GROUP_LABELS } from '@/types'
import { listStatements, createStatement, deleteStatement } from '@/lib/repos/statements'
import { listExpenses } from '@/lib/repos/expenses'
import { listPayments } from '@/lib/repos/payments'
import { computeStatement } from '@/lib/allocation'
import { balancesByApartment } from '@/lib/balances'
import { logAudit } from '@/lib/audit'

type Kind = 'period' | 'special'

export default function Statements() {
  const { building, apartments, refresh } = useAppData()
  const { isManager, user, profile } = useAuth()
  const navigate = useNavigate()
  const [statements, setStatements] = useState<Statement[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [kind, setKind] = useState<Kind>('period')
  const [fromP, setFromP] = useState(currentPeriod())
  const [toP, setToP] = useState(currentPeriod())
  const [periodLabel, setPeriodLabel] = useState('')
  const [allExpenses, setAllExpenses] = useState<Expense[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [toDelete, setToDelete] = useState<Statement | null>(null)

  async function load() {
    if (!building) return
    setStatements(await listStatements(building.id))
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building])

  function openNew() {
    setKind('period')
    setFromP(currentPeriod())
    setToP(currentPeriod())
    setPeriodLabel('')
    setSelectedIds(new Set())
    setModalOpen(true)
    if (building) void listExpenses(building.id).then(setAllExpenses)
  }

  // Έκτακτο: επιλογή μόνο από δαπάνες με χρέωση «Έκτακτη» (πιο πρόσφατες πρώτα).
  const pickable = useMemo(
    () =>
      allExpenses
        .filter((e) => e.chargeType === 'special')
        .sort((a, b) => (a.period < b.period ? 1 : -1)),
    [allExpenses],
  )

  function toggleExpense(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedTotal = pickable
    .filter((e) => selectedIds.has(e.id))
    .reduce((s, e) => s + (e.amount || 0), 0)

  async function generate() {
    if (!building) return
    setBusy(true)
    try {
      const [expenses, allStatements, payments] = await Promise.all([
        listExpenses(building.id),
        listStatements(building.id),
        listPayments(building.id),
      ])

      let selected: Expense[]
      let anchor: string
      let label: string
      let previousBalances: Record<string, number>
      let from: string | undefined
      let to: string | undefined

      if (kind === 'special') {
        selected = expenses.filter((e) => selectedIds.has(e.id))
        if (selected.length === 0) {
          setBusy(false)
          return
        }
        anchor = selected.reduce((m, e) => (e.period > m ? e.period : m), currentPeriod())
        label = periodLabel.trim() || 'Έκτακτη κατανομή'
        previousBalances = {} // έκτακτη: χωρίς μεταφορά προηγ. υπολοίπου
      } else {
        from = fromP <= toP ? fromP : toP
        to = fromP <= toP ? toP : fromP
        selected = expenses.filter(
          (e) => e.period >= from! && e.period <= to! && (e.chargeType ?? 'period') !== 'special',
        )
        anchor = to
        label = periodLabel.trim() || (from === to ? formatPeriod(from) : `${formatPeriod(from)} – ${formatPeriod(to)}`)
        const prior = allStatements.filter((s) => s.status === 'issued' && s.period < to!)
        previousBalances = balancesByApartment(prior, payments)
      }

      const { rows, totals, expenseLines } = computeStatement({
        building,
        apartments,
        expenses: selected,
        previousBalances,
      })
      const id = await createStatement({
        buildingId: building.id,
        buildingCode: building.code,
        buildingName: building.name,
        buildingAddress: building.address,
        managerName: building.managerName,
        period: anchor,
        periodLabel: label,
        kind,
        periodFrom: from,
        periodTo: to,
        status: 'draft',
        scales: building.scales,
        rows,
        totals,
        expenseLines,
      })
      await logAudit({
        buildingId: building.id,
        userEmail: user?.email ?? '',
        userName: profile?.name ?? user?.email ?? '',
        action: 'create',
        entity: 'statement',
        entityId: id,
        context: { kind, period: anchor, grandTotal: totals.grandTotal },
      })
      setModalOpen(false)
      await refresh()
      navigate(`/statements/${id}`)
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    if (!toDelete) return
    await deleteStatement(toDelete.id)
    setToDelete(null)
    await load()
  }

  const canGenerate = kind === 'special' ? selectedIds.size > 0 : true

  return (
    <div>
      <PageHeader
        title="Κοινόχρηστα — Εκδόσεις"
        subtitle="Έκδοση & εκτύπωση συγκεντρωτικής κατάστασης δαπανών"
        actions={
          isManager && (
            <Button onClick={openNew}>
              <Plus size={18} /> Νέα έκδοση
            </Button>
          )
        }
      />

      <Card className="p-0">
        {statements.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-gray-400">
            <FileSpreadsheet size={28} />
            <p className="text-sm">Δεν υπάρχουν εκδόσεις ακόμη.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {statements.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                <button
                  onClick={() => navigate(`/statements/${s.id}`)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-medium text-gray-900">
                      {s.periodLabel || formatPeriod(s.period)}
                      {s.kind === 'special' && <Badge color="blue">Έκτακτη</Badge>}
                    </div>
                    <div className="text-xs text-gray-500">έκδοση {formatDate(s.createdAt)}</div>
                  </div>
                  <div className="text-right">
                    <div className="tnum font-semibold text-gray-900">{money(s.totals.grandTotal)}</div>
                    <Badge color={s.status === 'issued' ? 'green' : 'amber'}>
                      {s.status === 'issued' ? 'Οριστική' : 'Πρόχειρη'}
                    </Badge>
                  </div>
                  <ChevronRight className="text-gray-300" size={18} />
                </button>
                {isManager && (
                  <button
                    onClick={() => setToDelete(s)}
                    className="rounded p-1 text-gray-300 hover:bg-gray-100 hover:text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Νέα έκδοση κοινοχρήστων"
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Ακύρωση
            </Button>
            <Button onClick={generate} disabled={busy || !canGenerate}>
              {busy ? 'Υπολογισμός…' : 'Δημιουργία'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {/* Τύπος */}
          <Field label="Τύπος">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1 text-sm">
              <button
                type="button"
                onClick={() => setKind('period')}
                className={`rounded-md py-1.5 font-medium ${kind === 'period' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
              >
                Περιόδου
              </button>
              <button
                type="button"
                onClick={() => setKind('special')}
                className={`rounded-md py-1.5 font-medium ${kind === 'special' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
              >
                Έκτακτο
              </button>
            </div>
          </Field>

          {kind === 'period' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Από" hint="Μήνας έναρξης.">
                <input
                  type="month"
                  value={fromP}
                  onChange={(e) => setFromP(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Έως" hint="Ίδιο με «Από» για μεμονωμένο μήνα.">
                <input
                  type="month"
                  value={toP}
                  onChange={(e) => setToP(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </Field>
            </div>
          ) : (
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">Δαπάνες προς κατανομή</span>
                <span className="tnum text-gray-500">
                  {selectedIds.size} επιλεγμένες · {money(selectedTotal)}
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto rounded-md border border-gray-200">
                {pickable.length === 0 ? (
                  <p className="px-3 py-4 text-center text-sm text-gray-400">
                    Καμία δαπάνη με χρέωση «Έκτακτη». Όρισέ το στη δαπάνη.
                  </p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {pickable.map((e) => (
                      <li key={e.id}>
                        <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50">
                          <input
                            type="checkbox"
                            className="h-4 w-4 shrink-0"
                            checked={selectedIds.has(e.id)}
                            onChange={() => toggleExpense(e.id)}
                          />
                          <span className="min-w-0 flex-1 truncate text-gray-800">{e.category}</span>
                          <span className="shrink-0 text-xs text-gray-400">
                            {GROUP_LABELS[e.group]} · {formatPeriod(e.period)}
                          </span>
                          <span className="tnum shrink-0 text-gray-600">{money(e.amount)}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Εμφανίζονται μόνο δαπάνες με χρέωση «Έκτακτη». Χωρίς μεταφορά προηγούμενου υπολοίπου.
              </p>
            </div>
          )}

          <Field label="Ετικέτα / τίτλος (προαιρετικό)" hint="π.χ. «Έκτακτη — Επισκευή στέγης» ή «1/6–31/12/2025»">
            <TextField
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              placeholder={kind === 'special' ? 'Έκτακτη κατανομή' : formatPeriod(toP)}
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        message={`Διαγραφή έκδοσης «${toDelete?.periodLabel || (toDelete ? formatPeriod(toDelete.period) : '')}»;`}
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
