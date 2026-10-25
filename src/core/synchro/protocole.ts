// Format des échanges de synchro, partagé entre le client et les routes. Pur : sans base.

import { z } from "zod"

export const TYPES_OPERATION = ["creer", "modifier", "supprimer"] as const
export type TypeOperation = (typeof TYPES_OPERATION)[number]

// 200 opérations au plus par envoi. Les champs sont validés par la table, pas ici.
export const LIMITE_OPERATIONS = 200
export const LIMITE_PAQUET = 500

export const schemaOperation = z.object({
  idOperation: z.string().uuid(),
  table: z.string().min(1).max(64),
  type: z.enum(TYPES_OPERATION),
  id: z.string().uuid(),
  revLue: z.number().int().min(1).optional(),
  champs: z.record(z.unknown()).optional(),
})
export type Operation = z.infer<typeof schemaOperation>

export const schemaPousser = z.object({
  operations: z.array(schemaOperation).max(LIMITE_OPERATIONS),
})

// Enveloppe d'un envoi : seulement un tableau d'opérations, chacune avec son identifiant (sans lui, rien ne peut être
// noté). Le reste se valide opération par opération (analyserEnvoi) : une opération mal formée est refusée seule.
export const schemaEnveloppePousser = z.object({
  operations: z.array(z.object({ idOperation: z.string().uuid() }).passthrough()).max(LIMITE_OPERATIONS),
})

export const RAISON_OPERATION_MAL_FORMEE = "Envoi mal formé : rien n'a été enregistré."

// Sépare les opérations valides (à appliquer) des mal formées (à noter « refusee » avec leur raison, sans toucher la base).
export function analyserEnvoi(brutes: Array<Record<string, unknown>>): { valides: Operation[]; refusees: ResultatOperation[] } {
  const valides: Operation[] = []
  const refusees: ResultatOperation[] = []
  for (const brute of brutes) {
    const analyse = schemaOperation.safeParse(brute)
    if (analyse.success) valides.push(analyse.data)
    else refusees.push({ idOperation: String(brute.idOperation), statut: "refusee", raison: RAISON_OPERATION_MAL_FORMEE })
  }
  return { valides, refusees }
}

export const schemaTirer = z.object({
  curseurs: z.record(z.string().nullable()),
})

// Ligne telle qu'elle circule : champs de la table, plus les colonnes de synchro.
export interface LigneSynchro {
  id: string
  rev: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  createdBy: string | null
  updatedBy: string | null
  [champ: string]: unknown
}

export const STATUTS_OPERATION = ["appliquee", "conflit_resolu", "refusee"] as const

export interface ResultatOperation {
  idOperation: string
  statut: (typeof STATUTS_OPERATION)[number]
  raison?: string
}

// La raison peut être absente, ou nulle quand elle est stockée en JSON.
const schemaResultat = z.object({
  statut: z.enum(STATUTS_OPERATION),
  raison: z.string().nullish(),
})

// Résultat déjà noté pour une opération rejouée : on le renvoie tel quel, sans rien réappliquer.
// Une valeur stockée illisible n'est pas un résultat : on renvoie null et on la traitera.
export function resultatDejaNote(idOperation: string, stocke: unknown): ResultatOperation | null {
  const analyse = schemaResultat.safeParse(stocke)
  if (!analyse.success) return null
  return { idOperation, statut: analyse.data.statut, ...(analyse.data.raison ? { raison: analyse.data.raison } : {}) }
}
