// Liste blanche des fiches dont les notes se prennent hors ligne (brief 5.0, point A). Une app y déclare son type de fiche
// et son contrôle, côté serveur, dans la transaction de la synchro. Une note poussée pour une autre fiche est refusée.
// Pour la 5.0 : l'ordre de travail du Garage. Les points de check-list (5.6) s'ajoutent ici.

import type { ContexteTeam } from "@/core/contexte"
import type { Tx } from "@/core/synchro/registre"
import { ficheOrdreNotable } from "@/apps/garage/notes-serveur"

export interface FicheNotable {
  app: string
  ficheType: string
  // La personne voit la fiche (lecture sur l'app, fiche existante dans la team).
  peutVoir(tx: Tx, ctx: ContexteTeam, ficheId: string): Promise<boolean>
  // La personne peut ajouter une note à la fiche (écriture, ou contribution avec affectation).
  peutAjouter(tx: Tx, ctx: ContexteTeam, ficheId: string): Promise<boolean>
}

const FICHES: FicheNotable[] = [ficheOrdreNotable]

export function fichesNotables(): FicheNotable[] {
  return FICHES
}
