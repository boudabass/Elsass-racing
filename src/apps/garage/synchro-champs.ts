// Champs des écritures du Garage hors ligne (tâche 4.3, D5 ; docs/schema-garage.md). Module pur, sans base : la déclaration de
// synchro (synchro-serveur.ts) s'en sert, et les tests les lisent directement.
//
// Création : seulement l'intervention rapide sans pièce (véhicule, organe, titre). Le serveur pose le reste : type
// réparation, terminé, avancement à 100, affectation au compte. Modification : seulement le statut et l'avancement.
// Tout autre champ (coût, prestataire, pièce, affectation, titre d'un ordre existant) est refusé par le schéma.

import { z } from "zod"

export const STATUTS_ORDRE_HORS_LIGNE = ["prevu", "en_cours", "termine"] as const

export const schemaCreationIntervention = z
  .object({
    vehicleId: z.string().uuid(),
    vehicleComponentId: z.string().uuid(),
    titre: z.string().trim().min(1, "Dites ce qui a été fait.").max(200),
  })
  .strict()

export const schemaModificationOrdre = z
  .object({
    statut: z.enum(STATUTS_ORDRE_HORS_LIGNE).optional(),
    avancementPct: z.number().int().min(0).max(100).optional(),
  })
  .strict()
  .refine((champs) => champs.statut !== undefined || champs.avancementPct !== undefined, "Rien à modifier.")

// Ce que la synchro accepte pour garage_work_order : une création d'intervention ou une modification de statut.
export const schemaChampsOrdreHorsLigne = z.union([schemaCreationIntervention, schemaModificationOrdre])
