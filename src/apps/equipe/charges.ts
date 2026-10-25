// Charges utiles des événements d'Équipe (tâche 5.1). Chaque événement du catalogue
// (src/core/evenements/catalogue.ts) a son schéma ici ; le service le valide avant d'émettre.
// Aucun nom d'événement n'est écrit ici : ils viennent du catalogue, par la clé d'app.

import { z } from "zod"

import { REPONSES_DISPONIBILITE } from "./regles"

const identifiant = z.string().min(1)
// Jour civil « AAAA-MM-JJ », sans heure.
const jourCivil = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

// Licence payée : un montant saisi sur la licence. Budget propose la dépense (liaisons-serveur.ts de Budget).
export const chargeLicencePayee = z
  .object({
    licenceId: identifiant,
    personId: identifiant,
    libelle: z.string().min(1),
    montantCents: z.number().int().min(1),
    devise: z.literal("EUR"),
    date: jourCivil,
  })
  .strict()

// Disponibilité changée : Saison s'en sert pour le prévisionnel de l'épreuve (rien d'autre n'en sort).
export const chargeDisponibiliteChangee = z
  .object({ eventId: identifiant, personId: identifiant, reponse: z.enum(REPONSES_DISPONIBILITE) })
  .strict()
