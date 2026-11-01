// Document de Documents lu par Check-lists (tâche 5.7a, 956 §4). Pure : la date et l'étape d'alerte viennent de la règle
// de Documents (etapeAlerte), jamais recopiées.
import { etatEcheance, type StatutEcheanceLie } from "@/apps/checklist/objets-etat"
import type { ObjetLieLu } from "@/apps/checklist/objets-types"

import { etapeAlerte } from "./regles"

export function objetDocument(document: { id: string; title: string; validUntil: Date | null }, maintenant: Date): ObjetLieLu {
  const etape = etapeAlerte(document.validUntil, maintenant)
  const statut: StatutEcheanceLie = etape === null ? "valide" : etape === "expire" ? "expire" : "a_renouveler"
  const { etat, alerte } = etatEcheance(statut, document.validUntil)
  return {
    type: "document_documents",
    id: document.id,
    libelle: document.title,
    etat,
    alerte,
    vehicleId: null,
    personId: null,
  }
}
