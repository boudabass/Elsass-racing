// Objets de Voiture lus par Check-lists (tâche 5.7a, 956 §4) : un papier du véhicule, un logo posé sur un emplacement.
// Pure : les données viennent des lectures de lectures-partagees.ts.
import { etatEcheance } from "@/apps/checklist/objets-etat"
import type { ObjetLieLu } from "@/apps/checklist/objets-types"

import { LIBELLE_TYPE_PAPIER } from "./libelles"
import { statutPapier, type StatutEmplacement } from "./regles"

export function objetPapier(
  papier: { id: string; vehicleId: string; type: keyof typeof LIBELLE_TYPE_PAPIER; libelle: string | null; valableJusquAu: Date | null },
  maintenant: Date,
): ObjetLieLu {
  const { etat, alerte } = etatEcheance(statutPapier(papier.valableJusquAu, maintenant), papier.valableJusquAu)
  return {
    type: "papier_voiture",
    id: papier.id,
    libelle: papier.libelle?.trim() || LIBELLE_TYPE_PAPIER[papier.type],
    etat,
    alerte,
    vehicleId: papier.vehicleId,
    personId: null,
  }
}

const ETAT_LOGO: Record<StatutEmplacement, string> = {
  occupe: "Logo posé",
  reserve: "Logo réservé, pas encore posé",
  libre: "Logo pas encore posé",
  indisponible: "Emplacement indisponible",
}

export function objetLogo(emplacement: { id: string; nom: string; vehicleId: string; statut: StatutEmplacement }): ObjetLieLu {
  return {
    type: "logo_voiture",
    id: emplacement.id,
    libelle: emplacement.nom,
    etat: ETAT_LOGO[emplacement.statut],
    alerte: false,
    vehicleId: emplacement.vehicleId,
    personId: null,
  }
}
