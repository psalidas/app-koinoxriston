# Παρακολούθηση CI/Deploy από τον Claude agent

Ο agent τρέχει σε sandbox με egress policy που **μπλοκάρει** αυθαίρετες
εξερχόμενες HTTPS συνδέσεις (`403 CONNECT`). Επομένως ο agent **δεν** μπορεί:
- να ανοίξει το live URL για έλεγχο,
- να τρέξει `firebase deploy` τοπικά,
- να καλέσει το GitHub REST API με `curl`.

Για να μπορεί ο agent να **βλέπει το deploy** (Actions runs, logs) και να κάνει
autofix, χρειάζεται ο **GitHub connector (MCP)**.

## Ενεργοποίηση GitHub connector
1. **claude.ai → Settings → Connectors** (ή «Integrations») → **GitHub** →
   **Connect / Authorize** → πρόσβαση στο `psalidas/app-koinoxriston`.
2. **GitHub → Settings → Applications → Installed GitHub Apps → Claude →
   Configure** → βεβαιώσου ότι το repo περιλαμβάνεται.
3. **Ξεκίνα νέο Claude session** — τα MCP εργαλεία (`mcp__github__*`) φορτώνουν
   στην έναρξη του session.

## Τι μπορεί ο agent μόλις συνδεθεί
- `mcp__github__actions_list` / `actions_get` — κατάσταση runs.
- `mcp__github__get_job_logs` — τα logs του κόκκινου βήματος (χωρίς copy-paste).
- `subscribe_pr_activity` — **αυτόματη** παράδοση CI failures & review comments
  στη συνομιλία, για autofix.

## Συνιστώμενη ροή μετά τη σύνδεση
Οι αλλαγές να πηγαίνουν μέσω **Pull Request** (branch → PR → merge σε `main`).
Έτσι το webhook του PR στέλνει ζωντανά την κατάσταση του deploy στον agent, ο
οποίος μπορεί να διορθώνει αποτυχίες πριν το merge.

## Εναλλακτικά (χωρίς connector)
Επικόλλησε στον agent τις τελευταίες ~15 γραμμές του κόκκινου βήματος από
GitHub → Actions → run → step. Έτσι διαγιγνώσκει και διορθώνει, όπως έγινε στο
αρχικό στήσιμο (δες `docs/DEPLOYMENT.md`).
