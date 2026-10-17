import { prismaPourTeam } from "@/lib/prisma"
import { avecReprisePourConflit } from "@/lib/reprise-conflit"
import { newId } from "@/core/ids"
import type { ContexteTeam } from "@/core/contexte"
import type { SettingsLudique, SettingsTailleTexte, SettingsTheme } from "@/generated/prisma/client"

// Préférences de Réglages, lues et écrites dans le contexte de team (RLS).

export interface PrefsMembre {
  theme: SettingsTheme
  tailleTexte: SettingsTailleTexte
  modeTerrain: boolean
  ludiqueAffiche: SettingsLudique
  heuresCalmesDebut: string | null
  heuresCalmesFin: string | null
  appsDecouvertes: string[]
}

// Préférences du membre, avec les valeurs par défaut quand la ligne n'existe pas encore.
export async function prefsMembre(ctx: ContexteTeam): Promise<PrefsMembre> {
  const pref = await prismaPourTeam(ctx.teamId, ctx.userId).settingsMemberPref.findUnique({
    where: { membershipId: ctx.membership.id },
  })
  return {
    theme: pref?.theme ?? "sombre",
    tailleTexte: pref?.tailleTexte ?? "normale",
    modeTerrain: pref?.modeTerrain ?? false,
    ludiqueAffiche: pref?.ludiqueAffiche ?? "comme_la_team",
    heuresCalmesDebut: pref?.heuresCalmesDebut ?? null,
    heuresCalmesFin: pref?.heuresCalmesFin ?? null,
    appsDecouvertes: pref?.appsDecouvertes ?? [],
  }
}

// Écrit une partie des préférences du membre. La ligne est créée à la volée.
export async function mettreAJourPrefsMembre(ctx: ContexteTeam, donnees: Partial<PrefsMembre>): Promise<void> {
  // Deux écritures simultanées sur la même ligne (onglets ouverts) peuvent se croiser : P2034, reprise bornée.
  await avecReprisePourConflit(() =>
    prismaPourTeam(ctx.teamId, ctx.userId).settingsMemberPref.upsert({
      where: { membershipId: ctx.membership.id },
      create: { id: newId(), teamId: ctx.teamId, membershipId: ctx.membership.id, ...donnees },
      update: donnees,
    }),
  )
}

// Ludique de la team (trophées et paliers). Vrai par défaut.
export async function ludiqueAfficheDansLaTeam(ctx: ContexteTeam): Promise<boolean> {
  const pref = await prismaPourTeam(ctx.teamId, ctx.userId).settingsTeamPref.findUnique({
    where: { teamId: ctx.teamId },
    select: { ludiqueAffiche: true },
  })
  return pref?.ludiqueAffiche ?? true
}

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
  // Même reprise bornée que mettreAJourPrefsMembre : P2034 sur la ligne de préférences.
  await avecReprisePourConflit(() =>
    prismaPourTeam(ctx.teamId, ctx.userId).settingsMemberPref.upsert({
      where: { membershipId: ctx.membership.id },
      create: { id: newId(), teamId: ctx.teamId, membershipId: ctx.membership.id, modeTerrain: actif },
      update: { modeTerrain: actif },
    }),
  )
}

// Réglage de la team : proposer le mode terrain le jour d'une épreuve. Vrai par défaut.
export async function terrainProposeJourEpreuve(ctx: ContexteTeam): Promise<boolean> {
  const pref = await prismaPourTeam(ctx.teamId, ctx.userId).settingsTeamPref.findUnique({
    where: { teamId: ctx.teamId },
    select: { terrainProposeJourEpreuve: true },
  })
  return pref?.terrainProposeJourEpreuve ?? true
}
