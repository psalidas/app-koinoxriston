# Διαχείριση Πολυκατοικίας

Εφαρμογή διαχείρισης πολυκατοικίας (κοινόχρηστα, δαπανών, πληρωμές, έκδοση
κοινοχρήστων με επιμερισμό κατά χιλιοστά) για τον διαχειριστή, με μελλοντικό
portal ενοίκων.

Βασισμένη στο standard internal Crowdpolicy app stack, με τη διαφορά ότι το
auth είναι **membership-based** (όχι domain-locked) ώστε να μπαίνουν και οι
ένοικοι/ιδιοκτήτες.

## Stack

- React 18 + TypeScript + Vite 5
- Tailwind CSS 3 (mobile-first, PWA)
- Firebase Auth (Google SSO + passwordless email link· SMS OTP στη Φάση 2)
- Firestore
- Firebase Storage (παραστατικά)
- Firebase Hosting + GitHub Actions deploy

## Λειτουργίες (Φάση 1)

- Κτίρια / διαμερίσματα / ιδιοκτήτες με **επεξεργάσιμους πίνακες χιλιοστών**
  (κοινόχρηστα, ειδικές, θέρμανση, ασανσέρ, ιδιοκτητών — επεκτάσιμοι)
- Καταγραφή δαπανών ανά μήνα με τρόπο επιμερισμού (χιλιοστά / ισόποσα / πάγιο / θέρμανση)
- **Έκδοση κοινοχρήστων** που αναπαράγει τη «Συγκεντρωτική Κατάσταση Δαπανών»
  + εκτύπωση (PDF μέσω browser) + εξαγωγή Excel
- Πληρωμές ανά διαμέρισμα, **καρτέλα-ledger** με μεταφορά υπολοίπου
- **Ταμείο / Αποθεματικό** με κινήσεις
- Εισαγωγή/εξαγωγή Excel
- Διαχείριση χρηστών (ρόλοι), ιστορικό (audit log), ρυθμίσεις κτιρίου

## Τοπική ανάπτυξη

Προαπαιτούμενο: Node 22.

```bash
npm install
cp .env.example .env   # συμπληρώστε τα VITE_FIREBASE_* από το Firebase console
npm run dev            # http://localhost:5173
```

Η εφαρμογή τρέχει και χωρίς Firebase env (οι σελίδες δείχνουν «απαιτείται
ρύθμιση»). Δείτε [`docs/SETUP.md`](./docs/SETUP.md) για το στήσιμο στο
Google Cloud / Firebase.

## Scripts

| Script | Σκοπός |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check + production build στο `dist/` |
| `npm run preview` | Preview του build |
| `npm run typecheck` | Μόνο type-check |

## Τεκμηρίωση

- [`docs/PROJECT_SPEC.md`](./docs/PROJECT_SPEC.md) — προδιαγραφές & domain
- [`docs/SETUP.md`](./docs/SETUP.md) — οδηγός Firebase / Google Cloud
- [`docs/ROADMAP.md`](./docs/ROADMAP.md) — φάσεις υλοποίησης
