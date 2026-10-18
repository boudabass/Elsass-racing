// Charges utiles des événements de Voiture (tâche 3.2). Chaque événement du catalogue
// (src/core/evenements/catalogue.ts) a son schéma ici ; le service le valide avant d'émettre.
// Aucun nom d'événement n'est écrit ici : ils viennent du catalogue, par la clé d'app.

import { z } from "zod"

const identifiant = z.string().min(1)
// Échéance au format « AAAA-MM-JJ » : jour civil, sans heure.
const jourCivil = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const chargeFicheModifiee = z.object({ vehicleId: identifiant }).strict()

export const chargeEmplacementModifie = z
  .object({ vehicleId: identifiant, slotId: identifiant.optional() })
  .strict()

export const chargeLogoPose = z
  .object({ vehicleId: identifiant, slotId: identifiant, assignmentId: identifiant })
  .strict()

export const chargePapierExpireBientot = z
  .object({ vehicleId: identifiant, paperId: identifiant, type: z.string().min(1), echeance: jourCivil })
  .strict()

// Clé d'unicité d'un rappel de papier : une seule action par papier et par échéance.
export function cleRappelPapier(paperId: string, echeance: string): string {
  return `papier:${paperId}:${echeance}`
}
