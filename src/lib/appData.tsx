import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Apartment, Building } from '@/types'
import { listBuildings } from './repos/buildings'
import { listApartments } from './repos/apartments'
import { isFirebaseConfigured } from './firebase'
import { useAuth } from './auth'

const LS_KEY = 'activeBuildingId'

interface AppDataValue {
  loading: boolean
  configured: boolean
  /** Κτίρια ορατά στον τρέχοντα χρήστη (superadmin = όλα). */
  buildings: Building[]
  building: Building | null
  apartments: Apartment[]
  setBuildingId: (id: string) => void
  /** Ορίζει ενεργό κτίριο από slug· επιστρέφει true αν βρέθηκε & επιτρέπεται. */
  setBuildingBySlug: (slug: string) => boolean
  refresh: () => Promise<void>
}

const AppDataContext = createContext<AppDataValue | null>(null)

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { superadmin, authIdentifier, profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [allBuildings, setAllBuildings] = useState<Building[]>([])
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [buildingId, setBuildingIdState] = useState<string | null>(
    () => localStorage.getItem(LS_KEY),
  )
  const [refreshTick, setRefreshTick] = useState(0)

  // Κτίρια ορατά στον χρήστη: superadmin → όλα· αλλιώς όσα διαχειρίζεται
  // (managerIds) ή ανήκει (profile.buildingIds).
  const buildings = useMemo(() => {
    if (superadmin) return allBuildings
    const myIds = new Set(profile?.buildingIds ?? [])
    const scoped = allBuildings.filter(
      (b) => myIds.has(b.id) || (b.managerIds ?? []).includes(authIdentifier ?? ''),
    )
    // Ασφάλεια: αν δεν προκύπτει κανένα (π.χ. legacy χρήστης χωρίς buildingIds)
    // μην κλειδώνεις — δείξε όλα (η απομόνωση επιβάλλεται με τους κανόνες).
    return scoped.length > 0 ? scoped : allBuildings
  }, [allBuildings, superadmin, profile, authIdentifier])

  const setBuildingId = useCallback((id: string) => {
    setBuildingIdState(id)
    try {
      localStorage.setItem(LS_KEY, id)
    } catch {
      // ignore
    }
  }, [])

  const refresh = useCallback(async () => {
    if (!isFirebaseConfigured) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setAllBuildings(await listBuildings())
      setRefreshTick((t) => t + 1) // ξαναφόρτωσε & τα διαμερίσματα ενεργού κτιρίου
    } catch (err) {
      console.error('appData refresh failed', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Έγκυρο ενεργό κτίριο εντός των ορατών.
  const activeId = useMemo(() => {
    if (buildings.length === 0) return null
    if (buildingId && buildings.some((b) => b.id === buildingId)) return buildingId
    return buildings[0].id
  }, [buildings, buildingId])

  // Συγχρονισμός persisted τιμής όταν το ενεργό αλλάζει αυτόματα.
  useEffect(() => {
    if (activeId && activeId !== buildingId) setBuildingId(activeId)
  }, [activeId, buildingId, setBuildingId])

  // Φόρτωση διαμερισμάτων ενεργού κτιρίου.
  useEffect(() => {
    if (!activeId || !isFirebaseConfigured) {
      setApartments([])
      return
    }
    listApartments(activeId).then(setApartments).catch(console.error)
  }, [activeId, refreshTick])

  const setBuildingBySlug = useCallback(
    (slug: string): boolean => {
      const b = buildings.find((x) => x.slug === slug)
      if (b) {
        setBuildingId(b.id)
        return true
      }
      return false
    },
    [buildings, setBuildingId],
  )

  const building = buildings.find((b) => b.id === activeId) ?? null

  return (
    <AppDataContext.Provider
      value={{
        loading,
        configured: isFirebaseConfigured,
        buildings,
        building,
        apartments,
        setBuildingId,
        setBuildingBySlug,
        refresh,
      }}
    >
      {children}
    </AppDataContext.Provider>
  )
}

export function useAppData(): AppDataValue {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData must be used within <AppDataProvider>')
  return ctx
}
