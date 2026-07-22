import { useState } from 'react'
import { LifeBuoy, ChevronDown, Building2, Users, Receipt, FileSpreadsheet, PiggyBank, FolderOpen, Megaphone, Wrench, Vote, Phone } from 'lucide-react'
import { PageHeader, Card } from '@/components/forms'
import { useAuth } from '@/lib/auth'

type Item = { icon: typeof Building2; title: string; body: string[] }

const MANAGER_GUIDE: Item[] = [
  {
    icon: Building2,
    title: 'Δημιουργία & ρύθμιση κτιρίου',
    body: [
      'Διαχείριση → Κτίρια → «Νέο κτίριο». Συμπληρώστε όνομα/διεύθυνση· δημιουργείται αυτόματα σύνδεσμος /b/<κωδικός>.',
      'Στις «Ρυθμίσεις κτιρίου» ορίστε ΙΒΑΝ, ΑΦΜ, πίνακες χιλιοστών και τυχόν έξοδο έκδοσης.',
      'Με τη δημιουργία μπορείτε να προσθέσετε ενδεικτικά (demo) δεδομένα για να δείτε πώς λειτουργεί — διαγράφονται εύκολα.',
    ],
  },
  {
    icon: Users,
    title: 'Διαμερίσματα, χιλιοστά & χρήστες',
    body: [
      'Διαμερίσματα: προσθέστε τα διαμερίσματα ή κάντε μαζική Εισαγωγή από Excel.',
      'Πίνακας Χιλιοστών: συμπληρώστε τα χιλιοστά ανά κατηγορία (γενικά, θέρμανση, ασανσέρ κ.λπ.).',
      'Χρήστες: προσθέστε ιδιοκτήτες/ενοίκους με email ή κινητό — λαμβάνουν αυτόματα πρόσκληση εισόδου (σύνδεσμος ή κωδικός).',
    ],
  },
  {
    icon: Receipt,
    title: 'Δαπάνες',
    body: [
      'Καταχωρίστε κάθε δαπάνη με ομάδα (Κοινόχρηστα, Ειδικές, Ασανσέρ…), ποσό και μέθοδο επιμερισμού (κατά χιλιοστά ή ισόποσα).',
      'Ανεβάστε το παραστατικό — μπορείτε και «Ανάλυση AI» για αυτόματη συμπλήρωση της φόρμας.',
      'Επιλέξτε ποια διαμερίσματα συμμετέχουν (προεπιλογή: όλα).',
    ],
  },
  {
    icon: FileSpreadsheet,
    title: 'Έκδοση κοινοχρήστων',
    body: [
      'Κοινόχρηστα → «Νέα έκδοση»: επιλέξτε περίοδο (μήνα ή εύρος). Δημιουργείται η συγκεντρωτική κατάσταση.',
      'Ελέγξτε, πατήστε «Ανανέωση» αν προσθέσατε δαπάνες, και «Οριστικοποίηση» όταν είστε έτοιμοι.',
      'Εκτυπώστε τη συγκεντρωτική, τα ειδοποιητήρια διαμερίσματος ή τις αποδείξεις ενοίκου/ιδιοκτήτη.',
    ],
  },
  {
    icon: PiggyBank,
    title: 'Πληρωμές & Ταμείο',
    body: [
      'Πληρωμές: καταχωρίστε τις εισπράξεις ανά διαμέρισμα — ενημερώνεται το υπόλοιπο.',
      'Ταμείο: παρακολουθήστε το αποθεματικό (εισπράξεις/πληρωμές).',
    ],
  },
  {
    icon: FolderOpen,
    title: 'Έγγραφα, Ανακοινώσεις, Βλάβες & άλλα',
    body: [
      'Έγγραφα: ανεβάστε άδειες/κανονισμό/πρακτικά σε φακέλους (με δυνατότητα μετακίνησης).',
      'Ανακοινώσεις, Ψηφοφορίες, Συνελεύσεις, Εργασίες, Τηλέφωνα: εργαλεία επικοινωνίας & οργάνωσης.',
      'Μαζική αποστολή: στείλτε email ή SMS σε επιλεγμένους χρήστες.',
    ],
  },
]

const OWNER_GUIDE: Item[] = [
  {
    icon: Building2,
    title: 'Είσοδος στην εφαρμογή',
    body: [
      'Θα λάβετε πρόσκληση με email ή SMS. Μπαίνετε με σύνδεσμο εισόδου (magic link), με Google, ή ορίζοντας κωδικό.',
      'Στην οθόνη εισόδου βάζετε το email ή το κινητό σας.',
    ],
  },
  {
    icon: FileSpreadsheet,
    title: 'Κοινόχρηστα & πληρωμές',
    body: [
      'Πίνακας ελέγχου: βλέπετε το υπόλοιπό σας και τα ειδοποιητήρια κάθε περιόδου.',
      'Οικονομικά κτιρίου: βλέπετε τη συγκεντρωτική κατάσταση, τις δαπάνες με τα παραστατικά τους, τις πληρωμές και το ταμείο/αποθεματικό.',
      'Πατώντας πάνω σε μια δαπάνη ανοίγει η ανάλυσή της με το έγγραφο.',
    ],
  },
  {
    icon: Wrench,
    title: 'Βλάβες & αιτήματα',
    body: [
      'Βλάβες: καταχωρίστε πρόβλημα (π.χ. ασανσέρ, φωτισμός) με φωτογραφία — ο διαχειριστής ενημερώνεται.',
    ],
  },
  {
    icon: Vote,
    title: 'Ανακοινώσεις & Ψηφοφορίες',
    body: [
      'Ανακοινώσεις: ενημερώσεις από τον διαχειριστή.',
      'Ψηφοφορίες: ψηφίζετε ηλεκτρονικά σε θέματα της πολυκατοικίας.',
    ],
  },
  {
    icon: Phone,
    title: 'Τα στοιχεία μου & Τηλέφωνα',
    body: [
      'Τα στοιχεία μου: ενημερώστε τα στοιχεία επικοινωνίας σας και τι εμφανίζεται στον κατάλογο.',
      'Τηλέφωνα: χρήσιμες επαφές (συνεργεία, υπηρεσίες).',
    ],
  },
]

function Section({ item, open, onToggle }: { item: Item; open: boolean; onToggle: () => void }) {
  const Icon = item.icon
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50">
        <Icon size={18} className="shrink-0 text-blue-500" />
        <span className="flex-1 font-medium text-gray-800">{item.title}</span>
        <ChevronDown size={18} className={`text-gray-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul className="space-y-1.5 px-4 pb-3 pl-12 text-sm text-gray-600">
          {item.body.map((b, i) => (
            <li key={i} className="list-disc">{b}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function Support() {
  const { isManager } = useAuth()
  const guide = isManager ? MANAGER_GUIDE : OWNER_GUIDE
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Υποστήριξη & Οδηγίες"
        subtitle={isManager ? 'Οδηγός για διαχειριστές' : 'Οδηγός για ιδιοκτήτες & ενοίκους'}
      />

      <Card className="mb-4">
        <div className="flex items-start gap-3">
          <LifeBuoy size={22} className="mt-0.5 shrink-0 text-blue-500" />
          <div className="text-sm text-gray-600">
            <p>
              Παρακάτω θα βρείτε σύντομους οδηγούς για τις βασικές λειτουργίες. Για απορίες ή
              υποστήριξη, επικοινωνήστε στο{' '}
              <a href="mailto:support@crowdpolicy.com" className="text-blue-600 hover:underline">
                support@crowdpolicy.com
              </a>
              .
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-0">
        {guide.map((item, i) => (
          <Section key={i} item={item} open={openIdx === i} onToggle={() => setOpenIdx(openIdx === i ? null : i)} />
        ))}
      </Card>

      <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
        <Megaphone size={14} /> Οι οδηγίες ενημερώνονται καθώς προστίθενται νέες λειτουργίες.
      </div>
    </div>
  )
}
