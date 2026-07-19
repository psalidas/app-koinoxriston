import { money, amount, mille, formatDate } from '@/lib/format'
import type { ExpenseGroup, Statement, StatementRow } from '@/types'
import { GROUP_LABELS, GROUP_ORDER, GROUP_SCALE_KEY } from '@/types'
import { rfReference, groupRef } from '@/lib/paymentRef'
import { Footer } from './Footer'

/** Το σώμα ενός ατομικού ειδοποιητηρίου (κοινό για single & μαζική εκτύπωση). */
export function NoticeDocument({
  st,
  row,
  iban,
  qr,
  area,
}: {
  st: Statement
  row: StatementRow
  iban: string
  qr: string | null
  /** Περιοχή κτιρίου (προαιρετικό — από τις ρυθμίσεις). */
  area?: string
}) {
  const reference = rfReference(`${st.buildingCode}${row.code}${st.period}`)
  const showBilling = (st.totals.billingFees ?? 0) !== 0
  // Σύνολο χιλιοστών πολυκατοικίας ανά κλίμακα (για τη στήλη «Χιλ. πολ/κίας»).
  const buildingMille = (scaleKey: string) =>
    st.rows.reduce((s, r) => s + (r.millesimes[scaleKey] ?? 0), 0)
  const linesByGroup = (g: ExpenseGroup) => st.expenseLines.filter((l) => l.group === g)
  // Εμφανίζουμε μόνο κατηγορίες με έξοδο (χωρίς κενές γραμμές).
  const noticeGroups: ExpenseGroup[] = GROUP_ORDER.filter((g) => (st.totals.byGroup[g] ?? 0) !== 0)

  const cell = 'border border-gray-400 px-1 py-0.5'

  return (
    <div className="text-[11px] text-gray-900">
      {/* Κεφαλίδα */}
      <div className="flex border border-gray-400">
        <div className="flex-1 border-r border-gray-400 p-2 text-[10px] leading-tight">
          <div className="font-semibold">Διαχειριστής: {st.managerName}</div>
          <div>{st.buildingName}</div>
          <div>{st.buildingAddress}{area ? `, ${area}` : ''}</div>
        </div>
        <div className="flex-1 p-2 text-center">
          <div className="text-sm font-bold tracking-wide">ΕΙΔΟΠΟΙΗΤΗΡΙΟ ΔΙΑΜΕΡΙΣΜΑΤΟΣ</div>
          <div className="mt-1 flex justify-center gap-4 text-[10px]">
            <span>ΜΗΝΑΣ: {st.periodLabel}</span>
            <span>ΗΜ/ΝΙΑ: {formatDate(st.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Στοιχεία κτιρίου / διαμερίσματος */}
      <div className="flex border-x border-b border-gray-400 text-[10px]">
        <div className={cell}>
          <span className="text-gray-500">ΚΩΔΙΚΟΣ</span> <b>{st.buildingCode}</b>
        </div>
        <div className={`${cell} flex-1`}>
          <span className="text-gray-500">ΔΙΕΥΘΥΝΣΗ</span> {st.buildingAddress}
        </div>
        {area && (
          <div className={cell}>
            <span className="text-gray-500">ΠΕΡΙΟΧΗ</span> {area}
          </div>
        )}
      </div>
      <div className="flex border-x border-b border-gray-400 text-[10px]">
        <div className={`${cell} flex-1`}>
          <span className="text-gray-500">ΟΝΟΜΑ - ΔΙΑΜΕΡΙΣΜΑ:</span>{' '}
          <b>{row.ownerName} — {row.code}</b>
        </div>
        <div className={cell}>
          <span className="text-gray-500">ΓΕΝΙΚΟ ΣΥΝΟΛΟ ΠΟΛ/ΚΙΑΣ:</span>{' '}
          <b className="tnum">{amount(st.totals.grandTotal)}</b>
        </div>
      </div>

      {/* Ανάλυση εξόδων κατά κατηγορία */}
      <table className="w-full table-fixed border-x border-b border-gray-400 text-[10px]">
        <colgroup>
          <col style={{ width: '16%' }} />
          <col />
          <col style={{ width: '13%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '13%' }} />
        </colgroup>
        <thead>
          <tr className="bg-gray-100 text-center">
            <th className={`${cell} text-left`}>Κατηγορία</th>
            <th className={`${cell} text-left`}>Ανάλυση εξόδων</th>
            <th className={cell}>Σύνολο</th>
            <th className={cell}>Χιλ. δ/τος</th>
            <th className={cell}>Χιλ. πολ.</th>
            <th className={cell}>Χρέωση</th>
          </tr>
        </thead>
        <tbody>
          {noticeGroups.map((g, idx) => {
            const scaleKey = GROUP_SCALE_KEY[g]
            const lines = linesByGroup(g)
            return (
              <tr key={g} className="align-top" style={idx % 2 === 1 ? { backgroundColor: '#f1f3f5' } : undefined}>
                <td className={`${cell} font-semibold`}>{GROUP_LABELS[g]}</td>
                <td className={cell}>
                  {lines.map((l, i) => (
                    <div key={i} className="flex justify-between gap-2">
                      <span className="truncate">{l.category}</span>
                      <span className="tnum shrink-0">{amount(l.amount)}</span>
                    </div>
                  ))}
                </td>
                <td className={`${cell} text-right tnum`}>{amount(st.totals.byGroup[g] ?? 0)}</td>
                <td className={`${cell} text-right tnum`}>
                  {scaleKey ? mille(row.millesimes[scaleKey] ?? 0) : '—'}
                </td>
                <td className={`${cell} text-right tnum`}>
                  {scaleKey ? mille(buildingMille(scaleKey)) : '—'}
                </td>
                <td className={`${cell} text-right tnum font-medium`}>{amount(row.amounts[g] ?? 0)}</td>
              </tr>
            )
          })}
          {showBilling && (
            <tr>
              <td className={`${cell} font-semibold`}>Έκδοση</td>
              <td className={cell}>Έκδοση λογαριασμών</td>
              <td className={`${cell} text-right tnum`}>{amount(st.totals.billingFees)}</td>
              <td className={cell}></td>
              <td className={cell}></td>
              <td className={`${cell} text-right tnum font-medium`}>{amount(row.billingFee)}</td>
            </tr>
          )}
          <tr className="bg-gray-200 font-bold">
            <td className={cell} colSpan={5}>
              ΣΥΝΟΛΟ ΠΕΡΙΟΔΟΥ
            </td>
            <td className={`${cell} text-right tnum`}>{amount(row.currentCharge)}</td>
          </tr>
        </tbody>
      </table>

      {/* Προηγούμενες οφειλές & πληρωτέο */}
      <div className="flex border-x border-b border-gray-400 text-[11px]">
        <div className={`${cell} flex-1`}>
          Προηγούμενες οφειλές: <span className="tnum">{amount(row.previousBalance)}</span>
        </div>
        <div className={`${cell} bg-blue-50`}>
          <b>ΠΟΣΟ ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΠΛΗΡΩΣΕΙ: </b>
          <b className="tnum text-blue-900">{money(row.total)}</b>
        </div>
      </div>

      {/* Πληρωμή (IBAN / QR) */}
      <div className="mt-3 rounded-md border border-gray-200 p-3">
        <div className="mb-2 text-xs font-semibold uppercase text-gray-500">Πληρωμή</div>
        {iban ? (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 text-xs">
              <div className="text-gray-500">IBAN</div>
              <div className="break-all font-mono">{iban}</div>
              <div className="mt-2 text-gray-500">Κωδικός πληρωμής (RF)</div>
              <div className="break-all font-mono">{groupRef(reference)}</div>
            </div>
            {qr && <img src={qr} alt="QR πληρωμής" className="h-28 w-28 shrink-0" />}
          </div>
        ) : (
          <p className="text-xs text-gray-400">
            Ορίστε ΙΒΑΝ στις «Ρυθμίσεις κτιρίου» για να εμφανίζεται κωδικός & QR πληρωμής.
          </p>
        )}
      </div>

      <p className="mt-3 text-center text-[10px] text-gray-400">
        Έκδοση {formatDate(st.createdAt)} · {st.buildingCode}
      </p>

      <Footer className="print-only mt-2 border-t border-gray-100" />
    </div>
  )
}
