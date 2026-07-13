import { useEffect, useState } from 'react'
import { Save, Mail, Smartphone } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Button, Card, PageHeader, Field, TextField } from '@/components/forms'
import type { InviteSettings } from '@/types'
import { getInviteSettings, saveInviteSettings, DEFAULT_INVITE_SETTINGS } from '@/lib/repos/inviteSettings'
import { sendTestInvite } from '@/lib/invites'
import { logAudit } from '@/lib/audit'

export default function InviteSettingsPage() {
  const { user, profile } = useAuth()
  const [form, setForm] = useState<InviteSettings>(DEFAULT_INVITE_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [testEmail, setTestEmail] = useState('')
  const [testPhone, setTestPhone] = useState('')
  const [testing, setTesting] = useState<'email' | 'sms' | null>(null)
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function runTest(channel: 'email' | 'sms') {
    const to = channel === 'email' ? testEmail.trim() : testPhone.trim()
    if (!to) return
    setTesting(channel)
    setTestMsg(null)
    try {
      await sendTestInvite(channel, to)
      setTestMsg({ ok: true, text: `Στάλθηκε δοκιμαστικό ${channel === 'email' ? 'email' : 'SMS'} στο ${to}.` })
    } catch (e) {
      setTestMsg({ ok: false, text: 'Αποτυχία: ' + (e as Error).message })
    } finally {
      setTesting(null)
    }
  }

  useEffect(() => {
    getInviteSettings()
      .then(setForm)
      .finally(() => setLoading(false))
  }, [])

  function set<K extends keyof InviteSettings>(key: K, value: InviteSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function save() {
    setSaving(true)
    setMsg(null)
    try {
      await saveInviteSettings({
        ...form,
        appUrl: form.appUrl.trim(),
        fromEmail: form.fromEmail.trim(),
        fromName: form.fromName.trim(),
        smsSender: form.smsSender.trim(),
      })
      await logAudit({
        userEmail: user?.email ?? '',
        userName: profile?.name ?? user?.email ?? '',
        action: 'update',
        entity: 'settings',
        entityId: 'invites',
      })
      setMsg('Αποθηκεύτηκε.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-gray-400">Φόρτωση…</div>

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Προσκλήσεις"
        subtitle="Ρυθμίσεις αυτόματης πρόσκλησης χρηστών (email / SMS)"
        actions={
          <Button onClick={save} disabled={saving}>
            <Save size={18} /> {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
          </Button>
        }
      />

      {msg && <div className="mb-3 rounded-md bg-green-50 p-2 text-sm text-green-700">{msg}</div>}

      <Card>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => set('enabled', e.target.checked)}
          />
          Ενεργές αυτόματες προσκλήσεις
        </label>
        <p className="mt-1 text-xs text-gray-500">
          Όταν είναι ενεργό, μόλις προσθέτεις χρήστη στέλνεται πρόσκληση εισόδου — email (Brevo)
          αν το αναγνωριστικό είναι email, ή SMS (sms.to) αν είναι κινητό.
        </p>

        <div className="mt-4 space-y-3">
          <Field label="Διεύθυνση εφαρμογής (link πρόσκλησης)">
            <TextField value={form.appUrl} onChange={(e) => set('appUrl', e.target.value)} />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Email αποστολέα"
              hint="Πρέπει να είναι επιβεβαιωμένος αποστολέας (verified sender) στο Brevo."
            >
              <TextField
                type="email"
                placeholder="noreply@ο-τομέας-σου"
                value={form.fromEmail}
                onChange={(e) => set('fromEmail', e.target.value)}
              />
            </Field>
            <Field label="Όνομα αποστολέα (email)">
              <TextField value={form.fromName} onChange={(e) => set('fromName', e.target.value)} />
            </Field>
          </div>

          <Field label="Αποστολέας SMS (Sender ID)" hint="Αλφαριθμητικό, έως 11 χαρακτήρες.">
            <TextField value={form.smsSender} onChange={(e) => set('smsSender', e.target.value)} />
          </Field>
        </div>

        <p className="mt-4 rounded-md bg-amber-50 p-2 text-xs text-amber-700">
          Τα API keys (Brevo / sms.to) δεν ρυθμίζονται εδώ — μπαίνουν ως GitHub Secrets
          (<code>BREVO_API_KEY</code>, <code>SMSTO_API_KEY</code>) και ανεβαίνουν στις Cloud
          Functions κατά το deploy. Δες <code>docs/SETUP.md §10.3</code>.
        </p>
      </Card>

      <Card className="mt-4">
        <h2 className="mb-1 font-semibold text-gray-900">Δοκιμή αποστολής</h2>
        <p className="mb-3 text-xs text-gray-500">
          Στέλνει δοκιμαστικό μήνυμα με τις <b>αποθηκευμένες</b> ρυθμίσεις. Αποθήκευσε πρώτα
          τυχόν αλλαγές.
        </p>

        {testMsg && (
          <div
            className={`mb-3 rounded-md p-2 text-sm ${
              testMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {testMsg.text}
          </div>
        )}

        <div className="space-y-3">
          <Field label="Δοκιμή email">
            <div className="flex gap-2">
              <TextField
                type="email"
                placeholder="email παραλήπτη"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="secondary"
                onClick={() => runTest('email')}
                disabled={!testEmail.trim() || testing !== null}
              >
                <Mail size={16} /> {testing === 'email' ? 'Αποστολή…' : 'Δοκιμή'}
              </Button>
            </div>
          </Field>

          <Field label="Δοκιμή SMS">
            <div className="flex gap-2">
              <TextField
                type="tel"
                placeholder="+30…"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="secondary"
                onClick={() => runTest('sms')}
                disabled={!testPhone.trim() || testing !== null}
              >
                <Smartphone size={16} /> {testing === 'sms' ? 'Αποστολή…' : 'Δοκιμή'}
              </Button>
            </div>
          </Field>
        </div>
      </Card>
    </div>
  )
}
