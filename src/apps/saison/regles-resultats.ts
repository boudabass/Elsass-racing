// Règles pures des résultats, du débrief et de l'historique de Saison (tâche 2.3). Aucun accès base.
// Un résultat non validé ne compte jamais dans les statistiques.

import type { StatutResultat, ValidationResultat } from "./regles"

// Priorités de la boîte d'actions (article 960, cf. prochaine-etape.ts).
export const PRIORITE_RESULTAT_A_VALIDER = 3
export const PRIORITE_CLOTURE_PROPOSEE = 7

// --- Durées : saisie « mm:ss,d », stockage en millisecondes ---------------------------------

// « 1:23,4 » → 83400 ms. Les dixièmes sont facultatifs. Null pour une saisie vide ou invalide.
export function parserDuree(texte: string): number | null {
  const brut = texte.trim()
  if (brut === "") return null
  const correspondance = /^(\d{1,3}):([0-5]\d)(?:,(\d))?$/.exec(brut)
  if (!correspondance) return null
  const minutes = Number(correspondance[1])
  const secondes = Number(correspondance[2])
  const dixieme = Number(correspondance[3] ?? 0)
  return (minutes * 60 + secondes) * 1000 + dixieme * 100
}

// 83400 ms → « 1:23,4 ». Les millisecondes en trop sont tronquées au dixième.
export function formaterDuree(millisecondes: number): string {
  const minutes = Math.floor(millisecondes / 60_000)
  const secondes = Math.floor((millisecondes % 60_000) / 1000)
  const dixieme = Math.floor((millisecondes % 1000) / 100)
  return `${minutes}:${String(secondes).padStart(2, "0")},${dixieme}`
}

// --- Statistiques de carrière ---------------------------------------------------------------

export interface ResultatCarriere {
  epreuveId: string
  piloteId: string | null
  copiloteId: string | null
  voitureId: string
  validation: ValidationResultat
  statutFinal: StatutResultat
  kmChronometres: number | null
  classementClasse: number | null
}

export interface StatistiqueCarriere {
  cle: string
  epreuves: number
  arrivees: number
  // Pourcentage arrondi à l'entier inférieur ; null tant qu'aucune épreuve n'est validée.
  tauxArrivee: number | null
  km: number
  meilleurClassementClasse: number | null
}

interface Cumul {
  epreuves: Set<string>
  arrivees: number
  km: number
  meilleur: number | null
}

// Ne compte que les résultats validés. Les personnes sont comptées au pilotage et au copilotage.
export function statistiquesCarriere(resultats: readonly ResultatCarriere[]): {
  personnes: StatistiqueCarriere[]
  voitures: StatistiqueCarriere[]
} {
  const personnes = new Map<string, Cumul>()
  const voitures = new Map<string, Cumul>()
  const ajouter = (carte: Map<string, Cumul>, cle: string, resultat: ResultatCarriere) => {
    const cumul = carte.get(cle) ?? { epreuves: new Set<string>(), arrivees: 0, km: 0, meilleur: null }
    cumul.epreuves.add(resultat.epreuveId)
    if (resultat.statutFinal === "arrivee") cumul.arrivees += 1
    cumul.km += resultat.kmChronometres ?? 0
    if (resultat.classementClasse !== null && (cumul.meilleur === null || resultat.classementClasse < cumul.meilleur)) {
      cumul.meilleur = resultat.classementClasse
    }
    carte.set(cle, cumul)
  }

  for (const resultat of resultats) {
    if (resultat.validation !== "valide") continue
    ajouter(voitures, resultat.voitureId, resultat)
    for (const personneId of [resultat.piloteId, resultat.copiloteId]) {
      if (personneId) ajouter(personnes, personneId, resultat)
    }
  }

  const enStatistique = (carte: Map<string, Cumul>): StatistiqueCarriere[] =>
    Array.from(carte, ([cle, cumul]) => {
      const epreuves = cumul.epreuves.size
      return {
        cle,
        epreuves,
        arrivees: cumul.arrivees,
        tauxArrivee: epreuves === 0 ? null : Math.floor((cumul.arrivees * 100) / epreuves),
        km: Math.round(cumul.km * 10) / 10,
        meilleurClassementClasse: cumul.meilleur,
      }
    })

  return { personnes: enStatistique(personnes), voitures: enStatistique(voitures) }
}

// --- Bilan d'une saison ---------------------------------------------------------------------

export const STATUTS_PARTIS = ["parti", "arrivee", "abandon", "forfait"] as const

export interface EngagementBilan {
  statut: string
  validation: ValidationResultat | null
  statutFinal: StatutResultat | null
  kmChronometres: number | null
}

// Engagements partis (par leur statut), et arrivées, abandons, km chronométrés sur les seuls résultats validés.
export function bilanSaison(engagements: readonly EngagementBilan[]): {
  partis: number
  arrivees: number
  abandons: number
  km: number
} {
  let partis = 0
  let arrivees = 0
  let abandons = 0
  let km = 0
  for (const engagement of engagements) {
    if ((STATUTS_PARTIS as readonly string[]).includes(engagement.statut)) partis += 1
    if (engagement.validation !== "valide") continue
    if (engagement.statutFinal === "arrivee") arrivees += 1
    if (engagement.statutFinal === "abandon" || engagement.statutFinal === "forfait") abandons += 1
    km += engagement.kmChronometres ?? 0
  }
  return { partis, arrivees, abandons, km: Math.round(km * 10) / 10 }
}

// --- Écriture et débrief --------------------------------------------------------------------

export const MESSAGE_SAISON_CLOTUREE =
  "Cette saison est clôturée : ses épreuves, engagements et résultats ne se modifient plus. Ouvre une nouvelle saison pour continuer."

// Message de refus d'écriture sur une saison clôturée, ou null si la saison est ouverte.
export function refusEcritureSaison(clotureeAt: Date | null): string | null {
  return clotureeAt ? MESSAGE_SAISON_CLOTUREE : null
}

// Les débriefs sont privés à l'équipage : le responsable et l'équipage les voient, pas l'assistance.
export function peutVoirDebriefs(role: string): boolean {
  return role === "responsable" || role === "equipage"
}

// Ressenti : une note de 1 à 5, saisie par cinq boutons.
export function ressentiValide(valeur: number): boolean {
  return Number.isInteger(valeur) && valeur >= 1 && valeur <= 5
}

// Libellés et couleurs du statut de validation (partagés par le serveur et les écrans).
export const LIBELLE_VALIDATION: Record<string, string> = {
  saisi: "Saisi",
  a_verifier: "À vérifier",
  valide: "Validé",
  conteste: "Contesté",
}

export const COULEUR_VALIDATION: Record<string, string> = {
  saisi: "text-texte-discret",
  a_verifier: "text-etat-orange",
  valide: "text-etat-ok",
  conteste: "text-etat-rouge",
}
