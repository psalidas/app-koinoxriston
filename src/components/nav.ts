import {
  LayoutDashboard,
  Building2,
  Grid3x3,
  Receipt,
  FileText,
  FileSpreadsheet,
  Wallet,
  PiggyBank,
  Upload,
  Users,
  History,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  managerOnly?: boolean
  section?: string
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Πίνακας', icon: LayoutDashboard },
  { to: '/apartments', label: 'Διαμερίσματα', icon: Building2 },
  { to: '/millesimes', label: 'Πίνακας Χιλιοστών', icon: Grid3x3 },
  { to: '/expenses', label: 'Δαπάνες', icon: Receipt },
  { to: '/receipts', label: 'Παραστατικά', icon: FileText },
  { to: '/statements', label: 'Κοινόχρηστα', icon: FileSpreadsheet },
  { to: '/payments', label: 'Πληρωμές', icon: Wallet },
  { to: '/fund', label: 'Ταμείο', icon: PiggyBank },
  { to: '/import', label: 'Εισαγωγή/Εξαγωγή', icon: Upload, managerOnly: true },
  { to: '/admin/users', label: 'Χρήστες', icon: Users, managerOnly: true, section: 'Διαχείριση' },
  { to: '/admin/audit', label: 'Ιστορικό', icon: History, managerOnly: true, section: 'Διαχείριση' },
  { to: '/admin/settings', label: 'Ρυθμίσεις κτιρίου', icon: Settings, managerOnly: true, section: 'Διαχείριση' },
]
