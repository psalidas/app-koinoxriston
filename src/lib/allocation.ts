import type {
  Apartment,
  Building,
  Expense,
  ExpenseGroup,
  StatementExpenseLine,
  StatementRow,
  StatementTotals,
} from '@/types'
import { GROUP_ORDER } from '@/types'

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

interface ComputeInput {
  building: Building
  apartments: Apartment[]
  expenses: Expense[]
  /** apartmentId -> carried-over balance (positive = owes) */
  previousBalances?: Record<string, number>
}

export interface ComputeResult {
  rows: StatementRow[]
  totals: StatementTotals
  expenseLines: StatementExpenseLine[]
}

/**
 * Distribute a single expense across apartments, returning apartmentId -> share.
 * Reproduces the allocation logic of the paper "Συγκεντρωτική Κατάσταση Δαπανών".
 */
function distribute(
  expense: Expense,
  allApartments: Apartment[],
  building: Building,
): Record<string, number> {
  const out: Record<string, number> = {}
  // Συμμετέχοντα διαμερίσματα: αν οριστεί υποσύνολο, επιμερίζουμε μόνο σε αυτά
  // (τα βάρη/χιλιοστά αναπροσαρμόζονται αυτόματα αφού το σύνολο υπολογίζεται
  // πάνω στο υποσύνολο). Αν λείπει/κενό → όλα.
  const ids = expense.participantApartmentIds
  const apartments =
    Array.isArray(ids) && ids.length > 0
      ? allApartments.filter((a) => ids.includes(a.id))
      : allApartments
  const n = apartments.length
  if (n === 0 || !expense.amount) return out

  switch (expense.method) {
    case 'equal': {
      const share = expense.amount / n
      for (const a of apartments) out[a.id] = round2(share)
      return out
    }

    case 'fixedPerApartment': {
      // `amount` is the per-apartment charge.
      for (const a of apartments) out[a.id] = round2(expense.amount)
      return out
    }

    case 'heating': {
      // Distribute by the thermansi (or chosen) scale; closed apartments pay
      // only `heatingClosedPercent`% of their weight, the rest is absorbed by
      // the open apartments proportionally (smaller denominator).
      const key = expense.scaleKey ?? 'thermansi'
      const pct = clampPct(building.heatingClosedPercent) / 100
      const weights = apartments.map((a) => {
        const base = a.millesimes[key] ?? 0
        return a.closed ? base * pct : base
      })
      const total = weights.reduce((s, w) => s + w, 0)
      if (total <= 0) return out
      apartments.forEach((a, i) => {
        out[a.id] = round2((expense.amount * weights[i]) / total)
      })
      return out
    }

    case 'millesime':
    default: {
      const key = expense.scaleKey
      if (!key) return out
      const total = apartments.reduce((s, a) => s + (a.millesimes[key] ?? 0), 0)
      if (total <= 0) return out
      for (const a of apartments) {
        const w = a.millesimes[key] ?? 0
        out[a.id] = round2((expense.amount * w) / total)
      }
      return out
    }
  }
}

function clampPct(p: number): number {
  if (!Number.isFinite(p)) return 100
  return Math.max(0, Math.min(100, p))
}

export function computeStatement(input: ComputeInput): ComputeResult {
  const { building, apartments, expenses } = input
  const prev = input.previousBalances ?? {}

  // Per-apartment accumulation per group.
  const perApt: Record<string, Record<string, number>> = {}
  for (const a of apartments) perApt[a.id] = {}

  const byGroup: Record<string, number> = {}
  const expenseLines: StatementExpenseLine[] = []

  for (const exp of expenses) {
    // Η κατηγορία/στήλη καθορίζεται από την ΟΜΑΔΑ της δαπάνης
    // (Κοινόχρηστα, Ειδικές, Σε ίσα μέρη, Θέρμανση, Ασανσέρ, Ιδιοκτητών).
    const g = exp.group
    expenseLines.push({ group: g, category: exp.category, amount: exp.amount })
    byGroup[g] = round2((byGroup[g] ?? 0) + exp.amount)

    const shares = distribute(exp, apartments, building)
    for (const a of apartments) {
      const s = shares[a.id] ?? 0
      perApt[a.id][g] = round2((perApt[a.id][g] ?? 0) + s)
    }
  }

  const billingFee = building.billingFeePerApartment || 0

  const rows: StatementRow[] = apartments.map((a) => {
    const amounts = perApt[a.id]
    const groupsSum = GROUP_ORDER.reduce((s, g) => s + (amounts[g] ?? 0), 0)
    const currentCharge = round2(groupsSum + billingFee)
    const previousBalance = round2(prev[a.id] ?? 0)
    return {
      apartmentId: a.id,
      code: a.code,
      ownerName: a.ownerName,
      millesimes: { ...a.millesimes },
      amounts,
      billingFee,
      previousBalance,
      currentCharge,
      total: round2(previousBalance + currentCharge),
    }
  })

  const totals: StatementTotals = {
    byGroup,
    billingFees: round2(billingFee * apartments.length),
    grandTotal: round2(
      Object.values(byGroup).reduce((s, v) => s + v, 0) +
        billingFee * apartments.length,
    ),
  }

  return { rows, totals, expenseLines }
}

/** Groups that actually carry a value this period (for compact display). */
export function activeGroups(totals: StatementTotals): ExpenseGroup[] {
  return GROUP_ORDER.filter((g) => (totals.byGroup[g] ?? 0) !== 0)
}
