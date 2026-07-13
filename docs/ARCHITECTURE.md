# Architecture

## Stack
- **Frontend**: React 18 + TypeScript + Vite 5, Tailwind CSS 3 (mobile-first, PWA)
- **Auth**: Firebase Auth — Google, Email-link (passwordless), Phone (SMS OTP)
- **DB**: Firestore
- **Files**: Firebase Storage (receipts, photos, offers, assembly docs)
- **Backend (optional)**: Cloud Functions Gen2 (Node 22, `europe-west1`) για email
- **Hosting/CI**: Firebase Hosting + GitHub Actions

## Δομή κώδικα
```
src/
  lib/
    firebase.ts        Firebase init (nullable αν λείπει config)
    auth.tsx           AuthProvider: Google/email-link/phone, membership
    appData.tsx        Τρέχον κτίριο + διαμερίσματα (context)
    db.ts              collection helpers, requireDb, clean()
    allocation.ts      Μηχανή επιμερισμού κοινοχρήστων
    balances.ts        Υπόλοιπα & ledger ανά διαμέρισμα
    paymentRef.ts      ISO 11649 RF reference + EPC QR payload
    exports.ts         Excel import/export (xlsx)
    upload.ts          Storage uploads
    audit.ts           Audit log helper
    format.ts          €/ημερομηνίες/χιλιοστά (el-GR, Europe/Athens)
    repos/             Ένα module ανά collection (CRUD)
  components/          Layout, Sidebar, Topbar, Modal, forms, ProtectedRoute…
  pages/               Μία σελίδα ανά route (+ pages/admin/)
  data/seed.ts         Seed: Κ. Καραμανλή 17
  types/index.ts       Domain types
functions/             Cloud Functions (ξεχωριστό package)
```

## Ρόλοι & πρόσβαση
Ρόλοι: `admin`, `manager`, `owner`, `resident`.

- Η πρόσβαση είναι **membership-based** (όχι domain-locked): κάθε χρήστης έχει
  `/users/{id}` με ρόλο & `apartmentIds`. Το `id` είναι το **email** (Google/
  email-link) ή ο **αριθμός κινητού** (SMS OTP).
- **Bootstrap admin** (hardcoded στα rules): `michael@crowdpolicy.com` — για να
  δημιουργηθούν οι πρώτοι χρήστες.
- UI: `managers` βλέπουν όλη τη διαχείριση· `owner/resident` περιορίζονται στο
  portal (route guard `ManagerOutlet` + role-based nav).

## Firestore collections
| Collection | Περιεχόμενο | Write |
|---|---|---|
| `users/{id}` | ρόλος, κτίρια, διαμερίσματα | manager |
| `buildings` | κτίριο, **scales** (πίνακες χιλιοστών), παράμετροι | manager |
| `apartments` | κωδικός, ιδιοκτήτης, **millesimes** map | manager |
| `people` | ιδιοκτήτες/ένοικοι | manager |
| `expenses` | δαπάνες περιόδου (group, method, scaleKey) | manager |
| `payments` | εισπράξεις ανά διαμέρισμα | manager |
| `statements` | εκδόσεις κοινοχρήστων (snapshot rows/totals) | manager |
| `fundEntries` | κινήσεις ταμείου | manager |
| `documents` | (μελλοντικό) | manager |
| `announcements` | ανακοινώσεις | manager (read: known) |
| `topics` / `comments` / `offers` | συζήτηση & προσφορές | create: known· delete: manager |
| `polls` / `votes` | ψηφοφορίες | polls: manager· votes: own |
| `assemblies` | ΓΣ (πρόσκληση/πρακτικά/αποφάσεις) | manager |
| `tickets` | βλάβες/αιτήματα | create: known· update: manager |
| `contracts` | συμβόλαια/συντηρήσεις + λήξεις | manager |
| `auditLogs` | ιστορικό ενεργειών | manager (immutable) |
| `mail` | ουρά email (extension) | μόνο functions |

Reads: γενικά «known user» (μέλος του κτιρίου). Οι ψήφοι είναι ιδιωτικές (ο
ψηφοφόρος βλέπει μόνο τη δική του· ο manager όλες).

## Μηχανή επιμερισμού (`allocation.ts`)
Αναπαράγει τη «Συγκεντρωτική Κατάσταση Δαπανών». Για κάθε δαπάνη:
- **millesime**: `ποσό × χιλιοστά[scale] / Σχιλιοστά[scale]`
- **equal**: `ποσό / Ν`
- **fixedPerApartment**: `ποσό` σε κάθε διαμέρισμα
- **heating**: κατά χιλιοστά θέρμανσης· τα *κλειστά* πληρώνουν
  `heatingClosedPercent%` του βάρους τους, το υπόλοιπο επιμερίζεται στα ανοιχτά.

Ανά διαμέρισμα: `σύνολο περιόδου = Σ(ομάδες) + έκδοση λογ/σμών`, και
`γενικό σύνολο = προηγούμενο υπόλοιπο + σύνολο περιόδου`. Κάθε μερίδιο
στρογγυλοποιείται στα 2 δεκαδικά.

**Επαλήθευση**: με το πραγματικό έντυπο (Κ. Καραμανλή 17) — ΠΑΡΙΔΗΣ 86 χιλ. →
κοινόχρηστα 137,47 €, ασανσέρ 32,17 €· γενικό σύνολο 2.259,36 €.

## Πίνακες χιλιοστών (scales)
Το κτίριο ορίζει λίστα `scales` (π.χ. Κοινόχρηστα/Γενικά, Ειδικές, Θέρμανση,
Ασανσέρ, Ιδιοκτητών) — **επεξεργάσιμη & επεκτάσιμη**. Κάθε διαμέρισμα κρατά τιμή
ανά scale (`millesimes[key]`). Οι αλλαγές καταγράφονται στο audit log.

## Πληρωμή (ειδοποιητήριο)
Κάθε ατομικό ειδοποιητήριο εμφανίζει **ΙΒΑΝ**, **κωδικό RF** (ISO 11649) και
**EPC/GiroCode QR** που σκανάρουν οι τραπεζικές εφαρμογές για έτοιμο έμβασμα.

## Multi-building (μελλοντικό)
Κάθε έγγραφο φέρει `buildingId`. Η επέκταση σε πολλές πολυκατοικίες (ή σε
ξεχωριστό GCP project) είναι migration/config, όχι επανασχεδιασμός.
