// Charges utiles des événements d'Équipe (tâche 5.1). Chaque événement du catalogue
// (src/core/evenements/catalogue.ts) a son schéma ici ; le service le valide avant d'émettre.
// Aucun nom d'événement n'est écrit ici : ils viennent du catalogue, par la clé d'app.

import { z } from "zod"

import { PALIERS, REPONSES_DISPONIBILITE } from "./regles"

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

// Clé d'unicité de la demande de disponibilités : une action par personne et par épreuve, levée à la réponse.
export function cleDisponibilite(personId: string, eventId: string): string {
  return `disponibilite:${personId}:${eventId}`
}

// Résultat validé ou annulé d'un engagement : seuls l'équipage et l'épreuve servent ici.
export const chargeResultatEngagement = z.object({ entryId: identifiant, eventId: identifiant.nullable() }).passthrough()

// Engagement créé : Équipe demande les disponibilités de chaque membre actif pour cette épreuve.
export const chargeEngagementCree = z.object({ entryId: identifiant, eventId: identifiant, vehicleId: identifiant }).passthrough()

// Débrief saisi : le ressenti se lit chez Saison, par l'auteur du débrief.
export const chargeDebriefSaisi = z
  .object({ entryId: identifiant, eventId: identifiant, auteurMembershipId: identifiant })
  .passthrough()

// Adhésion qui rejoint la team : le profil de la personne est créé ou conservé.
export const chargeMembreRejoint = z.object({ membershipId: identifiant }).passthrough()

// Palier passé : seulement si la personne affiche ses trophées et si le ludique de la team est actif.
export const chargePalierAtteint = z.object({ personId: identifiant, palier: z.enum(PALIERS) }).strict()
