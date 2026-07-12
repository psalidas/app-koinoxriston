import type { Timestamp } from 'firebase/firestore'

// ── Users & access ──────────────────────────────────────────────────────────

export type Role = 'admin' | 'manager' | 'owner' | 'resident'

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Διαχειριστής (πλήρης)',
  manager: 'Διαχειριστής',
  owner: 'Ιδιοκτήτης',
  resident: 'Ένοικος',
}

export interface UserDoc {
  email: string
  name: string
  role: Role
  phone?: string
  buildingIds: string[]
  apartmentIds: string[]
  active: boolean
  createdAt?: Timestamp
}

// ── Buildings, apartments, people ────────────────────────────────────────────

/** A millesime (χιλιοστά) scale defined on a building. Editable/extensible. */
export interface MillesimeScale {
  key: string // stable id, e.g. 'genika', 'asanser'
  label: string // display, e.g. 'Κοινόχρηστα / Γενικά'
}

export interface Building {
  id: string
  code: string // e.g. '000102'
  name: string
  address: string
  area: string // περιοχή
  managerName: string
  iban?: string
  afm?: string
  /** Editable millesime tables. Each apartment carries a value per scale. */
  scales: MillesimeScale[]
  /** Έκδοση λογαριασμών: fixed fee charged per apartment each period. */
  billingFeePerApartment: number
  /** Κλειστά %: share of heating a closed apartment still pays (0–100). */
  heatingClosedPercent: number
  createdAt?: Timestamp
}

export interface Apartment {
  id: string
  buildingId: string
  code: string // Α1, Β1-Β, ΗΜ., ΔΩΜΑ
  orderNo: number // Α/Α (1..N)
  floor?: string
  ownerName: string
  ownerId?: string
  tenantName?: string
  tenantId?: string
  /** scaleKey -> χιλιοστά value */
  millesimes: Record<string, number>
  closed?: boolean
  createdAt?: Timestamp
}

export interface Person {
  id: string
  buildingId: string
  name: string
  kind: 'owner' | 'tenant'
  email?: string
  phone?: string
  apartmentIds: string[]
  notes?: string
  createdAt?: Timestamp
}

// ── Expenses & allocation ─────────────────────────────────────────────────────

export type AllocationMethod = 'millesime' | 'equal' | 'fixedPerApartment' | 'heating'

export const ALLOCATION_LABELS: Record<AllocationMethod, string> = {
  millesime: 'Κατά χιλιοστά',
  equal: 'Ισόποσα (σε ίσα μέρη)',
  fixedPerApartment: 'Πάγιο ανά διαμέρισμα',
  heating: 'Θέρμανση (σταθερό + ώρες)',
}

/** Visual column group on the statement form. */
export type ExpenseGroup =
  | 'koinoxrista'
  | 'eidikes'
  | 'thermansi'
  | 'asanser'
  | 'idioktiton'
  | 'isoposes'

export const GROUP_LABELS: Record<ExpenseGroup, string> = {
  koinoxrista: 'Κοινόχρηστα',
  eidikes: 'Ειδικές δαπάνες',
  thermansi: 'Θέρμανση',
  asanser: 'Ασανσέρ',
  idioktiton: 'Ιδιοκτητών',
  isoposes: 'Δαπάνες σε ίσα μέρη',
}

/** Which millesime scale a group's χιλιοστά column reflects on the statement. */
export const GROUP_SCALE_KEY: Record<ExpenseGroup, string | null> = {
  koinoxrista: 'genika',
  eidikes: 'eidikes',
  thermansi: 'thermansi',
  asanser: 'asanser',
  idioktiton: 'idioktiton',
  isoposes: null,
}

export const GROUP_ORDER: ExpenseGroup[] = [
  'koinoxrista',
  'eidikes',
  'thermansi',
  'asanser',
  'idioktiton',
  'isoposes',
]

export interface Expense {
  id: string
  buildingId: string
  period: string // 'YYYY-MM'
  group: ExpenseGroup
  category: string // e.g. 'ΔΕΗ κοινοχρήστων'
  amount: number
  method: AllocationMethod
  scaleKey?: string // when method === 'millesime'
  receiptUrl?: string
  receiptName?: string
  receiptPath?: string
  note?: string
  createdAt?: Timestamp
  createdBy?: string
}

// ── Payments, fund ─────────────────────────────────────────────────────────────

export type PaymentMethod = 'cash' | 'bank' | 'card' | 'iris' | 'other'

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Μετρητά',
  bank: 'Τραπεζική κατάθεση',
  card: 'Κάρτα',
  iris: 'IRIS',
  other: 'Άλλο',
}

export interface Payment {
  id: string
  buildingId: string
  apartmentId: string
  period?: string
  amount: number
  date: Timestamp
  method: PaymentMethod
  note?: string
  createdAt?: Timestamp
  createdBy?: string
}

export interface FundEntry {
  id: string
  buildingId: string
  date: Timestamp
  type: 'in' | 'out'
  amount: number
  category: string
  note?: string
  createdAt?: Timestamp
  createdBy?: string
}

// ── Statements (έκδοση κοινοχρήστων) ──────────────────────────────────────────

export interface StatementRow {
  apartmentId: string
  code: string
  ownerName: string
  /** snapshot of the apartment's millesimes at issue time (scaleKey -> value) */
  millesimes: Record<string, number>
  /** group -> amount for this apartment */
  amounts: Record<string, number>
  billingFee: number
  previousBalance: number
  currentCharge: number // sum(amounts) + billingFee
  total: number // previousBalance + currentCharge
}

export interface StatementTotals {
  byGroup: Record<string, number>
  billingFees: number
  grandTotal: number
}

export interface StatementExpenseLine {
  group: ExpenseGroup
  category: string
  amount: number
}

export interface Statement {
  id: string
  buildingId: string
  buildingCode: string
  buildingName: string
  buildingAddress: string
  managerName: string
  period: string // 'YYYY-MM'
  periodLabel: string // free text, e.g. '1/6 έως 31/12/2025'
  status: 'draft' | 'issued'
  issuedAt?: Timestamp
  issuedBy?: string
  scales: MillesimeScale[]
  rows: StatementRow[]
  totals: StatementTotals
  expenseLines: StatementExpenseLine[]
  createdAt?: Timestamp
}

// ── Announcements ────────────────────────────────────────────────────────────

export interface Announcement {
  id: string
  buildingId: string
  title: string
  body: string
  pinned?: boolean
  authorName: string
  createdBy?: string
  createdAt?: Timestamp
}

// ── Tickets (βλάβες / αιτήματα) ────────────────────────────────────────────────

export type TicketStatus = 'open' | 'in_progress' | 'done'

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Ανοιχτό',
  in_progress: 'Σε εξέλιξη',
  done: 'Ολοκληρωμένο',
}

export const TICKET_CATEGORIES = [
  'Ανελκυστήρας',
  'Ηλεκτρολογικά',
  'Υδραυλικά',
  'Καθαριότητα',
  'Θέρμανση',
  'Κοινόχρηστοι χώροι',
  'Άλλο',
] as const

export interface Ticket {
  id: string
  buildingId: string
  apartmentId?: string
  apartmentCode?: string
  title: string
  description: string
  category: string
  status: TicketStatus
  photoUrl?: string
  photoPath?: string
  createdBy?: string
  createdByName?: string
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

// ── Contracts (συμβόλαια / συντηρήσεις) ─────────────────────────────────────────

export interface Contract {
  id: string
  buildingId: string
  title: string
  vendor?: string
  category: string
  startDate?: Timestamp
  endDate?: Timestamp
  amount?: number
  reminderDays?: number
  note?: string
  createdAt?: Timestamp
}

// ── Audit log ──────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string
  buildingId?: string
  timestamp: Timestamp
  userEmail: string
  userName: string
  action: string
  entity: string
  entityId: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  context?: Record<string, unknown>
}
