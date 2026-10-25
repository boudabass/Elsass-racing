// Lectures d'Équipe partagées avec Saison (tâche 5.2, brief §0.2). Lecture seule et sans garde : l'app appelante
// contrôle son propre accès. Elles ne renvoient que les dates de validité et les types d'équipement : jamais le
// contact d'urgence, la taille, le ressenti ni les montants.

import type { ContexteTeam } from "@/core/contexte"
import { prismaPourTeam } from "@/lib/prisma"

import type { TypeEquipement } from "./regles"

export interface LicenceSituation {
  valableDu: Date | null
  valableAu: Date | null
}

export interface EquipementSituation {
  type: TypeEquipement
  finHomologation: Date | null
}

export interface SituationPersonne {
  personId: string
  prenom: string
  licences: LicenceSituation[]
  equipements: EquipementSituation[]
}

// Équipe est-elle activée pour la team ? Sans elle, Saison ne suit pas les points licences et homologations.
export async function equipeActivee(ctx: ContexteTeam): Promise<boolean> {
  const activation = await prismaPourTeam(ctx.teamId, ctx.userId).coreTeamApp.findFirst({
    where: { teamId: ctx.teamId, appCle: "equipe", activee: true, deletedAt: null },
    select: { id: true },
  })
  return activation !== null
}

// Situation des personnes données, licences et équipements non supprimés. Une personne absente de la team
// n'apparaît pas dans la carte rendue.
export async function lireSituationsPersonnes(ctx: ContexteTeam, personIds: string[]): Promise<Map<string, SituationPersonne>> {
  const uniques = Array.from(new Set(personIds))
  const situations = new Map<string, SituationPersonne>()
  if (uniques.length === 0) return situations

  const personnes = await prismaPourTeam(ctx.teamId, ctx.userId).corePerson.findMany({
    where: { teamId: ctx.teamId, id: { in: uniques }, deletedAt: null },
    select: {
      id: true,
      prenom: true,
      equipeLicences: {
        where: { teamId: ctx.teamId, deletedAt: null },
        select: { valableDu: true, valableAu: true },
      },
      equipeGears: {
        where: { teamId: ctx.teamId, deletedAt: null },
        select: { type: true, finHomologation: true },
      },
    },
  })

  for (const personne of personnes) {
    situations.set(personne.id, {
      personId: personne.id,
      prenom: personne.prenom,
      licences: personne.equipeLicences,
      equipements: personne.equipeGears,
    })
  }
  return situations
}
