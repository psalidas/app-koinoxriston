import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { AppDataProvider } from '@/lib/appData'

export function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <AppDataProvider>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 border-r border-gray-200 bg-white lg:block">
          <Sidebar />
        </aside>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
            <div className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl">
              <Sidebar onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onMenu={() => setDrawerOpen(true)} />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </AppDataProvider>
  )
}
