// Objet de Partenaires lu par Check-lists (tâche 5.7a, 956 §4) : une contrepartie. Pure : les données viennent de
// lectures-partagees.ts. L'état « en retard » vient de la règle de Partenaires (enRetard), jamais recopiée.
import type { ObjetLieLu } from "@/apps/checklist/objets-types"

import { enRetard, statutContrepartie, type StatutContrepartie } from "./regles"

const ETAT_CONTREPARTIE: Record<StatutContrepartie, string> = {
  a_faire: "À faire",
  en_cours: "En cours",
  tenue: "Tenue",
  reportee: "Reportée",
}

export function objetContrepartie(
  contrepartie: {
    id: string
    libelle: string
    slotNom: string | null
    statut: StatutContrepartie
    quantitePromise: number
    quantiteTenue: number
    echeance: Date | null
  },
  aujourdhui: string,
): ObjetLieLu {
  const regle = {
    statut: contrepartie.statut,
    quantitePromise: contrepartie.quantitePromise,
    quantiteTenue: contrepartie.quantiteTenue,
    echeance: contrepartie.echeance ? contrepartie.echeance.toISOString().slice(0, 10) : null,
  }
  const retard = enRetard(regle, aujourdhui)
  return {
    type: "contrepartie_partenaires",
    id: contrepartie.id,
    libelle: contrepartie.slotNom ? `${contrepartie.libelle} · ${contrepartie.slotNom}` : contrepartie.libelle,
    etat: retard ? "En retard" : ETAT_CONTREPARTIE[statutContrepartie(regle)],
    alerte: retard,
    vehicleId: null,
    personId: null,
  }
}
