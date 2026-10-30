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

// Échéances des documents propres (tâche 5.4). La date est un jour civil « AAAA-MM-JJ ».
const schemaEcheance = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

// Un document propre passe à une étape d'alerte (J60, J30 ou J7) : même charge pour les deux événements « bientôt ».
export const chargeDocumentExpireBientot = z
  .object({ documentId: identifiant, titre: z.string().min(1), echeance: schemaEcheance, etape: z.enum(["J60", "J30", "J7"]) })
  .strict()

// Un document propre est expiré (date dépassée, au lendemain de sa validité).
export const chargeDocumentExpire = z.object({ documentId: identifiant, titre: z.string().min(1), echeance: schemaEcheance }).strict()

// Un lien de partage créé, ou révoqué (la révocation par expiration est constatée au recalcul du QG).
export const chargeLienPartageCree = z.object({ shareId: identifiant, documentId: identifiant, finLe: schemaEcheance }).strict()

export const chargeLienPartageRevoque = z
  .object({ shareId: identifiant, documentId: identifiant, motif: z.enum(["revoque", "expire"]) })
  .strict()
