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
  if (entree.marque.trim() === "") return "Indiquez la marque du train."
  if (!(TYPES_PNEUS as readonly string[]).includes(entree.type)) return "Choisissez le type du train : asphalte, terre, pluie ou neige."
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
