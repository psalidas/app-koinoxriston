import { money, amount, mille, formatDate } from '@/lib/format'
import { round2 } from '@/lib/allocation'
import type { ExpenseGroup, Statement, StatementRow } from '@/types'
import { GROUP_LABELS, GROUP_ORDER, GROUP_SCALE_KEY } from '@/types'
import { Footer } from './Footer'

const OWNER_GROUP: ExpenseGroup = 'idioktiton'

/**
 * Απόδειξη Ενοίκου + Απόδειξη Ιδιοκτήτη για ένα διαμέρισμα.
 * Ο ένοικος πληρώνει τα λειτουργικά (όλες οι κατηγορίες πλην «Ιδιοκτητών»),
 * ο ιδιοκτήτης την κατηγορία «Ιδιοκτητών». Το προηγούμενο υπόλοιπο αποδίδεται
 * στον ένοικο.
 */
export function ReceiptDocument({
  st,
  row,
  area,
}: {
  st: Statement
  row: StatementRow
  area?: string
}) {
  const buildingMille = (scaleKey: string) =>
    st.rows.reduce((s, r) => s + (r.millesimes[scaleKey] ?? 0), 0)
  const cell = 'border border-gray-400 px-1 py-0.5'

  const tenantGroups = GROUP_ORDER.filter(
    (g) => g !== OWNER_GROUP && (st.totals.byGroup[g] ?? 0) !== 0,
  )
  const tenantPeriod = round2(
    tenantGroups.reduce((s, g) => s + (row.amounts[g] ?? 0), 0) + row.billingFee,
  )
  const ownerPeriod = round2(row.amounts[OWNER_GROUP] ?? 0)
  const tenantTotal = round2(tenantPeriod + row.previousBalance)
  const ownerTotal = ownerPeriod

  const showBilling = row.billingFee !== 0

  const Header = ({ title, who }: { title: string; who: string }) => (
    <>
      <div className="flex border border-gray-400">
        <div className="flex-1 border-r border-gray-400 p-2 text-[10px] leading-tight">
          <div className="font-semibold">Διαχειριστής: {st.managerName}</div>
          <div>{st.buildingName}</div>
          <div>
            {st.buildingAddress}
            {area ? `, ${area}` : ''}
          </div>
        </div>
        <div className="flex-1 p-2 text-center">
          <div className="text-sm font-bold tracking-wide">{title}</div>
          <div className="mt-1 flex justify-center gap-4 text-[10px]">
            <span>ΜΗΝΑΣ: {st.periodLabel}</span>
            <span>ΗΜ/ΝΙΑ: {formatDate(st.createdAt)}</span>
          </div>
        </div>
      </div>
      <div className="flex border-x border-b border-gray-400 text-[10px]">
        <div className={cell}>
          <span className="text-gray-500">ΚΩΔΙΚΟΣ</span> <b>{st.buildingCode}</b>
        </div>
        <div className={`${cell} flex-1`}>
          <span className="text-gray-500">ΔΙΕΥΘΥΝΣΗ</span> {st.buildingAddress}
        </div>
        <div className={`${cell} flex-1`}>
          <span className="text-gray-500">{who} - ΔΙΑΜΕΡΙΣΜΑ:</span>{' '}
          <b>{row.ownerName} — {row.code}</b>
        </div>
      </div>
    </>
  )

  const AmountBox = ({
    period,
    total,
    label,
  }: {
    period: number
    total: number
    label: string
  }) => (
    <div className="flex border-x border-b border-gray-400 text-[11px]">
      <div className={`${cell} flex-1`}>
        Ποσό περιόδου: <span className="tnum">{amount(period)}</span>
      </div>
      <div className={`${cell} flex-1`}>
        Προηγ. υπόλοιπο: <span className="tnum">{amount(total - period)}</span>
      </div>
      <div className={`${cell} bg-blue-50`}>
        <b>{label}: </b>
        <b className="tnum text-blue-900">{money(total)}</b>
      </div>
    </div>
  )

  return (
    <div className="text-[11px] text-gray-900">
      {/* ── ΑΠΟΔΕΙΞΗ ΕΝΟΙΚΟΥ ───────────────────────────────────────── */}
      <Header title="ΑΠΟΔΕΙΞΗ ΕΝΟΙΚΟΥ" who="ΟΝΟΜΑ ΕΝΟΙΚΟΥ" />
      <table className="w-full table-fixed border-x border-b border-gray-400 text-[10px]">
        <colgroup>
          <col style={{ width: '30%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '17%' }} />
          <col style={{ width: '17%' }} />
          <col style={{ width: '18%' }} />
        </colgroup>
        <thead>
          <tr className="bg-gray-100 text-center">
            <th className={`${cell} text-left`}>Κατηγορίες εξόδων</th>
            <th className={cell}>Σύνολο εξόδων</th>
            <th className={cell}>Χιλ. διαμ/τος</th>
            <th className={cell}>Χιλ. πολ/κίας</th>
            <th className={cell}>Επιβάρυνση διαμ/τος</th>
          </tr>
        </thead>
        <tbody>
          {tenantGroups.map((g, idx) => {
            const scaleKey = GROUP_SCALE_KEY[g]
            return (
              <tr key={g} style={idx % 2 === 1 ? { backgroundColor: '#f1f3f5' } : undefined}>
                <td className={`${cell} font-semibold`}>{GROUP_LABELS[g]}</td>
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
              <td className={`${cell} font-semibold`}>Έκδοση λογαριασμών</td>
              <td className={`${cell} text-right tnum`}>{amount(st.totals.billingFees)}</td>
              <td className={cell}></td>
              <td className={cell}></td>
              <td className={`${cell} text-right tnum font-medium`}>{amount(row.billingFee)}</td>
            </tr>
          )}
        </tbody>
      </table>
      <AmountBox period={tenantPeriod} total={tenantTotal} label="ΠΟΣΟ ΕΝΟΙΚΟΥ" />

      {/* ── ΑΠΟΔΕΙΞΗ ΙΔΙΟΚΤΗΤΗ ─────────────────────────────────────── */}
      <div className="mt-4">
        <Header title="ΑΠΟΔΕΙΞΗ ΙΔΙΟΚΤΗΤΗ" who="ΟΝΟΜΑ ΙΔΙΟΚΤΗΤΗ" />
        <table className="w-full table-fixed border-x border-b border-gray-400 text-[10px]">
          <colgroup>
            <col style={{ width: '30%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '18%' }} />
          </colgroup>
          <thead>
            <tr className="bg-gray-100 text-center">
              <th className={`${cell} text-left`}>Κατηγορία</th>
              <th className={cell}>Σύνολο εξόδων</th>
              <th className={cell}>Χιλ. διαμ/τος</th>
              <th className={cell}>Χιλ. πολ/κίας</th>
              <th className={cell}>Επιβάρυνση ιδιοκτήτη</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={`${cell} font-semibold`}>{GROUP_LABELS[OWNER_GROUP]}</td>
              <td className={`${cell} text-right tnum`}>{amount(st.totals.byGroup[OWNER_GROUP] ?? 0)}</td>
              <td className={`${cell} text-right tnum`}>{mille(row.millesimes.idioktiton ?? 0)}</td>
              <td className={`${cell} text-right tnum`}>{mille(buildingMille('idioktiton'))}</td>
              <td className={`${cell} text-right tnum font-medium`}>{amount(ownerPeriod)}</td>
            </tr>
          </tbody>
        </table>
        <AmountBox period={ownerPeriod} total={ownerTotal} label="ΠΟΣΟ ΙΔΙΟΚΤΗΤΗ" />
      </div>

      <p className="mt-3 text-center text-[10px] text-gray-400">
        Έκδοση {formatDate(st.createdAt)} · {st.buildingCode} · Ο διαχειριστής: {st.managerName}
      </p>

      <Footer className="print-only mt-2 border-t border-gray-100" />
    </div>
  )
}
