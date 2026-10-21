// Charges utiles des événements du Garage et de ceux qu'il écoute (tâche 4.1). Chaque charge est validée avant
// émission (services) ou avant traitement (gestionnaires). Les noms d'événements viennent du catalogue.

import { z } from "zod"

const identifiant = z.string().min(1)
const pourcent = z.number().min(0).max(100)

// garage.piece_zone_rouge : une pièce franchit le seuil rouge de son organe.
export const chargePieceZoneRouge = z
  .object({
    partId: identifiant,
    vehicleComponentId: identifiant,
    vehicleId: identifiant,
    etat: pourcent,
  })
  .strict()

// garage.fiabilite_changee : l'indice arrondi à l'unité change. Null tant qu'aucun organe n'est retenu.
export const chargeFiabiliteChangee = z
  .object({
    vehicleId: identifiant,
    avant: pourcent.nullable(),
    apres: pourcent.nullable(),
  })
  .strict()

// saison.resultat_valide : seul l'engagement sert ici. Les km chronométrés ne sont pas dans la charge utile :
// Garage les lit par la lecture partagée lireUsureEngagement (correction D, docs/schema-garage.md).
export const chargeResultatValide = z
  .object({
    entryId: identifiant,
    eventId: identifiant.nullable(),
  })
  .passthrough()

// garage.travail_termine : un ordre passe à terminé (après la transaction de fin, D7). Consommé par Checklist et le socle.
export const chargeTravailTermine = z
  .object({
    workOrderId: identifiant,
    vehicleId: identifiant,
    type: z.enum(["revision", "reparation", "remplacement", "controle"]),
  })
  .strict()

// garage.intervention_facturee : la fin d'un ordre avec un coût de main-d'œuvre (D7). Budget propose la dépense.
export const chargeInterventionFacturee = z
  .object({
    workOrderId: identifiant,
    vehicleId: identifiant,
    coutCents: z.number().int().min(1),
    devise: z.string().min(1),
    prestataireContactId: identifiant.nullable(),
  })
  .strict()
