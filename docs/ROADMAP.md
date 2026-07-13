# Roadmap

## Κατάσταση deploy
- ✅ **Live**: https://app-koinoxriston.web.app (hosting + firestore rules)
- ⏸️ Εκκρεμεί: `firestore:indexes` (ρόλος *Cloud Datastore Index Admin*),
  `storage` (ρόλος *Firebase Storage Admin* + default bucket), Cloud Functions
  email (Blaze + extension). Λεπτομέρειες: [`DEPLOYMENT.md`](./DEPLOYMENT.md).


## Φάση 1 — MVP διαχειριστή ✅ (τρέχουσα)
- [x] Scaffold (Vite/React/TS/Tailwind/Firebase), PWA, CI/CD
- [x] Auth membership-based (Google + email link) + rules
- [x] Κτίρια / διαμερίσματα / ιδιοκτήτες
- [x] Επεξεργάσιμοι πίνακες χιλιοστών
- [x] Δαπάνες ανά μήνα + μηχανή επιμερισμού
- [x] Έκδοση κοινοχρήστων (αναπαραγωγή εντύπου) + εκτύπωση + Excel
- [x] Πληρωμές + καρτέλα-ledger με μεταφορά υπολοίπου
- [x] Ταμείο / Αποθεματικό
- [x] Import/Export Excel
- [x] Χρήστες / Ιστορικό / Ρυθμίσεις κτιρίου
- [x] Ανέβασμα παραστατικού (Storage) + πίνακας «Παραστατικά»
- [x] Ατομικό ειδοποιητήριο με ΙΒΑΝ + κωδικό RF (ISO 11649) + EPC QR

## Φάση 2 — Portal ενοίκων & ειδοποιήσεις ✅
- [x] SMS OTP login (Firebase Phone Auth) — mobile-first
- [x] «Η καρτέλα μου» για ιδιοκτήτη/ένοικο (read-only) + role-based nav
- [x] Ατομικό ειδοποιητήριο ανά διαμέρισμα (από τη Φάση 1)
- [x] Ειδοποιήσεις email (Cloud Functions + firestore-send-email) — scaffold
- [x] Βλάβες/αιτήματα (tickets) με φωτό
- [x] Μητρώο συμβολαίων & υπενθυμίσεις λήξης (ασανσέρ, πυρασφάλεια…)
- [ ] PWA push notifications — *επόμενο*

## Φάση 3 — Κοινότητα & πληρωμές
- [x] Συζήτηση + ανάρτηση προσφορών (θέματα, σχόλια, προσφορές με αρχείο)
- [x] Ηλεκτρονικές ψηφοφορίες (βάρος κατά χιλιοστά/ανά διαμέρισμα/ανά χρήστη, ρυθμιζόμενο)
- [x] Πρακτικά/προσκλήσεις ΓΣ + αποφάσεις, απαρτία/quorum, έγγραφα
- [ ] Online πληρωμές (IRIS / Viva / Stripe) — *χρειάζεται merchant account*
- [ ] SMS ειδοποιήσεων (πάροχος επί πληρωμή) — *χρειάζεται λογαριασμό παρόχου*

> Η πληρωμή καλύπτεται ήδη πρακτικά από ΙΒΑΝ + κωδικό RF + EPC QR στο
> ειδοποιητήριο. Η πλήρης ενσωμάτωση gateway (IRIS/Viva) & τα SMS χρειάζονται
> εξωτερικούς λογαριασμούς/credentials και μπαίνουν όταν είναι διαθέσιμα.

## Μελλοντικά
- [ ] Multi-building (πολλές πολυκατοικίες) — ίσως ξεχωριστό GCP project
