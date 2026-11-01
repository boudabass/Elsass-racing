// Helpers purs du socle de synchro, partagés par le registre et les déclarations des apps. Dans un fichier à part :
// les apps importent ces helpers sans charger le registre (pas de cycle registre ↔ synchro-serveur).

import { RefusSynchro } from "./erreurs"

// Champs du socle de toute ligne synchronisée, au format de la synchro (dates en ISO).
// Déclarés ici (fonctions déclarées, donc disponibles pendant le cycle registre ↔ synchro-serveur des apps).
export interface Socle {
  id: string
  rev: number
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  createdBy: string | null
  updatedBy: string | null
}

export function socleSynchro(ligne: Socle) {
  return {
    id: ligne.id,
    rev: ligne.rev,
    createdAt: ligne.createdAt.toISOString(),
    updatedAt: ligne.updatedAt.toISOString(),
    deletedAt: ligne.deletedAt?.toISOString() ?? null,
    createdBy: ligne.createdBy,
    updatedBy: ligne.updatedBy,
  }
}

export function refusLectureSeule(): never {
  throw new RefusSynchro("Cette donnée se lit seulement hors ligne : elle ne s'écrit pas depuis l'appareil.")
}
