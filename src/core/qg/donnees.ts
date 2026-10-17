// Données du QG, chargées une fois par requête (layout (app)). Les composants reçoivent
// ces valeurs en props : aucune requête dans les composants.

import { cache } from "react"

import { prismaPourTeam } from "@/lib/prisma"
import { exigerContexte } from "@/core/droits/garde-serveur"
import type { ContexteTeam } from "@/core/contexte"
import { appsVisibles } from "@/core/sdk/apps-serveur"
import type { AppVisible } from "@/core/sdk/apps"
import { listerActionsVisibles } from "@/core/actions/actions-serveur"
import { grouperActions, type GroupeAction } from "@/core/actions/regroupement"
import type { ActionBoite } from "@/core/actions/filtrage"
import { choisirProchaineEtape, type ProchaineEtape, type EpreuveProchaine } from "@/core/actions/prochaine-etape"
import { prochaineEpreuveDeLEquipe } from "@/apps/saison/widgets-serveur"

export type NiveauAlerte = "orange" | "rouge"

export interface DonneesQg {
  team: { id: string; nom: string; slug: string; couleurPrincipale: string | null; logoFileId: string | null }
  role: string
  apps: AppVisible[]
  actions: ActionBoite[]
  groupes: GroupeAction[]
  // Par clé d'app : nombre d'actions pour ce membre, et alerte ouverte la plus grave.
  actionsParApp: Record<string, number>
  alerteParApp: Record<string, NiveauAlerte | null>
  alertesParApp: Record<string, number>
  tachesParApp: Record<string, number>
  saisonEnCours: { nom: string } | null
  prochaineEpreuve: (EpreuveProchaine & { id: string; lieu: string | null; type: string; dateFin: Date }) | null
  prochaineEtape: ProchaineEtape
  modeTerrain: boolean
}


export async function chargerQg(ctx: ContexteTeam, modeTerrain: boolean): Promise<DonneesQg> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const maintenant = new Date()

  // Prochaine épreuve : la règle de Saison (engagée en priorité), la même que le calendrier.
  const epreuvePromise = prochaineEpreuveDeLEquipe(ctx, maintenant)
  const [team, apps, actions, alertes, taches, saison] = await Promise.all([
    client.coreTeam.findUniqueOrThrow({
      where: { id: ctx.teamId },
      select: { id: true, nom: true, slug: true, couleurPrincipale: true, logoFileId: true },
    }),
    appsVisibles(ctx),
    listerActionsVisibles(ctx),
    client.coreAlert.findMany({
      where: { teamId: ctx.teamId, statut: "ouverte" },
      select: { app: true, niveau: true },
    }),
    client.coreTask.findMany({
      where: { teamId: ctx.teamId, statut: "a_faire" },
      select: { app: true },
    }),
    client.coreSeason.findFirst({
      where: { teamId: ctx.teamId, enCours: true },
      select: { nom: true },
    }),
  ])

  const actionsParApp: Record<string, number> = {}
  for (const action of actions) {
    actionsParApp[action.appOrigine] = (actionsParApp[action.appOrigine] ?? 0) + 1
  }

  // La plus grave des alertes ouvertes : rouge l'emporte sur orange, info ne donne pas de pastille.
  const alerteParApp: Record<string, NiveauAlerte | null> = {}
  const alertesParApp: Record<string, number> = {}
  for (const alerte of alertes) {
    alertesParApp[alerte.app] = (alertesParApp[alerte.app] ?? 0) + 1
    if (alerte.niveau === "rouge") alerteParApp[alerte.app] = "rouge"
    else if (alerte.niveau === "orange" && alerteParApp[alerte.app] !== "rouge") alerteParApp[alerte.app] = "orange"
  }

  const tachesParApp: Record<string, number> = {}
  for (const tache of taches) {
    tachesParApp[tache.app] = (tachesParApp[tache.app] ?? 0) + 1
  }

  const epreuve = await epreuvePromise
  const prochaineEpreuve = epreuve
    ? { id: epreuve.id, nom: epreuve.nom, dateDebut: epreuve.dateDebut, dateFin: epreuve.dateFin, lieu: epreuve.lieu, type: epreuve.type }
    : null

  const prochaineEtape = choisirProchaineEtape({
    actions,
    maintenant,
    prochaineEpreuve: prochaineEpreuve ? { nom: prochaineEpreuve.nom, dateDebut: prochaineEpreuve.dateDebut } : undefined,
    modeTerrain,
  })

  return {
    team,
    role: ctx.membership.role,
    apps,
    actions,
    groupes: grouperActions(actions),
    actionsParApp,
    alerteParApp,
    alertesParApp,
    tachesParApp,
    saisonEnCours: saison,
    prochaineEpreuve,
    prochaineEtape,
    modeTerrain,
  }
}

// Une seule lecture par requête : le layout et la page partagent ces deux fonctions.
export const contexteQg = cache(() => exigerContexte())

export const donneesQg = cache(async (modeTerrain: boolean): Promise<DonneesQg> => {
  const { contexte } = await contexteQg()
  return chargerQg(contexte, modeTerrain)
})
