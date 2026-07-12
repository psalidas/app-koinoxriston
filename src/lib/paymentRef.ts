// Payment reference (ISO 11649 RF creditor reference) + EPC QR payload builder.
// Used on the individual κοινοχρήστων notice so residents can pay by scanning.

function mod97(numeric: string): number {
  let remainder = 0
  for (let i = 0; i < numeric.length; i++) {
    remainder = (remainder * 10 + (numeric.charCodeAt(i) - 48)) % 97
  }
  return remainder
}

function toNumeric(s: string): string {
  // A→10 … Z→35, digits unchanged.
  return s.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55))
}

/**
 * Build an ISO 11649 RF creditor reference from a free base (e.g. building
 * code + apartment + period). Returns e.g. "RF18 0001 02A1 2025 12".
 */
export function rfReference(base: string): string {
  const clean = base
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 21)
  const check = 98 - mod97(toNumeric(clean + 'RF00'))
  return `RF${String(check).padStart(2, '0')}${clean}`
}

/** Group an RF reference in blocks of 4 for display. */
export function groupRef(ref: string): string {
  return ref.replace(/(.{4})/g, '$1 ').trim()
}

export interface EpcParams {
  name: string // beneficiary
  iban: string
  amount: number
  reference: string // structured RF reference
}

/**
 * EPC069-12 ("GiroCode" / SEPA Credit Transfer) QR payload. Many EU banking
 * apps (incl. Greek) can scan it to prefill a transfer.
 */
export function epcQrPayload({ name, iban, amount, reference }: EpcParams): string {
  const cleanIban = iban.replace(/\s+/g, '').toUpperCase()
  return [
    'BCD',
    '002',
    '1',
    'SCT',
    '', // BIC (optional)
    name.slice(0, 70),
    cleanIban,
    `EUR${amount.toFixed(2)}`,
    '', // purpose
    reference.slice(0, 35), // structured remittance
    '', // unstructured remittance
  ].join('\n')
}
