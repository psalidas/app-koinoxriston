# Οδηγός στησίματος — Firebase / Google Cloud

Βήμα-βήμα για να σηκώσεις την εφαρμογή σε δικό σου Firebase project. Χρόνος:
~20–30 λεπτά. Ένα Firebase project **είναι** ένα Google Cloud project — δεν
χρειάζεται κάτι ξεχωριστό στο GCP.

> Η προτεινόμενη ταυτότητα project: **`app-koinoxriston`**. Αν διαλέξεις άλλο id,
> άλλαξέ το στο `.firebaserc`, στο `.github/workflows/deploy.yml` και στο `.env`.

---

## 1. Δημιουργία Firebase project

1. Πήγαινε στο <https://console.firebase.google.com> και **Add project**.
2. Όνομα: `app-koinoxriston` (ή ό,τι θες). Σημείωσε το **Project ID** που θα σου
   προτείνει — αυτό είναι που μας ενδιαφέρει.
3. Google Analytics: μπορείς να το απενεργοποιήσεις (δεν χρειάζεται).

## 2. Web App & config

1. Στο project → εικονίδιο **`</>`** (Add app → Web).
2. Nickname: `web`. **Μην** ενεργοποιήσεις Firebase Hosting εδώ (θα το κάνουμε από CLI).
3. Θα σου δείξει το `firebaseConfig`. Αντέγραψε τις τιμές στο τοπικό `.env`:

```bash
cp .env.example .env
```

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=app-koinoxriston.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=app-koinoxriston
VITE_FIREBASE_STORAGE_BUCKET=app-koinoxriston.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef
```

> Αυτές οι τιμές **δεν είναι μυστικά** — φεύγουν στο client bundle. Η ασφάλεια
> προκύπτει από τα Firestore rules + τους περιορισμούς Auth.

## 3. Authentication

1. Build → **Authentication** → Get started.
2. **Sign-in method** → ενεργοποίησε:
   - **Google** (θα το χρησιμοποιείς εσύ ως διαχειριστής).
   - **Email/Password** → μέσα στο ίδιο, ενεργοποίησε **Email link (passwordless
     sign-in)** (για τους ενοίκους χωρίς κωδικό).
3. **Settings → Authorized domains**: πρόσθεσε το domain του hosting
   (`app-koinoxriston.web.app` και το custom domain αν βάλεις) + `localhost`.

> Το **SMS OTP login** (Phone Auth) θα το ενεργοποιήσουμε στη Φάση 2.

## 4. Firestore

1. Build → **Firestore Database** → Create database.
2. Τοποθεσία: **`eur3` (europe-west)**. Mode: **Production**.
3. Τους κανόνες (`firestore.rules`) θα τους ανεβάσουμε στο βήμα 6 — μην τους
   γράψεις με το χέρι.

## 5. Storage

1. Build → **Storage** → Get started (ίδια τοποθεσία, production mode).
   Χρησιμοποιείται για παραστατικά/έγγραφα.

## 6. Πρώτο deploy από CLI

```bash
npm install -g firebase-tools
firebase login
firebase use app-koinoxriston      # ή: firebase use --add

npm run build
firebase deploy --only hosting,firestore:rules,firestore:indexes,storage
```

Στο τέλος θα σου δώσει το URL: `https://app-koinoxriston.web.app`.

## 7. Bootstrap (πρώτη είσοδος)

1. Άνοιξε το URL και **Είσοδος με Google** ως `michael@crowdpolicy.com`
   (είναι hardcoded bootstrap admin στα rules).
2. Στον **Πίνακα** πάτα «Δημιουργία πολυκατοικίας-δείγματος» → φτιάχνει το κτίριο
   Κ. Καραμανλή 17 με τα 15 διαμερίσματα, τους πίνακες χιλιοστών και δείγμα δαπανών.
3. Πήγαινε **Διαχείριση → Χρήστες** και πρόσθεσε τουλάχιστον έναν ακόμη
   διαχειριστή (ώστε να μην εξαρτάσαι μόνο από τον bootstrap admin).

## 8. Auto-deploy με GitHub Actions

Ώστε κάθε push στο `main` να κάνει deploy μόνο του:

1. **Service account**: Google Cloud Console → IAM & Admin → Service Accounts →
   Create. Δώσε ρόλους:
   - *Firebase Hosting Admin*
   - *Cloud Datastore Index Admin*
   - *Firebase Rules Admin*
   - *Service Account User*
   Μετά → Keys → **Add key → JSON** → κατέβασέ το.
2. **GitHub Secret**: repo → Settings → Secrets and variables → Actions → New
   repository secret, όνομα **`FIREBASE_SERVICE_ACCOUNT`**, τιμή = όλο το JSON.
3. Άνοιξε το `.github/workflows/deploy.yml` και συμπλήρωσε τα `VITE_FIREBASE_*`
   στο μπλοκ `env:` (ίδιες τιμές με το `.env`) + βεβαιώσου ότι το
   `--project app-koinoxriston` είναι το σωστό id.
4. Push στο `main`. Το Actions χτίζει & κάνει deploy (~60–90 δευτ.).

## 9. Custom domain (προαιρετικό)

Firebase Hosting → Add custom domain → ακολούθησε τις οδηγίες DNS. Δωρεάν SSL.

---

## 10. Φάση 2 — Portal ενοίκων & ειδοποιήσεις

### 10.1 SMS OTP login (Phone Auth)
1. Authentication → Sign-in method → ενεργοποίησε **Phone**.
2. Στα *Authorized domains* πρέπει να υπάρχει το domain σου (βήμα 3).
3. Το Phone Auth στέλνει SMS μέσω Google — έχει δωρεάν όριο, μετά χρεώνεται
   (απαιτεί **Blaze** plan για παραγωγή). Για δοκιμές μπορείς να προσθέσεις
   *test phone numbers* στο Auth.
4. Στο *Χρήστες* βάλε ως αναγνωριστικό το κινητό σε διεθνή μορφή (`+30…`) και
   σύνδεσέ το με διαμέρισμα, ώστε ο ένοικος να βλέπει την καρτέλα του.

### 10.2 Email ειδοποιήσεις (Cloud Functions + extension)
Οι functions (`functions/`) γράφουν έγγραφα στη συλλογή `mail`· η αποστολή
γίνεται από το extension **firestore-send-email**.

1. Αναβάθμισε το project σε **Blaze** (pay-as-you-go) — απαιτείται για
   Functions Gen2 & extensions. Έχει γενναιόδωρο δωρεάν όριο.
2. Εγκατέστησε το extension:
   ```bash
   firebase ext:install firebase/firestore-send-email --project app-koinoxriston
   ```
   Ρύθμισε SMTP connection URI (π.χ. Gmail/SendGrid), collection = `mail`.
3. Deploy των functions:
   ```bash
   firebase deploy --only functions --project app-koinoxriston
   ```
   (ή πρόσθεσε `functions` στο `--only` του `.github/workflows/deploy.yml`).

> Οι functions είναι σκόπιμα **εκτός** του default deploy του GitHub Actions,
> ώστε το hosting να δουλεύει και σε δωρεάν (Spark) plan. Ενεργοποίησέ τες όταν
> περάσεις σε Blaze.

---

## Troubleshooting

- **Λευκή σελίδα / «απαιτείται ρύθμιση»**: λείπουν/λάθος `VITE_FIREBASE_*` στο `.env`.
- **`Missing or insufficient permissions`**: δεν έχεις doc στο `/users` και δεν
  είσαι ο bootstrap admin — μπες ως `michael@crowdpolicy.com` και πρόσθεσε χρήστη.
- **Email link δεν δουλεύει**: το domain δεν είναι στα *Authorized domains*.
- **Deploy 403 στο Actions**: λείπουν ρόλοι στο service account (βήμα 8.1).
