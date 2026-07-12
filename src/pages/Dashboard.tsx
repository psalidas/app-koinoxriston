import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Wallet, PiggyBank, AlertCircle, Database } from 'lucide-react'
import { useAppData } from '@/lib/appData'
import { useAuth } from '@/lib/auth'
import { Card, PageHeader, Button } from '@/components/forms'
import { money, formatPeriod, currentPeriod } from '@/lib/format'
import { listStatements } from '@/lib/repos/statements'
import { listPayments } from '@/lib/repos/payments'
import { listFundEntries, fundBalance } from '@/lib/repos/fund'
import { listExpenses } from '@/lib/repos/expenses'
import { listContracts, daysUntil } from '@/lib/repos/contracts'
import { balancesByApartment } from '@/lib/balances'
import { seedDemoBuilding } from '@/data/seed'
import type { Contract } from '@/types'
import { AlarmClock } from 'lucide-react'

export default function Dashboard() {
  const { building, apartments, configured, loading, refresh } = useAppData()
  const { isManager } = useAuth()
  const [owed, setOwed] = useState(0)
  const [fund, setFund] = useState(0)
  const [periodExpenses, setPeriodExpenses] = useState(0)
  const [expiring, setExpiring] = useState<Contract[]>([])
  const [seeding, setSeeding] = useState(false)

  useEffect(() => {
    if (!building) return
    void (async () => {
      const [statements, payments, fundEntries, expenses, contracts] = await Promise.all([
        listStatements(building.id),
        listPayments(building.id),
        listFundEntries(building.id),
        listExpenses(building.id, currentPeriod()),
        listContracts(building.id),
      ])
      const balances = balancesByApartment(statements, payments)
      setOwed(Object.values(balances).reduce((s, v) => s + (v > 0 ? v : 0), 0))
      setFund(fundBalance(fundEntries))
      setPeriodExpenses(expenses.reduce((s, e) => s + e.amount, 0))
      setExpiring(
        contracts.filter((c) => {
          const d = daysUntil(c)
          return d !== null && d <= (c.reminderDays ?? 30)
        }),
      )
    })()
  }, [building])

  async function seed() {
    setSeeding(true)
    try {
      await seedDemoBuilding()
      await refresh()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSeeding(false)
    }
  }

  if (!configured) {
    return (
      <Card>
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 shrink-0 text-amber-500" />
          <div>
            <h2 className="font-semibold text-gray-900">Απαιτείται ρύθμιση Firebase</h2>
            <p className="mt-1 text-sm text-gray-600">
              Συμπληρώστε το αρχείο <code>.env</code> με τα στοιχεία του Firebase
              project. Οδηγίες στο <code>docs/SETUP.md</code>.
            </p>
          </div>
        </div>
      </Card>
    )
  }

  if (!loading && !building) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Database className="text-gray-400" size={32} />
          <h2 className="font-semibold text-gray-900">Δεν υπάρχει πολυκατοικία ακόμη</h2>
          <p className="max-w-md text-sm text-gray-600">
            Δημιουργήστε την πρώτη πολυκατοικία με τα δεδομένα-δείγμα (Κ. Καραμανλή
            17, 15 διαμερίσματα με τα χιλιοστά τους και παράδειγμα δαπανών).
          </p>
          {isManager && (
            <Button onClick={seed} disabled={seeding}>
              {seeding ? 'Δημιουργία…' : 'Δημιουργία πολυκατοικίας-δείγματος'}
            </Button>
          )}
        </div>
      </Card>
    )
  }

  return (
    <div>
      <PageHeader
        title="Πίνακας ελέγχου"
        subtitle={building ? `${building.name} · ${building.area}` : undefined}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<Building2 />} label="Διαμερίσματα" value={String(apartments.length)} />
        <StatCard icon={<Wallet />} label="Συνολικές οφειλές" value={money(owed)} tone="red" />
        <StatCard icon={<PiggyBank />} label="Ταμείο / Αποθεματικό" value={money(fund)} tone="green" />
        <StatCard
          icon={<AlertCircle />}
          label={`Δαπάνες ${formatPeriod(currentPeriod())}`}
          value={money(periodExpenses)}
        />
      </div>

      {expiring.length > 0 && (
        <Card className="mt-4 border-amber-200 bg-amber-50">
          <div className="flex items-start gap-2">
            <AlarmClock className="mt-0.5 shrink-0 text-amber-600" size={18} />
            <div className="text-sm">
              <div className="font-medium text-amber-800">Συμβόλαια που λήγουν σύντομα</div>
              <ul className="mt-1 space-y-0.5 text-amber-700">
                {expiring.map((c) => {
                  const d = daysUntil(c) ?? 0
                  return (
                    <li key={c.id}>
                      <Link to="/contracts" className="hover:underline">
                        {c.title} — {d < 0 ? 'έληξε' : `σε ${d} ημέρες`}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <QuickLink to="/expenses" title="Καταχώρηση δαπανών" desc="Έξοδα του μήνα ανά κατηγορία" />
        <QuickLink to="/statements" title="Έκδοση κοινοχρήστων" desc="Επιμερισμός & εκτύπωση" />
        <QuickLink to="/payments" title="Καταχώρηση πληρωμών" desc="Εισπράξεις ανά διαμέρισμα" />
        <QuickLink to="/millesimes" title="Πίνακας χιλιοστών" desc="Προβολή & επεξεργασία" />
        <QuickLink to="/fund" title="Ταμείο" desc="Κινήσεις αποθεματικού" />
        <QuickLink to="/apartments" title="Διαμερίσματα" desc="Ιδιοκτήτες & καρτέλες" />
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  tone = 'blue',
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone?: 'blue' | 'red' | 'green'
}) {
  const toneCls = {
    blue: 'text-blue-600 bg-blue-50',
    red: 'text-red-600 bg-red-50',
    green: 'text-green-600 bg-green-50',
  }[tone]
  return (
    <Card className="flex items-center gap-3">
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${toneCls}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs text-gray-500">{label}</div>
        <div className="tnum truncate text-lg font-semibold text-gray-900">{value}</div>
      </div>
    </Card>
  )
}

function QuickLink({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <Link
      to={to}
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow"
    >
      <div className="font-medium text-gray-900">{title}</div>
      <div className="mt-0.5 text-sm text-gray-500">{desc}</div>
    </Link>
  )
}
