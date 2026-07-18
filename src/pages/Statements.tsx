import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileSpreadsheet, Plus, Trash2, ChevronRight } from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Button, Card, PageHeader, Field, TextField, Badge } from '@/components/forms'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { money, currentPeriod, formatPeriod, formatDate } from '@/lib/format'
import type { Statement } from '@/types'
import { listStatements, createStatement, deleteStatement } from '@/lib/repos/statements'
import { listExpenses } from '@/lib/repos/expenses'
import { listPayments } from '@/lib/repos/payments'
import { computeStatement } from '@/lib/allocation'
import { balancesByApartment } from '@/lib/balances'
import { logAudit } from '@/lib/audit'

export default function Statements() {
  const { building, apartments, refresh } = useAppData()
  const { isManager, user, profile } = useAuth()
  const navigate = useNavigate()
  const [statements, setStatements] = useState<Statement[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [fromP, setFromP] = useState(currentPeriod())
  const [toP, setToP] = useState(currentPeriod())
  const [periodLabel, setPeriodLabel] = useState('')
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
    setFromP(currentPeriod())
    setToP(currentPeriod())
    setPeriodLabel('')
    setModalOpen(true)
  }

  async function generate() {
    if (!building) return
    setBusy(true)
    try {
      const [expenses, allStatements, payments] = await Promise.all([
        listExpenses(building.id),
        listStatements(building.id),
        listPayments(building.id),
      ])

      const from = fromP <= toP ? fromP : toP
      const to = fromP <= toP ? toP : fromP
      // Όλες οι δαπάνες της περιόδου — οι «Έκτακτες» εμφανίζονται στη στήλη
      // «Ειδικές δαπάνες» της ίδιας κατάστασης.
      const selected = expenses.filter((e) => e.period >= from && e.period <= to)
      const anchor = to
      const label =
        periodLabel.trim() ||
        (from === to ? formatPeriod(from) : `${formatPeriod(from)} – ${formatPeriod(to)}`)
      const prior = allStatements.filter((s) => s.status === 'issued' && s.period < to)
      const previousBalances = balancesByApartment(prior, payments)

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
        kind: 'period',
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
        context: { period: anchor, grandTotal: totals.grandTotal },
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
            <Button onClick={generate} disabled={busy}>
              {busy ? 'Υπολογισμός…' : 'Δημιουργία'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
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

          <p className="rounded-md bg-blue-50 p-2 text-xs text-blue-700">
            Περιλαμβάνονται όλες οι δαπάνες της περιόδου. Όσες έχουν χρέωση «Έκτακτη»
            εμφανίζονται στη στήλη «Ειδικές δαπάνες» της κατάστασης.
          </p>

          <Field label="Ετικέτα / τίτλος (προαιρετικό)" hint="π.χ. «1/6–31/12/2025»">
            <TextField
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              placeholder={formatPeriod(toP)}
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
