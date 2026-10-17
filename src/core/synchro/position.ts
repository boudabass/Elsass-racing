// Après la position du curseur : updated_at strictement plus récent, ou même date et id plus grand.
// Partagé par le registre et les déclarations des apps (src/apps/*/synchro-serveur.ts).

import type { PositionCurseur } from "./curseur"

export function apresPosition(position: PositionCurseur | null) {
  if (!position) return {}
  const date = new Date(position.date)
  return { OR: [{ updatedAt: { gt: date } }, { updatedAt: date, id: { gt: position.id } }] }
}
