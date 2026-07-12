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
  const [period, setPeriod] = useState(currentPeriod())
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

  async function generate() {
    if (!building) return
    setBusy(true)
    try {
      const [expenses, allStatements, payments] = await Promise.all([
        listExpenses(building.id, period),
        listStatements(building.id),
        listPayments(building.id),
      ])
      const prior = allStatements.filter((s) => s.status === 'issued' && s.period < period)
      const previousBalances = balancesByApartment(prior, payments)
      const { rows, totals, expenseLines } = computeStatement({
        building,
        apartments,
        expenses,
        previousBalances,
      })
      const id = await createStatement({
        buildingId: building.id,
        buildingCode: building.code,
        buildingName: building.name,
        buildingAddress: building.address,
        managerName: building.managerName,
        period,
        periodLabel: periodLabel.trim() || formatPeriod(period),
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
        context: { period, grandTotal: totals.grandTotal },
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
            <Button onClick={() => setModalOpen(true)}>
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
                    <div className="font-medium text-gray-900">{formatPeriod(s.period)}</div>
                    <div className="text-xs text-gray-500">
                      {s.periodLabel} · έκδοση {formatDate(s.createdAt)}
                    </div>
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
          <Field label="Περίοδος" hint="Οι δαπάνες αυτής της περιόδου θα επιμεριστούν.">
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Ετικέτα περιόδου (προαιρετικό)" hint="π.χ. «1/6 έως 31/12/2025»">
            <TextField
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              placeholder={formatPeriod(period)}
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        message={`Διαγραφή έκδοσης ${toDelete ? formatPeriod(toDelete.period) : ''};`}
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
