// Lectures d'Équipe partagées avec Saison (tâche 5.2, brief §0.2). Lecture seule et sans garde : l'app appelante
// contrôle son propre accès. Elles ne renvoient que les dates de validité et les types d'équipement : jamais le
// contact d'urgence, la taille, le ressenti ni les montants.

import type { ObjetLieLu } from "@/apps/checklist/objets-types"
import type { ContexteTeam } from "@/core/contexte"
import { prismaPourTeam } from "@/lib/prisma"

import { objetEquipement, objetLicence } from "./objets-checklist"
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

// ─── Objets liés par Check-lists (tâche 5.7a, 956 §4) ────────────────────────────────────────────────────────────

// Licences et équipements (homologations) des personnes données : l'équipage d'un engagement. Lecture seule, par team.
export async function listerObjetsPourChecklist(ctx: ContexteTeam, personIds: string[]): Promise<ObjetLieLu[]> {
  if (personIds.length === 0) return []
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const [licences, equipements] = await Promise.all([
    client.equipeLicence.findMany({
      where: { teamId: ctx.teamId, personId: { in: personIds }, deletedAt: null },
      select: { id: true, personId: true, type: true, valableAu: true },
    }),
    client.equipeGear.findMany({
      where: { teamId: ctx.teamId, personId: { in: personIds }, deletedAt: null },
      select: { id: true, personId: true, type: true, finHomologation: true },
    }),
  ])
  const maintenant = new Date()
  return [...licences.map((licence) => objetLicence(licence, maintenant)), ...equipements.map((equipement) => objetEquipement(equipement, maintenant))]
}

// Une licence ou un équipement, relu par son identifiant. Null si l'objet n'existe plus dans la team.
export async function lireObjetPourChecklist(ctx: ContexteTeam, type: "licence_equipe" | "homologation_equipe", id: string): Promise<ObjetLieLu | null> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  if (type === "licence_equipe") {
    const licence = await client.equipeLicence.findFirst({
      where: { id, teamId: ctx.teamId, deletedAt: null },
      select: { id: true, personId: true, type: true, valableAu: true },
    })
    return licence ? objetLicence(licence, new Date()) : null
  }
  const equipement = await client.equipeGear.findFirst({
    where: { id, teamId: ctx.teamId, deletedAt: null },
    select: { id: true, personId: true, type: true, finHomologation: true },
  })
  return equipement ? objetEquipement(equipement, new Date()) : null
}
