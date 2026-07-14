import gfc from '@/assets/logos/gfc.png'
import crowdpolicy from '@/assets/logos/crowdpolicy.png'

const GFC_URL = 'https://fintech.net.gr/el/'
const CP_URL = 'https://www.crowdpolicy.com/el/'

/** Υποσέλιδο branding — εμφανίζεται στην πλατφόρμα & στις εκτυπώσεις. */
export function Footer({ className = '' }: { className?: string }) {
  return (
    <div
      className={`flex flex-nowrap items-center justify-center gap-2 whitespace-nowrap py-3 text-[11px] text-gray-400 ${className}`}
    >
      <span>
        Powered by{' '}
        <a href={GFC_URL} target="_blank" rel="noreferrer" className="hover:text-gray-600 hover:underline">
          Greek Fintech Cluster
        </a>
        ,{' '}
        <a href={CP_URL} target="_blank" rel="noreferrer" className="hover:text-gray-600 hover:underline">
          Crowdpolicy Group
        </a>
      </span>
      <a href={GFC_URL} target="_blank" rel="noreferrer" className="shrink-0">
        <img src={gfc} alt="Greek Fintech Cluster" className="h-4 w-auto shrink-0 opacity-70" />
      </a>
      <a href={CP_URL} target="_blank" rel="noreferrer" className="shrink-0">
        <img src={crowdpolicy} alt="Crowdpolicy" className="h-4 w-auto shrink-0 opacity-70" />
      </a>
    </div>
  )
}
