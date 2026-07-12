import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Apartment, Building } from '@/types'
import { listBuildings } from './repos/buildings'
import { listApartments } from './repos/apartments'
import { isFirebaseConfigured } from './firebase'

interface AppDataValue {
  loading: boolean
  configured: boolean
  buildings: Building[]
  building: Building | null
  apartments: Apartment[]
  setBuildingId: (id: string) => void
  refresh: () => Promise<void>
}

const AppDataContext = createContext<AppDataValue | null>(null)

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [buildings, setBuildings] = useState<Building[]>([])
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [buildingId, setBuildingId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!isFirebaseConfigured) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const bs = await listBuildings()
      setBuildings(bs)
      const current = buildingId && bs.find((b) => b.id === buildingId) ? buildingId : bs[0]?.id ?? null
      setBuildingId(current)
      setApartments(current ? await listApartments(current) : [])
    } catch (err) {
      console.error('appData refresh failed', err)
    } finally {
      setLoading(false)
    }
  }, [buildingId])

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!buildingId || !isFirebaseConfigured) return
    listApartments(buildingId).then(setApartments).catch(console.error)
  }, [buildingId])

  const building = buildings.find((b) => b.id === buildingId) ?? null

  return (
    <AppDataContext.Provider
      value={{
        loading,
        configured: isFirebaseConfigured,
        buildings,
        building,
        apartments,
        setBuildingId,
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
