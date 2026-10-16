// Rappels de Saison (article 960, section 3). Règle pure : pour un instant donné, elle dit quels
// rappels doivent exister. Le service crée ce qui manque et lève ce qui n'a plus lieu d'être.
// Calendrier : jours civils de Paris. Un rappel dont la clé existe déjà n'est jamais recréé,
// même décidé : sauf la relance de validation, qui met à jour la même action.

import { jourCivil, jourDeParis, type StatutEngagement, type ValidationResultat } from "./regles"

export const DELAI_RELANCE_VALIDATION_MS = 48 * 60 * 60 * 1000
const JOUR_MS = 24 * 60 * 60 * 1000

export type TypeRappel = "cloture_engagements" | "reconnaissance" | "programme_du_jour" | "resultat_a_saisir" | "resultat_a_valider"

// Qui reçoit le rappel : des rôles, des memberships précis, ou le cercle de validation (résultats).
export type DestinatairesRappel = { kind: "roles"; roles: Array<"responsable" | "equipage"> } | { kind: "memberships" } | { kind: "validation" }

export interface RappelDu {
  cle: string
  type: TypeRappel
  eventId: string
  entryId: string | null
  priorite: number
  titre: string
  destinataires: DestinatairesRappel
  terrain: boolean
  // Relance d'une validation déjà demandée : la même action est mise à jour, plus basse en priorité.
  relance: boolean
  // Memberships visés par « programme du jour » (équipage engagé).
  membershipsEquipage: string[]
}

export interface EngagementRappel {
  id: string
  statut: StatutEngagement
  membershipsEquipage: string[]
  resultat: { validation: ValidationResultat; createdAt: Date } | null
}

export interface EpreuveRappel {
  id: string
  nom: string
  statut: "envisagee" | "en_cours" | "terminee" | "annulee"
  dateDebut: Date
  dateFin: Date
  clotureEngagements: Date | null
  // Une reconnaissance est définie pour l'épreuve.
  aUneReco: boolean
  engagements: EngagementRappel[]
}

// Jour civil « AAAA-MM-JJ » → nombre de jours depuis une référence (pour les écarts).
function numeroJour(jour: string): number {
  return Date.parse(`${jour}T00:00:00Z`) / JOUR_MS
}

// Écart en jours civils entre deux jours : positif si `cible` est après `reference`.
function ecartJours(cible: string, reference: string): number {
  return numeroJour(cible) - numeroJour(reference)
}

// Heure entière à Paris (0 à 23).
function heureDeParis(instant: Date): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "numeric", hourCycle: "h23" }).format(instant))
}

export function rappelsDues(epreuves: readonly EpreuveRappel[], maintenant: Date, dejaCrees: ReadonlySet<string>): RappelDu[] {
  const aujourdhui = jourDeParis(maintenant)
  const rappels: RappelDu[] = []

  for (const epreuve of epreuves) {
    if (epreuve.statut === "annulee") continue
    // Clôture, reconnaissance et programme ne concernent que les épreuves à venir ou en cours.
    // Les résultats se rappellent aussi après la fin : l'épreuve passe « terminée ».
    const aVenir = epreuve.statut === "envisagee" || epreuve.statut === "en_cours"
    const debut = jourCivil(epreuve.dateDebut)
    const fin = jourCivil(epreuve.dateFin)
    const cible = { eventId: epreuve.id, entryId: null, terrain: false, relance: false, membershipsEquipage: [] as string[] }

    // Clôture des engagements : J-14 (jusqu'à J-8) puis J-7 (jusqu'au jour de clôture), tant qu'un engagement n'est pas payé.
    if (aVenir && epreuve.clotureEngagements) {
      const ecart = ecartJours(jourCivil(epreuve.clotureEngagements), aujourdhui)
      const nonPaye = epreuve.engagements.some((engagement) => engagement.statut === "envisage" || engagement.statut === "inscrit")
      if (nonPaye && ecart >= 0 && ecart <= 14) {
        // Le rappel J-14 s'éteint à J-7, quand J-7 le remplace : une clé par étape.
        const etape = ecart <= 7 ? 7 : 14
        rappels.push({
          ...cible,
          cle: `rappel:cloture:${epreuve.id}:${etape}`,
          type: "cloture_engagements",
          priorite: 2,
          titre: `Clôture des engagements dans ${ecart} jour${ecart > 1 ? "s" : ""} : ${epreuve.nom}`,
          destinataires: { kind: "roles", roles: ["responsable", "equipage"] },
        })
      }
    }

    // Reconnaissances : J-3 avant le début, si une reco est définie.
    if (epreuve.aUneReco && epreuve.statut === "envisagee") {
      const ecart = ecartJours(debut, aujourdhui)
      if (ecart >= 0 && ecart <= 3) {
        rappels.push({
          ...cible,
          cle: `rappel:reco:${epreuve.id}`,
          type: "reconnaissance",
          priorite: 7,
          titre: `Reconnaissance à faire avant ${epreuve.nom}`,
          destinataires: { kind: "roles", roles: ["equipage"] },
        })
      }
    }

    // Programme du jour : chaque jour de l'épreuve, le matin (ou dès l'instant où le rappel existe déjà).
    if (aVenir && ecartJours(aujourdhui, debut) >= 0 && ecartJours(fin, aujourdhui) >= 0) {
      const cleJour = `rappel:programme:${epreuve.id}:${aujourdhui}`
      if (heureDeParis(maintenant) < 12 || dejaCrees.has(cleJour)) {
        const membershipsEquipage = Array.from(new Set(epreuve.engagements.flatMap((engagement) => engagement.membershipsEquipage)))
        if (membershipsEquipage.length > 0) {
          rappels.push({
            ...cible,
            cle: cleJour,
            type: "programme_du_jour",
            priorite: 7,
            titre: `Programme du jour : ${epreuve.nom}`,
            destinataires: { kind: "memberships" },
            terrain: true,
            membershipsEquipage,
          })
        }
      }
    }

    for (const engagement of epreuve.engagements) {
      // Résultat à saisir : engagement parti, sans résultat, à partir du lendemain de la fin.
      if (engagement.statut === "parti" && !engagement.resultat && ecartJours(aujourdhui, fin) >= 1) {
        rappels.push({
          ...cible,
          entryId: engagement.id,
          cle: `rappel:resultat_saisir:${engagement.id}`,
          type: "resultat_a_saisir",
          priorite: 2,
          titre: `Résultat à saisir : ${epreuve.nom}`,
          destinataires: { kind: "roles", roles: ["equipage"] },
        })
      }

      // Résultat à valider : relancé 48 heures après la saisie, tant qu'il n'est pas validé.
      const resultat = engagement.resultat
      if (resultat && (resultat.validation === "saisi" || resultat.validation === "a_verifier")) {
        if (maintenant.getTime() - resultat.createdAt.getTime() >= DELAI_RELANCE_VALIDATION_MS) {
          rappels.push({
            ...cible,
            entryId: engagement.id,
            cle: `resultat_a_valider:${engagement.id}`,
            type: "resultat_a_valider",
            priorite: 6,
            titre: `Relance : valider le résultat de ${epreuve.nom}`,
            destinataires: { kind: "validation" },
            relance: true,
          })
        }
      }
    }
  }

  return rappels
}
