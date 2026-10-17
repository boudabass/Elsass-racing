// Libellés français de Budget. Chaque valeur d'énumération du schéma a son libellé : le test
// libelles.test.ts lit prisma/schema.prisma et échoue si une valeur n'en a pas.

import { formatEuros } from "@/lib/euros"

export { formatEuros }

export const LIBELLE_SENS = { depense: "Dépense", recette: "Recette" } as const

export const LIBELLE_MOYEN = {
  carte: "Carte",
  especes: "Espèces",
  cheque: "Chèque",
  virement: "Virement",
} as const

export const LIBELLE_TYPE_PAYEUR = {
  membre: "Membre",
  caisse_team: "Caisse de la team",
  compte_association: "Compte de l'association",
} as const

export const LIBELLE_REMBOURSEMENT = {
  non_concerne: "Non concernée",
  a_rembourser: "À rembourser",
  partiel: "Remboursée en partie",
  rembourse: "Remboursée",
} as const

export const LIBELLE_ORIGINE = { saisie: "Saisie", proposee: "Proposée par une autre app" } as const

export const LIBELLE_STATUT_RECETTE = { prevue: "Prévue", encaissee: "Encaissée" } as const

export const LIBELLE_STATUT_SUGGESTION = {
  en_attente: "À confirmer",
  confirmee: "Confirmée",
  ignoree: "Ignorée",
} as const

// Couleur de l'écart au prévisionnel : vert jusqu'à 90 %, orange jusqu'à 100 %, rouge au-delà.
export const LIBELLE_ECART = { vert: "Dans le prévu", orange: "Proche du prévu", rouge: "Au-dessus du prévu" } as const

export const LIBELLES_PAR_ENUMERATION = {
  BudgetSens: LIBELLE_SENS,
  BudgetMoyen: LIBELLE_MOYEN,
  BudgetTypePayeur: LIBELLE_TYPE_PAYEUR,
  BudgetRemboursement: LIBELLE_REMBOURSEMENT,
  BudgetOrigine: LIBELLE_ORIGINE,
  BudgetStatutRecette: LIBELLE_STATUT_RECETTE,
  BudgetStatutSuggestion: LIBELLE_STATUT_SUGGESTION,
} as const

// Libellé d'une valeur d'énumération ; à défaut, la valeur brute (ne doit pas arriver, le test le garantit).
export function libelle(enumeration: keyof typeof LIBELLES_PAR_ENUMERATION, valeur: string): string {
  const table: Record<string, string> = LIBELLES_PAR_ENUMERATION[enumeration]
  return table[valeur] ?? valeur
}

// Solde en clair (le signe seul ne se lit pas). Positif : la team doit de l'argent. Négatif : le membre doit à la team.
export function phraseSoldeMoi(centimes: number): string {
  if (centimes === 0) return "Rien à régler"
  if (centimes > 0) return `La team te doit ${formatEuros(centimes)}`
  return `Tu dois ${formatEuros(-centimes)} à la team`
}

export function phraseSoldeMembre(centimes: number, nom: string): string {
  if (centimes === 0) return "Rien à régler"
  if (centimes > 0) return `La team doit ${formatEuros(centimes)} à ${nom}`
  return `${nom} doit ${formatEuros(-centimes)} à la team`
}

// L'écart du prévisionnel en une phrase (la couleur n'est qu'un renfort). Pur.
export function phraseEcart(prevu: number | null, reel: number, pourcent: number | null, couleur: "vert" | "orange" | "rouge" | null): string {
  if (prevu === null) return reel > 0 ? `Pas de prévu, ${formatEuros(reel)} dépensés` : "Pas de prévu, rien dépensé"
  if (reel > prevu) return `Dépassé de ${formatEuros(reel - prevu)}`
  if (pourcent === null) return "Dans le prévu"
  if (pourcent >= 100) return "Au plafond, 100 %"
  if (couleur === "vert") return `Dans le prévu, ${Math.round(pourcent)} %`
  return `Proche du plafond, ${Math.round(pourcent)} %`
}
