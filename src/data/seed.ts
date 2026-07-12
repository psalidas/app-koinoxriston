import type { Building, Expense, MillesimeScale } from '@/types'
import { saveBuilding } from '@/lib/repos/buildings'
import { setApartment } from '@/lib/repos/apartments'
import { createExpense } from '@/lib/repos/expenses'

export const SEED_BUILDING_ID = 'karamanli-17'

export const DEFAULT_SCALES: MillesimeScale[] = [
  { key: 'genika', label: 'Κοινόχρηστα / Γενικά' },
  { key: 'eidikes', label: 'Ειδικές δαπάνες' },
  { key: 'thermansi', label: 'Θέρμανση' },
  { key: 'asanser', label: 'Ασανσέρ' },
  { key: 'idioktiton', label: 'Ιδιοκτητών' },
]

const SEED_BUILDING: Omit<Building, 'id'> = {
  code: '000102',
  name: 'Πολυκατοικία Κ. Καραμανλή 17',
  address: 'Κ. Καραμανλή 17',
  area: 'Ξυλόκαστρο',
  managerName: 'Παρίδης Κων/νος',
  scales: DEFAULT_SCALES,
  billingFeePerApartment: 1,
  heatingClosedPercent: 100,
}

// [orderNo, code, owner, γενικά χιλιοστά, ασανσέρ χιλιοστά]
const APARTMENTS: [number, string, string, number, number][] = [
  [1, 'Α1', 'ΠΑΡΙΔΗΣ', 86, 62],
  [2, 'Α2', 'ΤΖΗΜΑΣ', 52, 37],
  [3, 'Α3', 'ΚΟΝΤΟΘΑΝΑΣΗΣ', 56, 40],
  [4, 'Α4', 'ΜΗΝΑΣ', 53, 38],
  [5, 'Β1-Β', 'ΑΡΣΛΑΝΟΓΛΟΥ', 110, 100],
  [6, 'Β3', 'ΑΘΑΝΑΣΟΠΟΥΛΟΣ ΔΗΜΗΤΡ', 84, 75],
  [7, 'Β4-Γ', 'ΝΕΑ ΑΤΤΙΚΑ ΑΚ/ΤΑ Α.Ε', 106, 106],
  [8, 'Γ1', 'ΜΑΥΡΟΓΙΑΝΝΗΣ', 100, 107],
  [9, 'Γ2-Γ', 'ΨΑΛΙΔΑΣ', 94, 103],
  [10, 'Δ1', 'ΕΥΑΓΓΕΛΟΥ', 86, 108],
  [11, 'Δ2-Ε', 'ΚΙΝΤΕΡΗΣ', 64, 87],
  [12, 'Δ3', 'ΛΕΥΚΑΡΗ', 56, 70],
  [13, 'Δ4', 'ΝΟΖΙΟΠΟΥΛΟΣ', 53, 67],
  [14, 'ΗΜ.', 'ΚΙΝΤΕΡΗΣ', 35, 28],
  [15, 'ΔΩΜΑ', 'ΚΙΝΤΕΡΗΣ', 25, 32],
]

// Example expenses matching the paper statement (period 1/6 → 31/12/2025).
const SEED_PERIOD = '2025-12'
const SEED_EXPENSES: Omit<Expense, 'id' | 'buildingId'>[] = [
  { period: SEED_PERIOD, group: 'koinoxrista', category: 'Συνεργείο καθαρισμού', amount: 600, method: 'millesime', scaleKey: 'genika' },
  { period: SEED_PERIOD, group: 'koinoxrista', category: 'ΔΕΗ κοινοχρήστων', amount: 310, method: 'millesime', scaleKey: 'genika' },
  { period: SEED_PERIOD, group: 'koinoxrista', category: 'ΙΚΑ καθαρίστριας', amount: 199.8, method: 'millesime', scaleKey: 'genika' },
  { period: SEED_PERIOD, group: 'koinoxrista', category: 'Διαχείριση', amount: 300, method: 'millesime', scaleKey: 'genika' },
  { period: SEED_PERIOD, group: 'koinoxrista', category: 'Πυροσβεστήρες', amount: 203.56, method: 'millesime', scaleKey: 'genika' },
  { period: SEED_PERIOD, group: 'koinoxrista', category: 'Πλακέτες κουδουνιών', amount: 50, method: 'millesime', scaleKey: 'genika' },
  { period: SEED_PERIOD, group: 'koinoxrista', category: 'Τοπ. μηχανισμού κεντ.', amount: 20, method: 'millesime', scaleKey: 'genika' },
  { period: SEED_PERIOD, group: 'koinoxrista', category: 'Λάμπες + υλικά καθ/μου', amount: 11, method: 'millesime', scaleKey: 'genika' },
  { period: SEED_PERIOD, group: 'asanser', category: 'Συντήρηση ασανσέρ', amount: 300, method: 'millesime', scaleKey: 'asanser' },
  { period: SEED_PERIOD, group: 'asanser', category: 'Εργασίες πιστοποίησης', amount: 250, method: 'millesime', scaleKey: 'asanser' },
]

export function aptId(orderNo: number): string {
  return `${SEED_BUILDING_ID}-apt-${String(orderNo).padStart(3, '0')}`
}

/**
 * Seed the demo building (Κ. Καραμανλή 17) with its 15 apartments, millesime
 * tables and the example expenses. Idempotent per apartment (uses stable ids).
 */
export async function seedDemoBuilding(withExpenses = true): Promise<void> {
  await saveBuilding(SEED_BUILDING_ID, SEED_BUILDING)

  for (const [orderNo, code, owner, genika, asanser] of APARTMENTS) {
    await setApartment(aptId(orderNo), {
      buildingId: SEED_BUILDING_ID,
      code,
      orderNo,
      ownerName: owner,
      millesimes: {
        genika,
        eidikes: genika,
        thermansi: genika,
        asanser,
        idioktiton: genika,
      },
    })
  }

  if (withExpenses) {
    for (const e of SEED_EXPENSES) {
      await createExpense({ ...e, buildingId: SEED_BUILDING_ID })
    }
  }
}
