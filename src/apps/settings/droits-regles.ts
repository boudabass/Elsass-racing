// Règles des droits et des apps de Réglages, en fonctions pures (testables sans base).

import { APPS, type AppCle } from "@/core/catalogue"
import type { Niveau } from "@/core/droits/niveaux"

// Un responsable garde toujours la gestion de Réglages : sinon la team ne pourrait plus
// corriger ses propres droits.
export function niveauAutorise(role: string, appCle: string, niveau: Niveau): boolean {
  if (role === "responsable" && appCle === "settings") return niveau === "gestion"
  return true
}

// Apps requises par l'app donnée, qui sont activées, et qui empêcheraient de la désactiver.
// Ex. garage requiert voiture : désactiver voiture est refusé tant que garage est activée.
export function appsQuiRequierent(appCle: string, activees: readonly string[]): string[] {
  return APPS.filter((app) => app.requiert.includes(appCle as AppCle) && activees.includes(app.cle)).map(
    (app) => app.cle,
  )
}

export type VerdictDesactivation = { ok: true } | { ok: false; raison: string }

export function peutDesactiver(appCle: string, activees: readonly string[]): VerdictDesactivation {
  if (appCle === "settings") return { ok: false, raison: "Réglages ne peut pas être désactivée." }
  const requises = appsQuiRequierent(appCle, activees)
  if (requises.length > 0) {
    const nom = APPS.find((app) => app.cle === requises[0])?.nom ?? requises[0]
    return { ok: false, raison: `Requise par ${nom}` }
  }
  return { ok: true }
}

// Déplace une app d'un cran dans l'ordre (sens -1 : monter, +1 : descendre). Renvoie les
// nouveaux ordres, ou null si le déplacement n'est pas possible.
export function deplacer<T extends { appCle: string; ordre: number }>(
  apps: readonly T[],
  appCle: string,
  sens: -1 | 1,
): Array<{ appCle: string; ordre: number }> | null {
  const trie = [...apps].sort((a, b) => a.ordre - b.ordre)
  const index = trie.findIndex((a) => a.appCle === appCle)
  const voisin = index + sens
  if (index < 0 || voisin < 0 || voisin >= trie.length) return null
  const copie = [...trie]
  ;[copie[index], copie[voisin]] = [copie[voisin], copie[index]]
  return copie.map((a, i) => ({ appCle: a.appCle, ordre: i + 1 }))
}
