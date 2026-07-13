# Handoff — Σύνοψη Session

Έγγραφο κλεισίματος: τι είναι η εφαρμογή, τι υλοποιήθηκε, πού βρίσκεται, και πώς
συνεχίζει κάποιος (ή ένα επόμενο Claude session).

## Ταυτότητα
- **Εφαρμογή**: Διαχείριση Πολυκατοικίας (κοινόχρηστα, δαπάνες, πληρωμές,
  portal ενοίκων, ψηφοφορίες, συνελεύσεις).
- **Repo**: `psalidas/app-koinoxriston` · branch ανάπτυξης
  `claude/apartment-management-app-g7a91v` (mirror και στο `main`).
- **Firebase project**: `app-koinoxriston`
- **Live URL**: https://app-koinoxriston.web.app
- **Bootstrap admin** (hardcoded στα rules): `michael@crowdpolicy.com`
- **Stack**: React 18 + TS + Vite 5 + Tailwind · Firebase (Auth/Firestore/
  Storage/Hosting/Functions) · GitHub Actions. Ίδιο με το internal Crowdpolicy
  stack, με **membership-based auth** (email ή κινητό) αντί domain-lock.

## Τι υλοποιήθηκε (Φάσεις 1–3 — όλες ✅)
**Φάση 1 — διαχείριση**
- Κτίρια/διαμερίσματα/ιδιοκτήτες, **επεξεργάσιμοι πίνακες χιλιοστών**
- Δαπάνες/μήνα, μηχανή επιμερισμού (χιλιοστά/ισόποσα/πάγιο/θέρμανση)
- **Έκδοση κοινοχρήστων** (αναπαραγωγή εντύπου) + εκτύπωση + Excel
- Πληρωμές + καρτέλα-ledger με μεταφορά υπολοίπου, Ταμείο/Αποθεματικό
- Παραστατικά (Storage), Import/Export Excel, Χρήστες/Ιστορικό/Ρυθμίσεις
- Ατομικό ειδοποιητήριο με ΙΒΑΝ + RF (ISO 11649) + EPC QR

**Φάση 2 — portal ενοίκων & ειδοποιήσεις**
- SMS OTP login (Phone Auth) + Google + email-link
- «Η καρτέλα μου» (υπόλοιπο, κινήσεις, ειδοποιητήρια), role-based nav
- Ανακοινώσεις, Βλάβες/αιτήματα (με φωτό), Μητρώο συμβολαίων + υπενθυμίσεις
- Cloud Functions scaffold για email (μέσω `firestore-send-email`)

**Φάση 3 — κοινότητα**
- Συζήτηση (θέματα/σχόλια) + ανάρτηση προσφορών (με αρχείο)
- Ηλεκτρονικές ψηφοφορίες (βάρος κατά χιλιοστά/διαμέρισμα/χρήστη) + αποτελέσματα
- Γενικές Συνελεύσεις (πρόσκληση/πρακτικά/αποφάσεις/έγγραφα) + απαρτία

Κάλυψη και των 10 αρχικών προδιαγραφών (δες `ROADMAP.md`).

## Deploy — κατάσταση
- Ροή: push στο `main` → GitHub Actions → `firebase deploy`. Μοναδικό secret:
  `FIREBASE_SERVICE_ACCOUNT`.
- Ενεργά targets: **hosting, firestore:rules, firestore:indexes, storage** ✅
- Service account ρόλοι (πλήρεις): Firebase Hosting Admin, Firebase Rules Admin,
  Cloud Datastore Index Admin, Service Usage Admin, Firebase Storage Admin,
  Service Account User. (Ιστορικό των 403 & διορθώσεις: `DEPLOYMENT.md`.)

## Εκκρεμότητες / προαιρετικά (επόμενα βήματα)
- **Email ειδοποιήσεις**: αναβάθμιση σε **Blaze** + `firebase ext:install
  firebase/firestore-send-email` + deploy functions (δες `DEPLOYMENT.md`).
- **SMS ειδοποιήσεων** (πέρα από το OTP login): πάροχος επί πληρωμή (Yuboto/
  Routee/Twilio) — χρειάζεται λογαριασμό.
- **Online πληρωμές** (IRIS/Viva/Stripe): merchant account. Προς το παρόν η
  πληρωμή καλύπτεται με ΙΒΑΝ + RF + QR στο ειδοποιητήριο.
- **PWA push notifications**: FCM (VAPID) + service worker.

## Πώς συνεχίζει ένα επόμενο session
1. Για να «βλέπει» ο agent το CI/deploy: ενεργοποίηση **GitHub connector** +
   νέο session (δες `OBSERVABILITY.md`).
2. Τοπική ανάπτυξη: `npm install` → `cp .env.example .env` (τιμές από Firebase
   console) → `npm run dev`.
3. Αλλαγές: commit → push. Προτιμότερο μέσω **Pull Request** ώστε το CI να
   ελέγχεται πριν το merge στο `main`.

## Χρήσιμα αρχεία
- `src/lib/allocation.ts` — μηχανή επιμερισμού (καρδιά του domain)
- `src/lib/auth.tsx` + `firestore.rules` — auth/πρόσβαση (email ή κινητό)
- `src/data/seed.ts` — πολυκατοικία-δείγμα (Κ. Καραμανλή 17, 15 διαμερίσματα)
- `.github/workflows/deploy.yml` — pipeline
- `functions/` — email Cloud Functions (scaffold)
