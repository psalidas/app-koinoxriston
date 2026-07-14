import gfc from '@/assets/logos/gfc.png'
import crowdpolicy from '@/assets/logos/crowdpolicy.png'

const GFC_URL = 'https://fintech.net.gr/el/'
const CP_URL = 'https://www.crowdpolicy.com/el/'

/** Υποσέλιδο branding — μία ευθεία (inline), εμφανίζεται στην πλατφόρμα &
 *  στις εκτυπώσεις. Χρήση inline στοιχείων (αντί flex) για αξιόπιστη
 *  απόδοση στη μηχανή εκτύπωσης. */
export function Footer({ className = '' }: { className?: string }) {
  return (
    <div className={`whitespace-nowrap py-3 text-center text-[11px] text-gray-400 ${className}`}>
      <span className="align-middle">
        Powered by{' '}
        <a href={GFC_URL} target="_blank" rel="noreferrer" className="hover:text-gray-600 hover:underline">
          Greek Fintech Cluster
        </a>
        ,{' '}
        <a href={CP_URL} target="_blank" rel="noreferrer" className="hover:text-gray-600 hover:underline">
          Crowdpolicy Group
        </a>
      </span>
      <a href={GFC_URL} target="_blank" rel="noreferrer">
        <img src={gfc} alt="Greek Fintech Cluster" className="ml-2 inline h-4 w-auto align-middle opacity-70" />
      </a>
      <a href={CP_URL} target="_blank" rel="noreferrer">
        <img src={crowdpolicy} alt="Crowdpolicy" className="ml-1 inline h-4 w-auto align-middle opacity-70" />
      </a>
    </div>
  )
}
