import { z } from "zod"

// Règles pures des trains de pneus (tâche 4.4, 954 §2 et §3). Sans accès base : les services sont dans pneus-serveur.ts.

export const TYPES_PNEUS = ["asphalte", "terre", "pluie", "neige"] as const
export const STATUTS_PNEUS = ["neuf", "utilise", "use"] as const

export type TypePneus = (typeof TYPES_PNEUS)[number]
export type StatutPneus = (typeof STATUTS_PNEUS)[number]

export const LIBELLES_TYPE_PNEUS: Record<TypePneus, string> = {
  asphalte: "Asphalte",
  terre: "Terre",
  pluie: "Pluie",
  neige: "Neige",
}

// 954 §3 : les valeurs d'enum ne sont pas renommées en base, seul l'affichage change.
export const LIBELLES_STATUT_PNEUS: Record<StatutPneus, string> = {
  neuf: "Neuf",
  utilise: "Utilisé",
  use: "Usé",
}

// Raison affichée quand une ligne de commande porte l'organe Pneus, hors de l'écran Pneus [Orch 24/10].
export const MESSAGE_TRAIN_A_ACHETER = "Un train de pneus s'achète depuis l'écran Pneus."

export const MESSAGE_TRAIN_SANS_LIGNE = "Ces données de train ne correspondent à aucune ligne de pneus de cette commande."

// Marque et type sont obligatoires pour un train (954 §2) : la ligne de commande n'a pas de type de pneus.
export function trainValide(entree: { marque: string; type: string }): string | null {
  if (entree.marque.trim() === "") return "Indique la marque du train."
  if (!(TYPES_PNEUS as readonly string[]).includes(entree.type)) return "Choisis le type du train : asphalte, terre, pluie ou neige."
  return null
}

// Usure estimée : un entier de 0 à 100 %, saisi à la main [correction C, pas d'IA].
export function usureValide(pct: number): string | null {
  if (!Number.isInteger(pct) || pct < 0 || pct > 100) return "L'usure estimée est un nombre entier de 0 à 100 %."
  return null
}

export function statutPneusValide(statut: string): statut is StatutPneus {
  return (STATUTS_PNEUS as readonly string[]).includes(statut)
}

// Un train ne se monte que sur la voiture à laquelle il appartient.
export function trainDeLaVoiture(trainVehicleId: string, vehicleId: string): string | null {
  return trainVehicleId === vehicleId ? null : "Ce train appartient à une autre voiture."
}

// --- Saisie d'un train -----------------------------------------------------------------------------------------------
// La saisie du train est validée ici, sans accès base, pour être testée. Le schéma est strict : une clé qui n'en fait pas
// partie (la date d'achat, par exemple) est refusée. C'est pourquoi la date d'achat se sépare avant (separerDateAchat).

const texteFacultatif = (max: number) => z.string().trim().max(max).nullable().optional()

const schemaSaisieTrain = z
  .object({
    marque: z.string().max(100),
    modele: texteFacultatif(100),
    gomme: texteFacultatif(100),
    type: z.string(),
    dimensions: texteFacultatif(50),
  })
  .strict()

export type EntreeTrain = z.input<typeof schemaSaisieTrain>

export interface TrainSaisi {
  marque: string
  modele: string | null
  gomme: string | null
  type: TypePneus
  dimensions: string | null
}

// Sépare la date d'achat (« acheté le ») du reste de la saisie : elle n'est pas une caractéristique du train.
export function separerDateAchat(entree: EntreeTrain & { acheteLe?: string | null }): { saisie: EntreeTrain; acheteLe: string | null } {
  const { acheteLe, ...saisie } = entree
  return { saisie, acheteLe: acheteLe ?? null }
}

// Valide la saisie du train. Renvoie le train, ou la raison à afficher.
export function validerSaisieTrain(entree: unknown): { train: TrainSaisi } | { erreur: string } {
  const analyse = schemaSaisieTrain.safeParse(entree)
  if (!analyse.success) return { erreur: "Ce train n'est pas enregistrable : vérifie la saisie." }
  const donnees = analyse.data
  const erreur = trainValide({ marque: donnees.marque, type: donnees.type })
  if (erreur) return { erreur }
  return {
    train: {
      marque: donnees.marque.trim(),
      modele: donnees.modele?.trim() || null,
      gomme: donnees.gomme?.trim() || null,
      type: donnees.type as TypePneus,
      dimensions: donnees.dimensions?.trim() || null,
    },
  }
}
