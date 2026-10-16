import { prismaPourTeam } from "@/lib/prisma"
import { newId } from "@/core/ids"
import type { ContexteTeam } from "@/core/contexte"

// Préférences de Réglages, lues et écrites dans le contexte de team (RLS).

// Mode terrain du membre. Pas de ligne = désactivé.
export async function modeTerrainDuMembre(ctx: ContexteTeam): Promise<boolean> {
  const pref = await prismaPourTeam(ctx.teamId, ctx.userId).settingsMemberPref.findUnique({
    where: { membershipId: ctx.membership.id },
    select: { modeTerrain: true },
  })
  return pref?.modeTerrain ?? false
}

// Écrit le mode terrain du membre. La ligne de préférences est créée à la volée.
export async function fixerModeTerrain(ctx: ContexteTeam, actif: boolean): Promise<void> {
  await prismaPourTeam(ctx.teamId, ctx.userId).settingsMemberPref.upsert({
    where: { membershipId: ctx.membership.id },
    create: { id: newId(), teamId: ctx.teamId, membershipId: ctx.membership.id, modeTerrain: actif },
    update: { modeTerrain: actif },
  })
}

// Réglage de la team : proposer le mode terrain le jour d'une épreuve. Vrai par défaut.
export async function terrainProposeJourEpreuve(ctx: ContexteTeam): Promise<boolean> {
  const pref = await prismaPourTeam(ctx.teamId, ctx.userId).settingsTeamPref.findUnique({
    where: { teamId: ctx.teamId },
    select: { terrainProposeJourEpreuve: true },
  })
  return pref?.terrainProposeJourEpreuve ?? true
}
