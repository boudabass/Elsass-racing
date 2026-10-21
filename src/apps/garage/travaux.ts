// Règles pures des travaux du Garage (tâche 4.3, brief §3). Aucun accès base : les services et les lectures passent
// les valeurs, ces fonctions renvoient un ordre, un état ou un refus. Même principe que regles.ts.

export const PRIORITES_TRAVAIL = ["haute", "normale", "basse"] as const
export type PrioriteTravail = (typeof PRIORITES_TRAVAIL)[number]

export const STATUTS_ORDRE = ["prevu", "en_cours", "termine"] as const
export type StatutOrdre = (typeof STATUTS_ORDRE)[number]

export const LIBELLE_PRIORITE: Record<PrioriteTravail, string> = {
  haute: "Haute",
  normale: "Normale",
  basse: "Basse",
}

export const TYPES_ORDRE = ["revision", "reparation", "remplacement", "controle"] as const
export type TypeOrdre = (typeof TYPES_ORDRE)[number]

export const LIBELLE_TYPE_ORDRE: Record<TypeOrdre, string> = {
  revision: "Révision",
  reparation: "Réparation",
  remplacement: "Remplacement",
  controle: "Contrôle",
}

export const LIBELLE_STATUT_ORDRE: Record<StatutOrdre, string> = {
  prevu: "Prévu",
  en_cours: "En cours",
  termine: "Terminé",
}

// Ordre des colonnes de la page : ce qui se fait maintenant d'abord, ce qui est fini en dernier.
export const COLONNES_TRAVAUX: readonly StatutOrdre[] = ["en_cours", "prevu", "termine"]

export type OrdreTri = {
  priorite: PrioriteTravail
  // Date de l'épreuve « à faire avant » (YYYY-MM-DD), null si l'ordre n'en a pas.
  aFaireAvant: string | null
  titre: string
}

// Tri : priorité (haute, normale, basse), puis « à faire avant » croissante, sans date en dernier, puis titre.
export function comparerOrdres(a: OrdreTri, b: OrdreTri): number {
  const rangA = PRIORITES_TRAVAIL.indexOf(a.priorite)
  const rangB = PRIORITES_TRAVAIL.indexOf(b.priorite)
  if (rangA !== rangB) return rangA - rangB

  if (a.aFaireAvant !== b.aFaireAvant) {
    if (a.aFaireAvant === null) return 1
    if (b.aFaireAvant === null) return -1
    return a.aFaireAvant < b.aFaireAvant ? -1 : 1
  }
  return a.titre.localeCompare(b.titre, "fr")
}

// Avancement : un entier de 0 à 100 (pourcentage).
export function avancementValide(pct: number): boolean {
  return Number.isInteger(pct) && pct >= 0 && pct <= 100
}

// Coût de main-d'œuvre : un entier de centimes, positif ou nul. Null = pas de coût saisi.
export function coutValide(cents: number | null): boolean {
  return cents === null || (Number.isInteger(cents) && cents >= 0)
}

// Un ordre terminé ne revient pas en cours ni prévu : la pose d'une pièce ne se défait pas toute seule (D3).
export function statutModifiable(statut: StatutOrdre): boolean {
  return statut !== "termine"
}
