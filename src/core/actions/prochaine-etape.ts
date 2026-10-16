// Bouton « Prochaine étape » : choix de la prochaine action à faire. Pur.
// Règles : article 960, section 5.

import { differenceInCalendarDays } from "date-fns"

import type { ActionBoite } from "./filtrage"

export interface EpreuveProchaine {
  nom: string
  dateDebut: Date
}

export interface ParametresProchaineEtape {
  // Déjà filtrées pour le membre et non reportées (cf. actions-serveur.ts).
  actions: readonly ActionBoite[]
  maintenant: Date
  prochaineEpreuve?: EpreuveProchaine
  modeTerrain: boolean
}

export type ProchaineEtape =
  | { genre: "action"; action: ActionBoite; libelle: string; pourquoi: string }
  | { genre: "compte_a_rebours"; libelle: string; epreuve: EpreuveProchaine }
  | { genre: "rien" }

const DEUX_JOURS_MS = 48 * 60 * 60 * 1000
const UN_JOUR_MS = 24 * 60 * 60 * 1000

// Une ligne « pourquoi » par priorité. Le nom de l'épreuve sert à la priorité 1.
export function pourquoi(priorite: number, epreuve?: EpreuveProchaine): string {
  switch (priorite) {
    case 1:
      return epreuve ? `Bloquant pour ${epreuve.nom}` : "Bloquant"
    case 2:
      return "Échéance dépassée ou aujourd'hui"
    case 3:
      return "Les trophées et statistiques attendent ce résultat"
    case 4:
      return "Mouvement à confirmer"
    case 5:
      return "Contrepartie due à un partenaire"
    case 6:
      return "Relance due"
    case 7:
      return "Suggestion de préparation"
    case 8:
      return "Proposition d'une autre app"
    default:
      return "Échéance proche"
  }
}

// À moins de 48 heures de l'épreuve (en cours ou à venir).
function epreuveProche(epreuve: EpreuveProchaine | undefined, maintenant: Date): boolean {
  if (!epreuve) return false
  const ecart = epreuve.dateDebut.getTime() - maintenant.getTime()
  return ecart <= DEUX_JOURS_MS && ecart > -UN_JOUR_MS
}

// Rang de groupe : à moins de 48 h, la priorité 1 passe devant tout, puis la 7, puis le reste.
function rangGroupe(action: ActionBoite, proche: boolean): number {
  if (!proche) return 2
  if (action.priorite === 1) return 0
  if (action.priorite === 7) return 1
  return 2
}

function comparer(a: ActionBoite, b: ActionBoite, proche: boolean): number {
  const groupe = rangGroupe(a, proche) - rangGroupe(b, proche)
  if (groupe !== 0) return groupe
  if (a.priorite !== b.priorite) return a.priorite - b.priorite
  // Échéance la plus proche d'abord ; sans échéance, en dernier.
  const ea = a.echeance ? a.echeance.getTime() : Number.POSITIVE_INFINITY
  const eb = b.echeance ? b.echeance.getTime() : Number.POSITIVE_INFINITY
  if (ea !== eb) return ea < eb ? -1 : 1
  return a.createdAt.getTime() - b.createdAt.getTime()
}

export function choisirProchaineEtape({
  actions,
  maintenant,
  prochaineEpreuve,
  modeTerrain,
}: ParametresProchaineEtape): ProchaineEtape {
  const candidates = actions.filter((a) => !modeTerrain || a.destinataires.terrain)
  const proche = epreuveProche(prochaineEpreuve, maintenant)

  if (candidates.length > 0) {
    const [action] = [...candidates].sort((a, b) => comparer(a, b, proche))
    return {
      genre: "action",
      action,
      libelle: action.titre,
      pourquoi: pourquoi(action.priorite, prochaineEpreuve),
    }
  }

  if (prochaineEpreuve) {
    const jours = differenceInCalendarDays(prochaineEpreuve.dateDebut, maintenant)
    if (jours >= 0) {
      const libelle = jours === 0 ? `Aujourd'hui ${prochaineEpreuve.nom}` : `J-${jours} ${prochaineEpreuve.nom}`
      return { genre: "compte_a_rebours", libelle, epreuve: prochaineEpreuve }
    }
  }

  return { genre: "rien" }
}

// Libellé de compte à rebours d'une épreuve : « J-26 », « Demain », « Aujourd'hui », et
// « dans 5 h » le jour même, quand le départ est dans moins de 24 heures.
export function libelleCompteARebours(epreuve: EpreuveProchaine, maintenant: Date): string {
  const ecart = epreuve.dateDebut.getTime() - maintenant.getTime()
  const jours = differenceInCalendarDays(epreuve.dateDebut, maintenant)
  if (jours === 0) return "Aujourd'hui"
  if (ecart > 0 && ecart < UN_JOUR_MS) return `dans ${Math.max(1, Math.round(ecart / 3_600_000))} h`
  if (jours === 1) return "Demain"
  return `J-${jours}`
}
