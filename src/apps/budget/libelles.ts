// Libellés français de Budget. Chaque valeur d'énumération du schéma a son libellé : le test
// libelles.test.ts lit prisma/schema.prisma et échoue si une valeur n'en a pas.

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

// Montant en centimes -> « 1 234,50 € ». Espace insécable de milliers, virgule décimale.
const formatEuro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })

export function formatEuros(centimes: number): string {
  return formatEuro.format(centimes / 100)
}
