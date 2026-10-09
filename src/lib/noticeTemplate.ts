// Πρότυπα ειδοποίησης έκδοσης κοινοχρήστων (κοινά για ρυθμίσεις & modal).
// Placeholders: {name} {apts} {amount} {ref} {period} {due} {iban} {bank}
//               {company} {building} {link}

export const NOTICE_PLACEHOLDERS = [
  '{name}', '{apts}', '{amount}', '{ref}', '{period}', '{due}',
  '{iban}', '{bank}', '{company}', '{building}', '{link}',
]

export function defaultNoticeEmailSubject(): string {
  return 'Κοινόχρηστα {period} — {building}'
}

export function defaultNoticeEmailTemplate(): string {
  return [
    'Αγαπητέ/ή {name},',
    '',
    'Εκδόθηκαν τα κοινόχρηστα περιόδου {period} για το/τα διαμέρισμα/τα {apts}.',
    'Ποσό πληρωμής: {amount}',
    'Προθεσμία πληρωμής: {due}',
    '',
    'Στοιχεία πληρωμής:',
    'Δικαιούχος: {company}',
    'Τράπεζα: {bank}',
    'IBAN: {iban}',
    'Αιτιολογία πληρωμής: {ref}',
    '',
    'Αναλυτικά παραστατικά στην πλατφόρμα: {link}',
    '',
    '{building}',
  ].join('\n')
}

export function defaultNoticeSmsTemplate(): string {
  return 'Έκδοση κοινοχρήστων {building}, περίοδος {period}: ποσό {amount} για διαμέρισμα {apts}, πληρωμή έως {due}. IBAN {iban}, αιτιολογία {ref}. Αναλυτικά: {link}'
}

/** Αντικαθιστά placeholders και καθαρίζει κενές γραμμές από κενές τιμές. */
export function renderNotice(tpl: string, vars: Record<string, string>): string {
  return tpl
    .replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
