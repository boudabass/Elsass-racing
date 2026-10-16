// Niveaux d'accès par app, et leur résolution. Pur : aucun accès base.
//
// Résolution : un core_app_access de la membership prime ; sinon le défaut du rôle
// (core_role_default) ; sinon « aucun ».

export const NIVEAUX = ["aucun", "lecture", "contribution", "ecriture", "gestion"] as const

export type Niveau = (typeof NIVEAUX)[number]

export function rangNiveau(niveau: Niveau): number {
  return NIVEAUX.indexOf(niveau)
}

// Vrai si le niveau détenu couvre le niveau requis.
export function aAuMoins(niveau: Niveau, requis: Niveau): boolean {
  return rangNiveau(niveau) >= rangNiveau(requis)
}

export interface AccesAppLigne {
  appCle: string
  niveau: Niveau
}

export interface DefautRoleLigne {
  role: string
  appCle: string
  niveau: Niveau
}

export interface ParametresNiveau {
  role: string
  appCle: string
  // Lignes core_app_access de la membership (déjà filtrées sur la membership).
  acces: readonly AccesAppLigne[]
  // Lignes core_role_default (référentiel complet ou filtré).
  defauts: readonly DefautRoleLigne[]
}

export function niveauEffectif({ role, appCle, acces, defauts }: ParametresNiveau): Niveau {
  const accesDirect = acces.find((ligne) => ligne.appCle === appCle)
  if (accesDirect) return accesDirect.niveau

  const defaut = defauts.find((ligne) => ligne.role === role && ligne.appCle === appCle)
  return defaut ? defaut.niveau : "aucun"
}
