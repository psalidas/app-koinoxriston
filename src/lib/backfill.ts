import { listBuildings, updateBuilding, slugify } from './repos/buildings'
import { listUsers } from './repos/users'
import { saveMember } from './repos/members'
import type { Building } from '@/types'

export interface BackfillResult {
  buildings: number
  buildingsUpdated: number
  members: number
}

/**
 * Μετάβαση σε multi-building: για κάθε υπάρχον κτίριο συμπληρώνει slug/managerIds/
 * active (αν λείπουν) και δημιουργεί εγγραφές μελών (/buildings/{id}/members)
 * από τους υπάρχοντες χρήστες (βάσει buildingIds). Idempotent — τρέχει με ασφάλεια
 * όσες φορές θέλεις. Απαιτεί δικαιώματα διαχειριστή/superadmin.
 */
export async function backfillMembers(): Promise<BackfillResult> {
  const [buildings, users] = await Promise.all([listBuildings(), listUsers()])
  let buildingsUpdated = 0
  let members = 0

  for (const b of buildings) {
    const bUsers = users.filter((u) => (u.buildingIds ?? []).includes(b.id))
    const patch: Partial<Building> = {}

    if (!b.slug) {
      // Ειδική περίπτωση Καραμανλή → 'karamanli17', αλλιώς slug από όνομα/διεύθυνση.
      patch.slug = /καραμανλ/i.test(`${b.name} ${b.address}`)
        ? 'karamanli17'
        : slugify(b.name || b.address) || `ktirio-${b.code || b.id.slice(0, 6)}`
    }
    const mgrs = bUsers.filter((u) => u.role === 'admin' || u.role === 'manager').map((u) => u.email)
    if (mgrs.length) {
      patch.managerIds = Array.from(new Set([...(b.managerIds ?? []), ...mgrs]))
    }
    if (b.active === undefined) patch.active = true

    if (Object.keys(patch).length) {
      await updateBuilding(b.id, patch)
      buildingsUpdated++
    }

    for (const u of bUsers) {
      await saveMember(b.id, u.email, {
        name: u.name ?? '',
        role: u.role,
        apartmentIds: u.apartmentIds ?? [],
        active: u.active !== false,
      })
      members++
    }
  }

  return { buildings: buildings.length, buildingsUpdated, members }
}
