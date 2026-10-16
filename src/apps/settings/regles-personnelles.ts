// Règles des rubriques personnelles de Réglages, en fonctions pures (testables sans base).

export const DELAI_PURGE_JOURS = 30

export type ChoixLudique = "oui" | "non" | "comme_la_team"

// Trophées et paliers : affichés si la team les affiche et si le membre ne les a pas masqués.
// Si la team les masque, le membre ne peut pas les réafficher (article 960, section 4.3).
export function ludiqueEffectif(equipeAffiche: boolean, choixMembre: ChoixLudique): boolean {
  if (!equipeAffiche) return false
  return choixMembre !== "non"
}

// Date de purge d'une demande de suppression : délai fixe après la demande.
export function dateDePurge(demandeeLe: Date): Date {
  return new Date(demandeeLe.getTime() + DELAI_PURGE_JOURS * 24 * 60 * 60 * 1000)
}

// Confirmation par saisie : l'adresse ou le nom de la team doit être retapé à l'identique,
// aux espaces de bord près.
export function confirmationCorrespond(saisie: string, attendu: string): boolean {
  const cible = attendu.trim()
  return cible !== "" && saisie.trim() === cible
}

export interface AdhesionSuppression {
  teamNom: string
  role: string
  statut: string
  autresResponsablesActifs: number
}

export type VerdictSuppression = { ok: true } | { ok: false; raison: string }

// Le dernier responsable actif d'une team active ne peut pas supprimer son compte : il doit
// d'abord nommer un autre responsable.
export function peutSupprimerCompte(adhesions: readonly AdhesionSuppression[]): VerdictSuppression {
  for (const adhesion of adhesions) {
    if (adhesion.role === "responsable" && adhesion.statut === "actif" && adhesion.autresResponsablesActifs === 0) {
      return { ok: false, raison: `Nomme d'abord un autre responsable pour « ${adhesion.teamNom} ».` }
    }
  }
  return { ok: true }
}

export type HeureLue = { ok: true; valeur: string | null } | { ok: false }

// Heure des heures calmes, au format HH:MM. Vide : pas d'heure fixée.
export function lireHeure(brute: string): HeureLue {
  const valeur = brute.trim()
  if (valeur === "") return { ok: true, valeur: null }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(valeur)) return { ok: false }
  return { ok: true, valeur }
}

// Écran d'accueil d'une app : affiché tant que le membre ne l'a pas commencé.
export function appDecouverte(appCle: string, decouvertes: readonly string[]): boolean {
  return decouvertes.indexOf(appCle) >= 0
}
