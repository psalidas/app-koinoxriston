import gfc from '@/assets/logos/gfc.png'
import crowdpolicy from '@/assets/logos/crowdpolicy.png'

/** Υποσέλιδο branding — εμφανίζεται στην πλατφόρμα & στις εκτυπώσεις. */
export function Footer({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-2 py-3 text-[11px] text-gray-400 ${className}`}>
      <span>Powered by Greek Fintech Cluster, Crowdpolicy Group</span>
      <img src={gfc} alt="Greek Fintech Cluster" className="h-4 w-auto opacity-70" />
      <img src={crowdpolicy} alt="Crowdpolicy" className="h-4 w-auto opacity-70" />
    </div>
  )
}
