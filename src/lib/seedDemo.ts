import { createApartment } from './repos/apartments'
import { createExpense } from './repos/expenses'
import { createAnnouncement } from './repos/announcements'
import { createTicket } from './repos/tickets'
import { createWork } from './repos/works'
import { createContact } from './repos/contacts'
import { createPoll } from './repos/polls'
import { currentPeriod } from './format'

/**
 * Γεμίζει ένα νέο κτίριο με ενδεικτικά (demo) δεδομένα, 2-3 ανά ενότητα, ώστε ο
 * νέος διαχειριστής να δει πώς λειτουργεί. Best-effort: αν αποτύχει κάτι, δεν
 * ρίχνει (το κτίριο έχει ήδη δημιουργηθεί).
 *
 * @param buildingId  το id του νέου κτιρίου
 * @param scaleKeys   τα keys των πινάκων χιλιοστών του κτιρίου
 */
export async function seedDemoBuilding(buildingId: string, scaleKeys: string[]): Promise<void> {
  const period = currentPeriod()
  const millOf = (v: number) => Object.fromEntries(scaleKeys.map((k) => [k, v]))

  try {
    // Διαμερίσματα (3) — χιλιοστά που αθροίζουν ~1000 ανά κλίμακα
    const apts = [
      { code: 'Α1', orderNo: 1, floor: '1ος', ownerName: 'ΠΑΠΑΔΟΠΟΥΛΟΣ (demo)', v: 340 },
      { code: 'Α2', orderNo: 2, floor: '1ος', ownerName: 'ΓΕΩΡΓΙΟΥ (demo)', v: 330 },
      { code: 'Β1', orderNo: 3, floor: '2ος', ownerName: 'ΝΙΚΟΛΑΟΥ (demo)', v: 330 },
    ]
    for (const a of apts) {
      await createApartment({
        buildingId,
        code: a.code,
        orderNo: a.orderNo,
        floor: a.floor,
        ownerName: a.ownerName,
        millesimes: millOf(a.v),
      })
    }

    // Δαπάνες (3)
    const genika = scaleKeys.includes('genika') ? 'genika' : scaleKeys[0]
    const asanser = scaleKeys.includes('asanser') ? 'asanser' : genika
    await createExpense({
      buildingId,
      period,
      group: 'koinoxrista',
      category: 'ΔΕΗ κοινοχρήστων (demo)',
      amount: 120,
      method: 'millesime',
      scaleKey: genika,
    })
    await createExpense({
      buildingId,
      period,
      group: 'koinoxrista',
      category: 'Συνεργείο καθαρισμού (demo)',
      amount: 80,
      method: 'millesime',
      scaleKey: genika,
    })
    await createExpense({
      buildingId,
      period,
      group: 'asanser',
      category: 'Συντήρηση ασανσέρ (demo)',
      amount: 60,
      method: 'millesime',
      scaleKey: asanser,
    })

    // Ανακοινώσεις (2)
    await createAnnouncement({
      buildingId,
      title: 'Καλωσορίσατε στην πλατφόρμα! (demo)',
      body: 'Αυτή είναι μια ενδεικτική ανακοίνωση. Μπορείτε να τη διαγράψετε και να προσθέσετε τις δικές σας.',
      authorName: 'Διαχειριστής',
      pinned: true,
    })
    await createAnnouncement({
      buildingId,
      title: 'Καθαρισμός κοινόχρηστων χώρων (demo)',
      body: 'Ενδεικτική ανακοίνωση για προγραμματισμένο καθαρισμό.',
      authorName: 'Διαχειριστής',
    })

    // Βλάβες (2)
    await createTicket({
      buildingId,
      title: 'Καμένη λάμπα στο κλιμακοστάσιο (demo)',
      description: 'Ενδεικτική βλάβη.',
      category: 'Ηλεκτρολογικά',
      status: 'open',
      createdByName: 'Ένοικος (demo)',
    })
    await createTicket({
      buildingId,
      title: 'Θόρυβος στον ανελκυστήρα (demo)',
      description: 'Ενδεικτικό αίτημα.',
      category: 'Ανελκυστήρας',
      status: 'in_progress',
      createdByName: 'Ένοικος (demo)',
    })

    // Εργασίες (2)
    await createWork({
      buildingId,
      title: 'Βάψιμο κλιμακοστασίου (demo)',
      description: 'Ενδεικτική εργασία προς υλοποίηση.',
      status: 'todo',
      category: 'Ανακαίνιση',
    })
    await createWork({
      buildingId,
      title: 'Αντικατάσταση φωτιστικών LED (demo)',
      description: 'Ενδεικτική εργασία σε εξέλιξη.',
      status: 'in_progress',
      category: 'Συντήρηση',
    })

    // Τηλέφωνα / επαφές (3)
    await createContact({ buildingId, name: 'Υδραυλικός (demo)', category: 'Υδραυλικός', phone: '2100000001' })
    await createContact({ buildingId, name: 'Συντήρηση ασανσέρ (demo)', category: 'Ασανσέρ', phone: '2100000002' })
    await createContact({ buildingId, name: 'Έκτακτη ανάγκη (demo)', category: 'Έκτακτη ανάγκη', phone: '112' })

    // Ψηφοφορία (1)
    await createPoll({
      buildingId,
      question: 'Να γίνει βάψιμο του κλιμακοστασίου; (demo)',
      options: ['Ναι', 'Όχι'],
      eligibility: 'owners',
      weightMode: 'perApartment',
      status: 'open',
      totalWeight: apts.length,
    })
  } catch (err) {
    console.error('seedDemoBuilding failed', err)
  }
}
