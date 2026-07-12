import * as XLSX from 'xlsx'
import type { Apartment, MillesimeScale, Statement } from '@/types'
import { GROUP_LABELS, GROUP_ORDER } from '@/types'

/** Download a worksheet built from array-of-objects. */
function download(rows: Record<string, unknown>[], sheetName: string, fileName: string) {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, fileName)
}

/** Export the millesime table (one column per scale). */
export function exportMillesimes(apartments: Apartment[], scales: MillesimeScale[]) {
  const rows = apartments.map((a) => {
    const row: Record<string, unknown> = {
      'Α/Α': a.orderNo,
      Διαμέρισμα: a.code,
      Ιδιοκτήτης: a.ownerName,
    }
    for (const s of scales) row[s.label] = a.millesimes[s.key] ?? 0
    return row
  })
  download(rows, 'Χιλιοστά', 'xiliosta.xlsx')
}

/** Export a generated statement as the summary table. */
export function exportStatement(st: Statement) {
  const groups = GROUP_ORDER.filter((g) => (st.totals.byGroup[g] ?? 0) !== 0)
  const rows = st.rows.map((r) => {
    const row: Record<string, unknown> = {
      Διαμέρισμα: r.code,
      Ιδιοκτήτης: r.ownerName,
    }
    for (const g of groups) row[GROUP_LABELS[g]] = r.amounts[g] ?? 0
    row['Έκδοση λογ/σμών'] = r.billingFee
    row['Προηγ. υπόλοιπο'] = r.previousBalance
    row['Σύνολο περιόδου'] = r.currentCharge
    row['Γενικό σύνολο'] = r.total
    return row
  })
  download(rows, 'Κατάσταση', `koinoxrista-${st.period}.xlsx`)
}

export interface ImportedApartment {
  code: string
  ownerName: string
  orderNo: number
  millesimes: Record<string, number>
}

/**
 * Parse an uploaded xlsx into apartment rows. Expects columns:
 * 'Διαμέρισμα' | 'Ιδιοκτήτης' | one column per scale label.
 */
export async function parseApartmentsFile(
  file: File,
  scales: MillesimeScale[],
): Promise<ImportedApartment[]> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)
  return raw.map((r, i) => {
    const millesimes: Record<string, number> = {}
    for (const s of scales) millesimes[s.key] = num(r[s.label])
    return {
      orderNo: num(r['Α/Α']) || i + 1,
      code: String(r['Διαμέρισμα'] ?? r['Διαμ.'] ?? '').trim(),
      ownerName: String(r['Ιδιοκτήτης'] ?? r['Ονοματεπώνυμο'] ?? '').trim(),
      millesimes,
    }
  })
}

function num(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return Number(v.replace(',', '.')) || 0
  return 0
}
