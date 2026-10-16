// Règles pures de Saison : statuts, indice de préparation, cycle de validation des résultats,
// prochaine épreuve, clôture, masquage des montants. Aucun accès base, aucune date implicite :
// l'instant « maintenant » est toujours passé en paramètre.
//
// Dates : les dates calendaires (dateDebut, dateFin, payeLe) sont des Date à minuit UTC, comme
// Prisma les renvoie pour @db.Date. Les instants (maintenant, horodatages) sont des Date réelles.
// « Aujourd'hui » s'entend au calendrier de Paris.

import type { Niveau } from "@/core/droits/niveaux"

export type StatutEngagement = "envisage" | "inscrit" | "paye" | "parti" | "arrivee" | "abandon" | "forfait"
export type StatutResultat = "arrivee" | "abandon" | "exclusion" | "forfait"
export type ValidationResultat = "saisi" | "a_verifier" | "valide" | "conteste"
export type StatutEpreuve = "envisagee" | "en_cours" | "terminee" | "annulee"
export type StatutPoint = "regle" | "ouvert"
export type RoleMembre = "responsable" | "equipage" | "assistance" | "invite"

const HEURE_MS = 60 * 60 * 1000
const DELAI_ROUGE_MS = 48 * HEURE_MS

// --- Calendrier ----------------------------------------------------------------------------

// Jour civil « AAAA-MM-JJ » d'une date calendaire (minuit UTC, tel que Prisma la renvoie).
export function jourCivil(date: Date): string {
  return date.toISOString().slice(0, 10)
}

// Jour civil de Paris pour un instant donné.
export function jourDeParis(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(instant)
}

// Instant du début d'un jour civil à Paris (minuit local, heure d'été ou d'hiver).
// Le 00:00 UTC du jour affiche 1 h ou 2 h à Paris : on retire ce décalage.
export function minuitParis(date: Date): Date {
  const utc = new Date(`${jourCivil(date)}T00:00:00Z`)
  const heure = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "numeric", hourCycle: "h23" }).format(utc))
  return new Date(utc.getTime() - heure * HEURE_MS)
}

// --- 1. Statut d'un engagement -------------------------------------------------------------

export interface ResultatRegles {
  statutFinal: StatutResultat
  validation: ValidationResultat
}

export interface EntreeStatut {
  dossierEnvoyeLe: Date | null
  payeLe: Date | null
  dateDebutEpreuve: Date
  resultat: ResultatRegles | null
}

// Le statut avance avec les informations saisies et recule quand elles sont retirées : il est
// recalculé à partir de l'état, jamais cumulé. Un résultat non validé ne change rien.
// Exclusion : l'équipage est arrivé, la sanction est une décision de classement ; le statut est arrivee.
export function statutEngagement(entree: EntreeStatut, aujourdhui: Date): StatutEngagement {
  if (entree.resultat?.validation === "valide") {
    const correspondance: Record<StatutResultat, StatutEngagement> = {
      arrivee: "arrivee",
      exclusion: "arrivee",
      abandon: "abandon",
      forfait: "forfait",
    }
    return correspondance[entree.resultat.statutFinal]
  }
  if (jourCivil(entree.dateDebutEpreuve) <= jourDeParis(aujourdhui)) return "parti"
  if (entree.payeLe) return "paye"
  if (entree.dossierEnvoyeLe) return "inscrit"
  return "envisage"
}

// --- 2. Statut d'une épreuve ---------------------------------------------------------------

export interface EpreuveRegles {
  statut: StatutEpreuve
  dateDebut: Date
  dateFin: Date
}

// Annulée reste annulée. En cours du premier au dernier jour inclus, terminée après, sinon envisagée.
export function statutEpreuve(epreuve: EpreuveRegles, aujourdhui: Date): StatutEpreuve {
  if (epreuve.statut === "annulee") return "annulee"
  const jour = jourDeParis(aujourdhui)
  if (jour < jourCivil(epreuve.dateDebut)) return "envisagee"
  if (jour <= jourCivil(epreuve.dateFin)) return "en_cours"
  return "terminee"
}

// --- 3. Indice de préparation --------------------------------------------------------------

export type CouleurIndice = "vert" | "orange" | "rouge"

export interface IndicePreparation {
  pourcentage: number
  couleur: CouleurIndice
}

// Réglés ÷ points existants, arrondi à l'entier inférieur : 100 n'apparaît que si tout est réglé.
// Vert à 100 ; rouge si un point ouvert commence dans moins de 48 heures (ou a déjà commencé) ;
// orange sinon. Aucun point : pas d'indice (null), jamais 100 par défaut.
export function indicePreparation(
  points: ReadonlyArray<{ statut: StatutPoint }>,
  maintenant: Date,
  debutEpreuve: Date,
): IndicePreparation | null {
  if (points.length === 0) return null

  const reglés = points.filter((point) => point.statut === "regle").length
  const pourcentage = Math.floor((reglés * 100) / points.length)
  if (pourcentage === 100) return { pourcentage, couleur: "vert" }

  const ouvertProche = points.some(
    (point) => point.statut === "ouvert" && debutEpreuve.getTime() - maintenant.getTime() < DELAI_ROUGE_MS,
  )
  return { pourcentage, couleur: ouvertProche ? "rouge" : "orange" }
}

// --- 4. Cycle de validation d'un résultat --------------------------------------------------

export interface EtatResultat {
  validation: ValidationResultat
  saisiParMembershipId: string | null
}

export interface ActeurResultat {
  membershipId: string
  role: RoleMembre
}

export type GesteResultat = { type: "joindre_preuve" } | { type: "valider" } | { type: "contester"; commentaire: string }

export type TransitionResultat = { ok: true; validation: ValidationResultat } | { ok: false; message: string }

// saisi → a_verifier (preuve jointe) → valide → conteste → a_verifier (nouvelle preuve).
// Valider : le responsable, ou un autre membre d'équipage ; jamais celui qui a saisi, sauf responsable.
export function transitionResultat(etat: EtatResultat, geste: GesteResultat, acteur: ActeurResultat): TransitionResultat {
  switch (geste.type) {
    case "joindre_preuve": {
      if (etat.validation === "valide") {
        return { ok: false, message: "Ce résultat est validé. Conteste-le avant d'ajouter une preuve." }
      }
      return { ok: true, validation: "a_verifier" }
    }

    case "valider": {
      if (etat.validation !== "a_verifier") {
        return { ok: false, message: "Seul un résultat à vérifier peut être validé. Joins d'abord une preuve." }
      }
      if (acteur.role !== "responsable" && acteur.role !== "equipage") {
        return { ok: false, message: "Seul le responsable ou un membre d'équipage peut valider un résultat." }
      }
      const auteurDeSaisie = etat.saisiParMembershipId === acteur.membershipId
      if (auteurDeSaisie && acteur.role !== "responsable") {
        return { ok: false, message: "Tu as saisi ce résultat : un autre membre doit le valider." }
      }
      return { ok: true, validation: "valide" }
    }

    case "contester": {
      if (etat.validation !== "valide") {
        return { ok: false, message: "Seul un résultat validé peut être contesté." }
      }
      if (geste.commentaire.trim() === "") {
        return { ok: false, message: "Explique pourquoi tu contestes ce résultat." }
      }
      return { ok: true, validation: "conteste" }
    }
  }
}

// --- 5. Prochaine épreuve ------------------------------------------------------------------

export interface EpreuvePourProchaine extends EpreuveRegles {
  engagements: StatutEngagement[]
}

// Première épreuve non annulée, pas encore finie, avec au moins un engagement non envisagé.
// À défaut, la première non annulée qui commence à venir. Null s'il n'y en a aucune.
export function prochaineEpreuve<T extends EpreuvePourProchaine>(epreuves: readonly T[], aujourdhui: Date): T | null {
  const jour = jourDeParis(aujourdhui)
  const chronologiques = epreuves
    .filter((epreuve) => epreuve.statut !== "annulee")
    .sort((a, b) => jourCivil(a.dateDebut).localeCompare(jourCivil(b.dateDebut)))

  const engagee = chronologiques.find(
    (epreuve) => jourCivil(epreuve.dateFin) >= jour && epreuve.engagements.some((statut) => statut !== "envisage"),
  )
  if (engagee) return engagee

  return chronologiques.find((epreuve) => jourCivil(epreuve.dateDebut) >= jour) ?? null
}

// --- 6. Clôture proposée -------------------------------------------------------------------

export interface EngagementPourCloture {
  statut: StatutEngagement
  validation: ValidationResultat | null
}

export interface EpreuvePourCloture {
  statut: StatutEpreuve
  dateDebut: Date
  engagements: EngagementPourCloture[]
}

const STATUTS_PARTIS: readonly StatutEngagement[] = ["parti", "arrivee", "abandon", "forfait"]

// Vraie quand la dernière épreuve (hors annulées) a au moins un engagement parti, et que chacun
// de ces engagements partis a un résultat validé.
export function clotureProposee(epreuves: readonly EpreuvePourCloture[]): boolean {
  const actives = epreuves.filter((epreuve) => epreuve.statut !== "annulee")
  if (actives.length === 0) return false

  const derniere = actives.reduce((a, b) => (jourCivil(b.dateDebut) > jourCivil(a.dateDebut) ? b : a))
  const partis = derniere.engagements.filter((engagement) => STATUTS_PARTIS.includes(engagement.statut))
  return partis.length > 0 && partis.every((engagement) => engagement.validation === "valide")
}

// --- Montants : lecture de l'assistance ----------------------------------------------------

// Champs retirés des lectures quand le niveau effectif est « lecture » (l'assistance voit Saison,
// jamais les montants ni les moyens de paiement).
export const CHAMPS_MONTANTS = ["montantDu", "tarifNormal", "tarifLicencieAsa", "modePaiement", "reference"] as const

export function masquerMontants<T extends object>(ligne: T, niveau: Niveau): Omit<T, (typeof CHAMPS_MONTANTS)[number]> {
  if (niveau !== "lecture") return ligne as Omit<T, (typeof CHAMPS_MONTANTS)[number]>
  const copie: Record<string, unknown> = { ...(ligne as Record<string, unknown>) }
  for (const champ of CHAMPS_MONTANTS) delete copie[champ]
  return copie as Omit<T, (typeof CHAMPS_MONTANTS)[number]>
}
