import { NavLink } from 'react-router-dom'
import { navFor } from './nav'
import { useAuth } from '@/lib/auth'

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { isManager } = useAuth()
  const items = navFor(isManager)

  let lastSection: string | undefined

  return (
    <nav className="flex h-full flex-col gap-0.5 overflow-y-auto p-3">
      <div className="mb-3 flex items-center gap-2 px-2 py-1">
        <img src="/icon.svg" alt="" className="h-8 w-8 rounded-md" />
        <div className="leading-tight">
          <div className="text-sm font-semibold text-gray-900">Πολυκατοικία</div>
          <div className="text-xs text-gray-500">Διαχείριση</div>
        </div>
      </div>
      {items.map((item) => {
        const showSection = item.section && item.section !== lastSection
        lastSection = item.section
        const Icon = item.icon
        return (
          <div key={item.to}>
            {showSection && (
              <div className="mb-1 mt-4 px-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {item.section}
              </div>
            )}
            <NavLink
              to={item.to}
              end={item.to === '/'}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <Icon size={18} />
              {item.label}
            </NavLink>
          </div>
        )
      })}
    </nav>
  )
}
