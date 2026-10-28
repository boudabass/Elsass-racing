// Charges utiles des événements de Documents (tâche 5.3). Chaque événement du catalogue
// (src/core/evenements/catalogue.ts) a son schéma ici ; le service le valide avant d'émettre.
// Aucun nom d'événement n'est écrit ici : ils viennent du catalogue, par la clé d'app.

import { z } from "zod"

import { TYPES_DOCUMENT } from "./regles"

const identifiant = z.string().min(1)

// Un document propre vient d'être créé. Check-lists et la recherche s'y brancheront ; rien d'autre n'en sort en 5.3.
export const chargeDocumentAjoute = z
  .object({ documentId: identifiant, titre: z.string().min(1), typeDocument: z.enum(TYPES_DOCUMENT) })
  .strict()

// Un règlement (FFSA ou particulier) vient d'être ajouté : même charge, pour que la team le voie.
export const chargeReglementPublie = chargeDocumentAjoute
