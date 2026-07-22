import { useEffect, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { useAppData } from '@/lib/appData'

/** /b/:slug → ορίζει το ενεργό κτίριο από το slug και ανακατευθύνει στην αρχική. */
export default function BuildingRedirect() {
  const { slug } = useParams()
  const { buildings, loading, setBuildingBySlug } = useAppData()
  const [done, setDone] = useState(false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (loading) return
    if (slug && setBuildingBySlug(slug)) {
      setDone(true)
    } else if (buildings.length > 0) {
      setNotFound(true)
    }
  }, [loading, buildings, slug, setBuildingBySlug])

  if (done) return <Navigate to="/" replace />
  if (notFound) {
    return (
      <div className="mx-auto max-w-md py-16 text-center text-gray-500">
        <p className="text-sm">Το κτίριο «{slug}» δεν βρέθηκε ή δεν έχετε πρόσβαση.</p>
      </div>
    )
  }
  return <div className="py-16 text-center text-gray-400">Φόρτωση…</div>
}
