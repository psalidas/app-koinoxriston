const TZ = 'Europe/Athens'

const eur = new Intl.NumberFormat('el-GR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const num2 = new Intl.NumberFormat('el-GR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const num1 = new Intl.NumberFormat('el-GR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/** €1.234,56 */
export function money(value: number | null | undefined): string {
  return eur.format(Number(value) || 0)
}

/** 1.234,56 (no symbol — for dense statement tables) */
export function amount(value: number | null | undefined): string {
  return num2.format(Number(value) || 0)
}

/** 86,0 — millesime display */
export function mille(value: number | null | undefined): string {
  return num1.format(Number(value) || 0)
}

type DateLike = Date | { toDate: () => Date } | null | undefined

function toDate(d: DateLike): Date | null {
  if (!d) return null
  if (d instanceof Date) return d
  if (typeof (d as { toDate?: unknown }).toDate === 'function') {
    return (d as { toDate: () => Date }).toDate()
  }
  return null
}

/** 08/01/2026 */
export function formatDate(d: DateLike): string {
  const date = toDate(d)
  if (!date) return '—'
  return new Intl.DateTimeFormat('el-GR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: TZ,
  }).format(date)
}

/** 08/01/2026 14:32 */
export function formatDateTime(d: DateLike): string {
  const date = toDate(d)
  if (!date) return '—'
  return new Intl.DateTimeFormat('el-GR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  }).format(date)
}

const MONTHS_EL = [
  'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
  'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος',
]

/** '2025-06' -> 'Ιούνιος 2025' */
export function formatPeriod(period: string): string {
  const [y, m] = period.split('-')
  const mi = Number(m) - 1
  if (!y || mi < 0 || mi > 11) return period
  return `${MONTHS_EL[mi]} ${y}`
}

/** Sort helper for Greek strings. */
export function compareEl(a: string, b: string): number {
  return a.localeCompare(b, 'el')
}

/** Current period 'YYYY-MM' in Athens time. */
export function currentPeriod(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    timeZone: TZ,
  }).formatToParts(new Date())
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970'
  const m = parts.find((p) => p.type === 'month')?.value ?? '01'
  return `${y}-${m}`
}
