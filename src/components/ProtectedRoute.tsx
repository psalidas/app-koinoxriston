import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'

export function ProtectedRoute({
  children,
  managerOnly = false,
}: {
  children: ReactNode
  managerOnly?: boolean
}) {
  const { loading, user, hasAccess, isManager } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-400">
        Φόρτωση…
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (!hasAccess) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 px-6 text-center">
        <h1 className="text-lg font-semibold text-gray-900">Δεν έχετε πρόσβαση</h1>
        <p className="max-w-sm text-sm text-gray-500">
          Ο λογαριασμός σας δεν έχει ενεργοποιηθεί. Επικοινωνήστε με τον
          διαχειριστή της πολυκατοικίας.
        </p>
      </div>
    )
  }

  if (managerOnly && !isManager) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
