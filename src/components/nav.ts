import {
  LayoutDashboard,
  Building2,
  Grid3x3,
  Receipt,
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
  Phone,
  Hammer,
  Upload,
  Users,
  History,
  Send,
  MailPlus,
  Settings,
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
  { to: '/statements', label: 'Κοινόχρηστα', icon: FileSpreadsheet },
  { to: '/payments', label: 'Πληρωμές', icon: Wallet },
  { to: '/fund', label: 'Ταμείο', icon: PiggyBank },
  { to: '/announcements', label: 'Ανακοινώσεις', icon: Megaphone },
  { to: '/topics', label: 'Συζήτηση', icon: MessagesSquare },
  { to: '/polls', label: 'Ψηφοφορίες', icon: Vote },
  { to: '/assemblies', label: 'Συνελεύσεις', icon: Gavel },
  { to: '/tickets', label: 'Βλάβες / Αιτήματα', icon: Wrench },
  { to: '/works', label: 'Εργασίες', icon: Hammer },
  { to: '/contracts', label: 'Συμβόλαια', icon: FileCheck },
  { to: '/documents', label: 'Έγγραφα', icon: FolderOpen },
  { to: '/directory', label: 'Κατάλογος', icon: Contact },
  { to: '/contacts', label: 'Τηλέφωνα', icon: Phone },
  { to: '/import', label: 'Εισαγωγή/Εξαγωγή', icon: Upload, section: 'Διαχείριση' },
  { to: '/admin/users', label: 'Χρήστες', icon: Users, section: 'Διαχείριση' },
  { to: '/admin/invites', label: 'Προσκλήσεις', icon: Send, section: 'Διαχείριση' },
  { to: '/admin/broadcast', label: 'Μαζική αποστολή', icon: MailPlus, section: 'Διαχείριση' },
  { to: '/admin/audit', label: 'Ιστορικό', icon: History, section: 'Διαχείριση' },
  { to: '/admin/settings', label: 'Ρυθμίσεις κτιρίου', icon: Settings, section: 'Διαχείριση' },
]

const RESIDENT_NAV: NavItem[] = [
  { to: '/portal', label: 'Πίνακας ελέγχου', icon: LayoutDashboard },
  { to: '/my-profile', label: 'Τα στοιχεία μου', icon: IdCard },
  { to: '/finances', label: 'Οικονομικά κτιρίου', icon: PiggyBank },
  { to: '/announcements', label: 'Ανακοινώσεις', icon: Megaphone },
  { to: '/works', label: 'Εργασίες', icon: Hammer },
  { to: '/topics', label: 'Συζήτηση', icon: MessagesSquare },
  { to: '/polls', label: 'Ψηφοφορίες', icon: Vote },
  { to: '/assemblies', label: 'Συνελεύσεις', icon: Gavel },
  { to: '/tickets', label: 'Βλάβες / Αιτήματα', icon: Wrench },
  { to: '/documents', label: 'Έγγραφα', icon: FolderOpen },
  { to: '/directory', label: 'Κατάλογος', icon: Contact },
  { to: '/contacts', label: 'Τηλέφωνα', icon: Phone },
]

export function navFor(isManager: boolean): NavItem[] {
  return isManager ? MANAGER_NAV : RESIDENT_NAV
}
