import type { Payment, Statement } from '@/types'
import { round2 } from './allocation'

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
