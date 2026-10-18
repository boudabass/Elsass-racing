// Charges utiles des événements de Partenaires (tâche 3.5). Chaque événement du catalogue
// (src/core/evenements/catalogue.ts) a son schéma ici ; le service le valide avant d'émettre.
// Aucun nom d'événement n'est écrit ici : ils viennent du catalogue, par la clé d'app.

import { z } from "zod"

const identifiant = z.string().min(1)
// Date civile « AAAA-MM-JJ », sans heure (jour de Paris).
const jourCivil = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const chargeConventionSignee = z
  .object({
    agreementId: identifiant,
    partnerId: identifiant,
    partenaireNom: z.string().min(1),
    // Période de la convention (jours civils) : Budget date les recettes, Voiture date les réservations.
    dateDebut: jourCivil,
    dateFin: jourCivil,
    apportFinancierCentimes: z.number().int().min(0),
    echeancier: z.array(z.object({ date: jourCivil, montantCentimes: z.number().int().min(0) })),
    // Logo du partenaire (nullable) : Voiture le réutilise sur l'emplacement réservé.
    logoFileId: identifiant.nullable(),
    // Contreparties logo, avec l'emplacement : Voiture les lira à l'écoute de cet événement.
    contreparties: z.array(z.object({ benefitId: identifiant, slotId: identifiant, slotNom: z.string().nullable() })),
  })
  .strict()

// Résiliation : « terminee » (fin de la période) ou « resiliee ». slotIds : les emplacements à libérer, c'est-à-dire
// ceux que les autres conventions signées ou en cours du partenaire ne couvrent pas.
export const chargeConventionTerminee = z
  .object({
    agreementId: identifiant,
    partnerId: identifiant,
    partenaireNom: z.string().min(1),
    motif: z.enum(["terminee", "resiliee"]),
    slotIds: z.array(identifiant),
  })
  .strict()

export const chargeContrepartieTenue = z
  .object({
    agreementId: identifiant,
    partnerId: identifiant,
    benefitId: identifiant,
    partenaireNom: z.string().min(1),
    libelle: z.string().min(1),
  })
  .strict()

export const chargeContrepartieEnRetard = z
  .object({
    agreementId: identifiant,
    partnerId: identifiant,
    benefitId: identifiant,
    partenaireNom: z.string().min(1),
    libelle: z.string().min(1),
    echeance: jourCivil,
  })
  .strict()

export const chargeRelanceDue = z
  .object({ partnerId: identifiant, partenaireNom: z.string().min(1), date: jourCivil })
  .strict()

// Clé d'unicité d'une contrepartie en retard : une seule émission par contrepartie et par échéance.
export function cleContrepartieEnRetard(benefitId: string, echeance: string): string {
  return `contrepartie-en-retard:${benefitId}:${echeance}`
}
