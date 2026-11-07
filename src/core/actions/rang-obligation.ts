// Rang bloquant d'une obligation pour une épreuve proche (960 §5, priorité 1 « Bloquant »). Pur : aucun accès base.
// Chaque app donne ses faits (dates de l'épreuve, statut de l'engagement, fin de validité de la fiche) ; la règle est ici,
// une seule fois. Hors de la règle, le rang reste celui de l'échéance (prioriteEcheance, priorites.ts).
import { jourParis, PRIORITE } from "./priorites"

// Fenêtre : l'épreuve commence au plus tard dans 7 jours (jour civil de Paris, J+7 compris), ou elle est en cours.
export const JOURS_FENETRE_BLOQUANTE = 7

// Statuts qui engagent la personne ou la voiture pour l'épreuve. Forfait, abandon, arrivée et parti ne le sont plus.
export const STATUTS_ENGAGEMENT_BLOQUANT = ["envisage", "inscrit", "paye"] as const
export type StatutEngagementBloquant = (typeof STATUTS_ENGAGEMENT_BLOQUANT)[number] | "parti" | "arrivee" | "abandon" | "forfait"

export interface EngagementPourRang {
  eventId: string
  dateDebut: Date
  dateFin: Date
  annulee: boolean
  statut: StatutEngagementBloquant
}

export interface ObligationPourRang {
  // Fin de validité de la fiche (licence, homologation, papier). Null : pas d'échéance, donc jamais bloquante.
  valableJusquAu: Date | null
}

// Jour civil « AAAA-MM-JJ » d'une date stockée à minuit UTC (dates d'épreuve et de fiche).
function jourDe(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function jourDecale(jour: string, jours: number): string {
  return new Date(Date.parse(`${jour}T00:00:00Z`) + jours * 86_400_000).toISOString().slice(0, 10)
}

// Bornes de la fenêtre en dates de base (minuit UTC) : une épreuve est dans la fenêtre si elle commence avant `limite`
// et finit après `debut`. Les lectures (Prisma) s'en servent ; la règle reste engagementDansFenetre.
export function bornesFenetre(maintenant: Date): { debut: Date; limite: Date } {
  const aujourdhui = jourParis(maintenant)
  return {
    debut: new Date(`${aujourdhui}T00:00:00Z`),
    limite: new Date(`${jourDecale(aujourdhui, JOURS_FENETRE_BLOQUANTE)}T00:00:00Z`),
  }
}

// L'épreuve est dans la fenêtre : elle commence au plus tard dans JOURS_FENETRE_BLOQUANTE jours, ou elle est en cours.
// Une épreuve annulée n'entre jamais dans la fenêtre.
export function engagementDansFenetre(engagement: EngagementPourRang, maintenant: Date): boolean {
  if (engagement.annulee) return false
  const aujourdhui = jourParis(maintenant)
  const limite = jourDecale(aujourdhui, JOURS_FENETRE_BLOQUANTE)
  return jourDe(engagement.dateDebut) <= limite && jourDe(engagement.dateFin) >= aujourdhui
}

// La fiche n'est plus valable le jour de l'épreuve : sa fin tombe avant ce jour civil. Sans fin : valable.
export function ficheNonValableLe(valableJusquAu: Date | null, jourEpreuve: string): boolean {
  if (valableJusquAu === null) return false
  return jourDe(valableJusquAu) < jourEpreuve
}

// L'engagement le plus tôt de la fenêtre, parmi ceux qui satisfont le statut demandé.
function plusTot(engagements: readonly EngagementPourRang[], maintenant: Date, statuts: readonly string[]): EngagementPourRang | null {
  const candidats = engagements.filter((e) => statuts.includes(e.statut) && engagementDansFenetre(e, maintenant))
  candidats.sort((a, b) => a.dateDebut.getTime() - b.dateDebut.getTime() || a.eventId.localeCompare(b.eventId))
  return candidats[0] ?? null
}

// Rang bloquant d'une obligation : la fiche n'est pas valable le jour d'une épreuve de la fenêtre, à laquelle la personne
// ou la voiture est engagée (envisagé, inscrit ou payé). Plusieurs épreuves : la plus tôt. Retourne l'épreuve à nommer dans
// le libellé, ou null si la règle ne s'applique pas (le rang normal reste à l'appelant).
export function rangObligation(
  obligation: ObligationPourRang,
  engagements: readonly EngagementPourRang[],
  maintenant: Date,
): { priorite: typeof PRIORITE.bloquant; eventId: string } | null {
  const engagesNonValables = engagements.filter((e) => ficheNonValableLe(obligation.valableJusquAu, jourDe(e.dateDebut)))
  const premier = plusTot(engagesNonValables, maintenant, STATUTS_ENGAGEMENT_BLOQUANT)
  return premier ? { priorite: PRIORITE.bloquant, eventId: premier.eventId } : null
}

// Une épreuve de la fenêtre dont l'engagement n'est pas encore payé : l'action payer_engagement (Saison). Envisagé ou inscrit
// seulement ; un engagement payé n'a rien à faire. Retourne l'engagement le plus tôt, ou null.
export function engagementAPayer(engagements: readonly EngagementPourRang[], maintenant: Date): EngagementPourRang | null {
  return plusTot(engagements, maintenant, ["envisage", "inscrit"])
}
