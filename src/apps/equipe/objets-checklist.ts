// Objets d'Équipe lus par Check-lists (tâche 5.7a, 956 §4) : une licence et un équipement (homologation) d'une personne.
// Pure : les données viennent des lectures de lectures-partagees.ts.
import { etatEcheance } from "@/apps/checklist/objets-etat"
import type { ObjetLieLu } from "@/apps/checklist/objets-types"

import { LIBELLES_TYPE_EQUIPEMENT, LIBELLES_TYPE_LICENCE, statutEquipement, statutLicence, type TypeEquipement, type TypeLicence } from "./regles"

export function objetLicence(licence: { id: string; personId: string; type: TypeLicence; valableAu: Date | null }, maintenant: Date): ObjetLieLu {
  const { etat, alerte } = etatEcheance(statutLicence(licence.valableAu, maintenant), licence.valableAu)
  return {
    type: "licence_equipe",
    id: licence.id,
    libelle: LIBELLES_TYPE_LICENCE[licence.type],
    etat,
    alerte,
    vehicleId: null,
    personId: licence.personId,
  }
}

export function objetEquipement(
  equipement: { id: string; personId: string; type: TypeEquipement; finHomologation: Date | null },
  maintenant: Date,
): ObjetLieLu {
  const { etat, alerte } = etatEcheance(statutEquipement(equipement.finHomologation, maintenant), equipement.finHomologation)
  return {
    type: "homologation_equipe",
    id: equipement.id,
    libelle: LIBELLES_TYPE_EQUIPEMENT[equipement.type],
    etat,
    alerte,
    vehicleId: null,
    personId: equipement.personId,
  }
}
