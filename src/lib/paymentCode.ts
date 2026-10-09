import type { Apartment } from '@/types'

/**
 * Σταθερός κωδικός αιτιολογίας πληρωμής ανά διαμέρισμα — χρησιμοποιείται ως
 * αναγνωριστικό στην πληρωμή ώστε να αντιστοιχίζεται η κίνηση του extré με το
 * διαμέρισμα. Αν ο διαχειριστής έχει ορίσει ρητό κωδικό, χρησιμοποιείται αυτός·
 * αλλιώς παράγεται ντετερμινιστικά από τον κωδικό κτιρίου και το Α/Α.
 */
export function paymentCodeFor(
  apt: Pick<Apartment, 'paymentCode' | 'orderNo'> | undefined,
  buildingCode: string,
  fallback = '',
): string {
  const custom = apt?.paymentCode?.trim()
  if (custom) return custom
  const base = (buildingCode || 'KK').trim()
  if (apt && typeof apt.orderNo === 'number') {
    return `${base}-${String(apt.orderNo).padStart(2, '0')}`
  }
  return fallback ? `${base}-${fallback}` : base
}
