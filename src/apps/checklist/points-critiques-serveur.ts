// Action « point critique » de Check-lists (tâche 5.7a, article 956 §5). Une action non bloquante dans la boîte, pour un
// point critique ouvert dont la liste est à 7 jours ou moins de son échéance. Elle ne se décide pas : son bouton ouvre la
// liste. Levée quand le point est fait ou sans objet, ou retiré. Check-lists n'écrit que ses propres actions (le socle les
// tient). Ce module ne dépend pas de services-serveur.ts (sinon cycle) : la levée générique est ici.
import type { ContexteTeam } from "@/core/contexte"
import type { Niveau } from "@/core/droits/niveaux"
import { emettre } from "@/core/evenements/bus-serveur"
import { prismaPourTeam } from "@/lib/prisma"

import { chargeActionRequise } from "./charges"
import { dateLongue } from "./objets-etat"
import { actionPointCritiqueDue, jourParis } from "./regles"

export function cleActionPointCritique(pointId: string): string {
  return `point_critique:${pointId}`
}

// Lève l'action en attente de cette clé, si elle existe. Sans action en attente, rien n'est émis.
export async function leverActionSiEnAttente(ctx: ContexteTeam, cleUnicite: string): Promise<void> {
  const action = await prismaPourTeam(ctx.teamId, ctx.userId).coreAction.findFirst({
    where: { teamId: ctx.teamId, cleUnicite, statut: "en_attente" },
    select: { id: true },
  })
  if (action) await emettre(ctx, "checklist.action_levee", { cleUnicite })
}

interface ListePourAction {
  id: string
  epreuveId: string
  titre: string
  echeance: Date | null
}

// Propose l'action d'un point critique. Une action déjà en attente n'est pas réémise : la visite du QG ne doit pas
// écrire à chaque ouverture.
export async function proposerActionPointCritique(ctx: ContexteTeam, liste: ListePourAction, point: { id: string; libelle: string }): Promise<void> {
  const cleUnicite = cleActionPointCritique(point.id)
  const existante = await prismaPourTeam(ctx.teamId, ctx.userId).coreAction.findFirst({
    where: { teamId: ctx.teamId, cleUnicite, statut: "en_attente" },
    select: { id: true },
  })
  if (existante) return

  const charge = chargeActionRequise.parse({
    type: "point_critique",
    cleUnicite,
    titre: point.libelle,
    contexte: `${liste.titre} · échéance ${liste.echeance ? dateLongue(liste.echeance) : "non fixée"}`,
    ficheType: "point",
    ficheId: point.id,
    eventId: liste.epreuveId,
    destinataires: { roles: ["responsable"] },
    boutons: [{ cle: "ouvrir", libelle: "Ouvrir la liste", lien: `/apps/checklist/liste/${liste.id}` }],
    priorite: 4,
    niveauRequis: "contribution",
    cleRegroupement: "points_critiques",
  })
  await emettre(ctx, "checklist.action_requise", charge)
}

// Rattrapage à l'ouverture du QG : le seul passage du temps peut rapprocher l'échéance d'une liste, sans aucun changement
// de point. Ne regarde que les listes à échéance proche ou passée (même règle que l'émission).
export async function recalculerPourQg(ctx: ContexteTeam, niveau: Niveau): Promise<void> {
  if (niveau === "aucun") return
  const aujourdhui = jourParis(new Date())
  const limite = new Date(Date.parse(aujourdhui) + 8 * 86_400_000)
  const listes = await prismaPourTeam(ctx.teamId, ctx.userId).checklistList.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, echeance: { not: null, lte: limite } },
    select: {
      id: true,
      epreuveId: true,
      titre: true,
      echeance: true,
      sections: {
        where: { deletedAt: null },
        select: { items: { where: { deletedAt: null, critique: true }, select: { id: true, libelle: true, statut: true, critique: true } } },
      },
    },
  })
  for (const liste of listes) {
    if (!liste.echeance) continue
    const echeance = liste.echeance.toISOString().slice(0, 10)
    for (const section of liste.sections) {
      for (const point of section.items) {
        if (actionPointCritiqueDue({ critique: point.critique, statut: point.statut }, echeance, aujourdhui)) {
          await proposerActionPointCritique(ctx, liste, point)
        }
      }
    }
  }
}
