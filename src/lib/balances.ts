import type { Payment, Statement } from '@/types'
import { round2 } from './allocation'

export interface LedgerRow {
  date: number
  label: string
  charge: number
  payment: number
  running: number
}

/** Chronological ledger for one apartment (issued statements + payments). */
export function ledgerFor(
  apartmentId: string,
  statements: Statement[],
  payments: Payment[],
  periodLabel: (period: string) => string,
): { rows: LedgerRow[]; balance: number } {
  const items: Omit<LedgerRow, 'running'>[] = []
  for (const s of statements) {
    if (s.status !== 'issued') continue
    const row = s.rows.find((r) => r.apartmentId === apartmentId)
    if (row) {
      items.push({
        date: s.issuedAt?.toMillis?.() ?? s.createdAt?.toMillis?.() ?? 0,
        label: `Κοινόχρηστα ${periodLabel(s.period)}`,
        charge: row.currentCharge,
        payment: 0,
      })
    }
  }
  for (const p of payments) {
    if (p.apartmentId !== apartmentId) continue
    items.push({
      date: p.date?.toMillis?.() ?? 0,
      label: 'Πληρωμή',
      charge: 0,
      payment: p.amount,
    })
  }
  items.sort((a, b) => a.date - b.date)
  let running = 0
  const rows = items.map((t) => {
    running = round2(running + t.charge - t.payment)
    return { ...t, running }
  })
  return { rows, balance: running }
}

/** Sum of charges billed to each apartment across issued statements. */
export function chargesByApartment(statements: Statement[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const st of statements) {
    if (st.status !== 'issued') continue
    for (const row of st.rows) {
      out[row.apartmentId] = round2((out[row.apartmentId] ?? 0) + row.currentCharge)
    }
  }
  return out
}

/** Sum of payments received per apartment. */
export function paymentsByApartment(payments: Payment[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const p of payments) {
    out[p.apartmentId] = round2((out[p.apartmentId] ?? 0) + p.amount)
  }
  return out
}

/** Balance per apartment: charges − payments (positive = owes). */
export function balancesByApartment(
  statements: Statement[],
  payments: Payment[],
): Record<string, number> {
  const charges = chargesByApartment(statements)
  const paid = paymentsByApartment(payments)
  const ids = new Set([...Object.keys(charges), ...Object.keys(paid)])
  const out: Record<string, number> = {}
  for (const id of ids) out[id] = round2((charges[id] ?? 0) - (paid[id] ?? 0))
  return out
}
