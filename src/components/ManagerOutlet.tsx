import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/lib/auth'

/** Renders child routes only for managers; residents go to their portal. */
export function ManagerOutlet() {
  const { loading, isManager } = useAuth()
  if (loading) return null
  return isManager ? <Outlet /> : <Navigate to="/portal" replace />
}
