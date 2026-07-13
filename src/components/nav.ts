import {
  LayoutDashboard,
  Building2,
  Grid3x3,
  Receipt,
  FileText,
  FileSpreadsheet,
  Wallet,
  PiggyBank,
  Megaphone,
  MessagesSquare,
  Vote,
  Gavel,
  Wrench,
  FileCheck,
  FolderOpen,
  Contact,
  Upload,
  Users,
  History,
  Send,
  Settings,
  UserCircle,
  IdCard,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  section?: string
}

const MANAGER_NAV: NavItem[] = [
  { to: '/', label: 'Πίνακας', icon: LayoutDashboard },
  { to: '/apartments', label: 'Διαμερίσματα', icon: Building2 },
  { to: '/millesimes', label: 'Πίνακας Χιλιοστών', icon: Grid3x3 },
  { to: '/expenses', label: 'Δαπάνες', icon: Receipt },
  { to: '/receipts', label: 'Παραστατικά', icon: FileText },
  { to: '/statements', label: 'Κοινόχρηστα', icon: FileSpreadsheet },
  { to: '/payments', label: 'Πληρωμές', icon: Wallet },
  { to: '/fund', label: 'Ταμείο', icon: PiggyBank },
  { to: '/announcements', label: 'Ανακοινώσεις', icon: Megaphone },
  { to: '/topics', label: 'Συζήτηση', icon: MessagesSquare },
  { to: '/polls', label: 'Ψηφοφορίες', icon: Vote },
  { to: '/assemblies', label: 'Συνελεύσεις', icon: Gavel },
  { to: '/tickets', label: 'Βλάβες / Αιτήματα', icon: Wrench },
  { to: '/contracts', label: 'Συμβόλαια', icon: FileCheck },
  { to: '/documents', label: 'Έγγραφα', icon: FolderOpen },
  { to: '/directory', label: 'Κατάλογος', icon: Contact },
  { to: '/import', label: 'Εισαγωγή/Εξαγωγή', icon: Upload, section: 'Διαχείριση' },
  { to: '/admin/users', label: 'Χρήστες', icon: Users, section: 'Διαχείριση' },
  { to: '/admin/invites', label: 'Προσκλήσεις', icon: Send, section: 'Διαχείριση' },
  { to: '/admin/audit', label: 'Ιστορικό', icon: History, section: 'Διαχείριση' },
  { to: '/admin/settings', label: 'Ρυθμίσεις κτιρίου', icon: Settings, section: 'Διαχείριση' },
]

const RESIDENT_NAV: NavItem[] = [
  { to: '/portal', label: 'Η καρτέλα μου', icon: UserCircle },
  { to: '/my-profile', label: 'Τα στοιχεία μου', icon: IdCard },
  { to: '/announcements', label: 'Ανακοινώσεις', icon: Megaphone },
  { to: '/topics', label: 'Συζήτηση', icon: MessagesSquare },
  { to: '/polls', label: 'Ψηφοφορίες', icon: Vote },
  { to: '/assemblies', label: 'Συνελεύσεις', icon: Gavel },
  { to: '/tickets', label: 'Βλάβες / Αιτήματα', icon: Wrench },
  { to: '/documents', label: 'Έγγραφα', icon: FolderOpen },
  { to: '/directory', label: 'Κατάλογος', icon: Contact },
]

export function navFor(isManager: boolean): NavItem[] {
  return isManager ? MANAGER_NAV : RESIDENT_NAV
}
