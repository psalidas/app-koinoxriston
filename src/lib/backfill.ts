import { listBuildings, updateBuilding, slugify } from './repos/buildings'
import { listUsers, addUserToBuilding } from './repos/users'
import { saveMember } from './repos/members'
import type { Building, UserDoc } from '@/types'

export interface BackfillResult {
  buildings: number
  buildingsUpdated: number
  members: number
  /** Legacy χρήστες (χωρίς buildingIds) που ανατέθηκαν στο βασικό κτίριο. */
  legacyAssigned: number
  /** Legacy χρήστες που ΔΕΝ ανατέθηκαν επειδή δεν βρέθηκε βασικό κτίριο. */
  legacyUnassigned: number
  primaryBuilding: string | null
}

/** Εντοπίζει το «βασικό» κτίριο (Καραμανλή) στο οποίο ανήκουν οι legacy χρήστες. */
function findPrimary(buildings: Building[]): Building | null {
  const byKaramanli = buildings.find((b) =>
    /καραμανλ/i.test(`${b.name} ${b.address}`) || b.slug === 'karamanli17',
  )
  if (byKaramanli) return byKaramanli
  // Αν υπάρχει μόνο ένα κτίριο, αυτό είναι το βασικό.
  return buildings.length === 1 ? buildings[0] : null
}

/**
 * Μετάβαση σε multi-building: για κάθε υπάρχον κτίριο συμπληρώνει slug/managerIds/
 * active (αν λείπουν) και δημιουργεί εγγραφές μελών (/buildings/{id}/members)
 * από τους υπάρχοντες χρήστες (βάσει buildingIds). Επιπλέον, όσοι χρήστες δεν
 * έχουν καθόλου buildingIds (legacy) ανατίθενται στο βασικό κτίριο (Καραμανλή),
 * ώστε να ΜΗΝ κλειδωθούν όταν σφίξουν οι κανόνες απομόνωσης.
 *
 * Idempotent — τρέχει με ασφάλεια όσες φορές θέλεις. Απαιτεί δικαιώματα
 * διαχειριστή/superadmin.
 */
export async function backfillMembers(): Promise<BackfillResult> {
  const [buildings, users] = await Promise.all([listBuildings(), listUsers()])
  let buildingsUpdated = 0
  let members = 0
  let legacyAssigned = 0
  let legacyUnassigned = 0

  const primary = findPrimary(buildings)

  // 1) Legacy χρήστες (χωρίς buildingIds) → βασικό κτίριο.
  const legacy = users.filter((u) => (u.buildingIds ?? []).length === 0)
  if (legacy.length && primary) {
    for (const u of legacy) {
      await addUserToBuilding(u.email, primary.id, { name: u.name, role: u.role })
      u.buildingIds = [primary.id] // ενημέρωσε το local αντίγραφο για το βήμα 2
      legacyAssigned++
    }
  } else {
    legacyUnassigned = legacy.length
  }

  // 2) Ανά κτίριο: slug/managerIds/active + εγγραφές μελών.
  for (const b of buildings) {
    const bUsers = users.filter((u: UserDoc) => (u.buildingIds ?? []).includes(b.id))
    const patch: Partial<Building> = {}

    if (!b.slug) {
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

  return {
    buildings: buildings.length,
    buildingsUpdated,
    members,
    legacyAssigned,
    legacyUnassigned,
    primaryBuilding: primary?.name ?? null,
  }
}
