# Deployment — Runbook & Κατάσταση

Τεκμηρίωση του πώς γίνεται deploy, τι χρειάστηκε, και πού βρισκόμαστε.

## Αρχιτεκτονική deploy

```
push στο main ──► GitHub Actions (.github/workflows/deploy.yml) ──► firebase deploy
                    (npm ci → npm run build → auth με SA → deploy)
```

- Trigger: `push` στο `main` (+ `workflow_dispatch`).
- Οι τιμές `VITE_FIREBASE_*` είναι στο `env:` του workflow (δεν είναι μυστικά).
- Μοναδικό secret: **`FIREBASE_SERVICE_ACCOUNT`** (JSON service-account key) στα
  GitHub → Settings → Secrets and variables → Actions.
- Το build τρέχει στους runners του GitHub (χωρίς egress περιορισμούς).

## Τρέχουσα κατάσταση (live)

| Στοιχείο | Κατάσταση |
|---|---|
| Firebase project | `app-koinoxriston` |
| Hosting URL | https://app-koinoxriston.web.app ✅ **live** |
| Deploy targets ενεργά | `hosting`, `firestore:rules` ✅ |
| `firestore:indexes` | ⏸️ προσωρινά εκτός (θέλει *Cloud Datastore Index Admin*) |
| `storage` (rules) | ⏸️ προσωρινά εκτός (θέλει *Firebase Storage Admin* + default bucket) |
| Cloud Functions (email) | ⏸️ όχι deployed (θέλει Blaze + extension) |

Το `--only` στο workflow αυτή τη στιγμή:
```
--only hosting,firestore:rules
```

## Service account — ρόλοι (πλήρης, επιβεβαιωμένη λίστα)

Στον service account του GitHub (Google Cloud → IAM):

| Ρόλος | Γιατί |
|---|---|
| Firebase Hosting Admin | hosting deploy |
| Firebase Rules Admin | firestore & storage rules |
| Cloud Datastore Index Admin | firestore composite indexes |
| Service Usage Admin | firebase-tools API check/enable |
| Firebase Storage Admin | storage rules / default bucket |
| Service Account User | χρήση του SA |

## Ιστορικό deploy (τι συνέβη & πώς λύθηκε)

| # | Σφάλμα | Αιτία | Λύση |
|---|---|---|---|
| 1 | `403 serviceusage … services.get [firebasestorage]` | SA χωρίς δικαίωμα ελέγχου APIs | Ρόλος **Service Usage Admin** |
| 2 | `403 firebasestorage.defaultBucket.get … (or it may not exist)` | SA χωρίς Storage δικαίωμα / bucket | Προσωρινά αφαιρέθηκε το `storage`· χρειάζεται **Firebase Storage Admin** + επιβεβαίωση default bucket |
| 3 | `403 … collectionGroups/-/indexes … caller does not have permission` | SA χωρίς index δικαίωμα | Προσωρινά αφαιρέθηκε το `firestore:indexes`· χρειάζεται **Cloud Datastore Index Admin** |
| ✔ | `hosting + firestore:rules` | — | **Πράσινο / live** |

> Σημείωση: rules & hosting ανεβαίνουν κανονικά· τα indexes/storage απλώς
> περιμένουν τους 2 επιπλέον ρόλους.

## Πώς ξαναενεργοποιούμε indexes + storage

1. Στον service account πρόσθεσε: **Cloud Datastore Index Admin** και
   **Firebase Storage Admin** (και βεβαιώσου ότι το Storage default bucket
   `app-koinoxriston.firebasestorage.app` υπάρχει — Firebase console → Storage).
2. Στο `.github/workflows/deploy.yml`, γύρνα το target σε:
   ```
   --only hosting,firestore:rules,firestore:indexes,storage
   ```
3. Push στο `main` → πλήρες deploy.

Χωρίς τα indexes, όλες οι λειτουργίες δουλεύουν **εκτός** από τη σελίδα
«Ιστορικό» (audit log) που κάνει σύνθετο query (`buildingId` + `orderBy
timestamp`). Χωρίς τα storage rules, το ανέβασμα αρχείων (παραστατικά/φωτό/
έγγραφα) δεν λειτουργεί μέχρι να ανέβουν οι κανόνες.

## Cloud Functions (email ειδοποιήσεις) — προαιρετικό

1. Αναβάθμιση project σε **Blaze**.
2. `firebase ext:install firebase/firestore-send-email` (collection `mail`, SMTP).
3. Πρόσθεσε `functions` στο `--only` του workflow **ή** τρέξε χειροκίνητα
   `firebase deploy --only functions`.

## Bootstrap μετά το live

1. Login στο URL με Google ως `michael@crowdpolicy.com` (bootstrap admin).
2. «Δημιουργία πολυκατοικίας-δείγματος» (Κ. Καραμανλή 17).
3. Χρήστες → πρόσθεσε 2ο διαχειριστή & ενοίκους (email ή κινητό `+30…`).

## Περιορισμός περιβάλλοντος ανάπτυξης (σημείωση)

Το sandbox του agent έχει egress policy που **μπλοκάρει** εξερχόμενες HTTPS
συνδέσεις σε αυθαίρετους hosts (π.χ. `*.web.app`, `googleapis.com`) με
`403 CONNECT`. Συνέπειες:
- Δεν γίνεται επαλήθευση του live URL ούτε `firebase deploy` από το sandbox.
- Το deploy γίνεται **αποκλειστικά** από τους GitHub runners.
- Η παρακολούθηση CI από τον agent απαιτεί τον **GitHub connector** (MCP) — δες
  `docs/OBSERVABILITY.md`.
