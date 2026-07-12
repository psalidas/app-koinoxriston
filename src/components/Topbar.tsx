import { Menu, LogOut, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { useAppData } from '@/lib/appData'

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user, profile, signOut } = useAuth()
  const { buildings, building, setBuildingId } = useAppData()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2.5">
      <button
        onClick={onMenu}
        className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 lg:hidden"
        aria-label="Μενού"
      >
        <Menu size={22} />
      </button>

      <div className="min-w-0 flex-1">
        {buildings.length > 1 ? (
          <select
            value={building?.id ?? ''}
            onChange={(e) => setBuildingId(e.target.value)}
            className="max-w-full truncate rounded-md border border-gray-200 bg-white px-2 py-1 text-sm font-medium text-gray-800"
          >
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="truncate text-sm font-semibold text-gray-800">
            {building?.name ?? 'Διαχείριση Πολυκατοικίας'}
          </div>
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-gray-700 hover:bg-gray-100"
        >
          <span className="hidden max-w-[12rem] truncate sm:inline">
            {profile?.name || user?.email}
          </span>
          <ChevronDown size={16} />
        </button>
        {menuOpen && (
          <div
            className="absolute right-0 mt-1 w-56 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
            onMouseLeave={() => setMenuOpen(false)}
          >
            <div className="border-b border-gray-100 px-3 py-2 text-xs text-gray-500">
              {user?.email}
            </div>
            <button
              onClick={() => void signOut()}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <LogOut size={16} /> Αποσύνδεση
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
