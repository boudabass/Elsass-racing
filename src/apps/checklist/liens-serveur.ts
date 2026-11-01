// Lien d'un point vers un objet d'une autre app (tâche 5.7a, article 956 §4). Check-lists n'écrit que la ligne du point ;
// l'objet lié n'est jamais modifié. Poser ou retirer un lien ne coche jamais le point : le lien s'affiche, c'est tout.
import type { ContexteTeam } from "@/core/contexte"
import type { Niveau } from "@/core/droits/niveaux"
import { executerPourTeam, prismaPourTeam } from "@/lib/prisma"
import { avecReprisePourConflit } from "@/lib/reprise-conflit"

import { refus } from "./erreurs"
import { APP_DU_TYPE } from "./objets-lies"
import { lireObjetLie, porteeDeListe, typesAccessibles } from "./objets-lies-serveur"
import type { TypeObjetLie } from "./objets-types"
import { accesChecklist, exigerDroitPoint, exigerListeVisible, pointAvecListe } from "./services-serveur"

export interface LienChoisi {
  lienType: TypeObjetLie
  lienId: string
}

// Pose (ou change) le lien du point. Sans lien (null), l'identifiant est vidé ; le type reste, pour un nouveau choix rapide.
// Niveau écriture requis (l'assistance n'a pas le droit de modifier un point, 956 §6).
export async function lierPointDans(ctx: ContexteTeam, niveau: Niveau, pointId: string, lien: LienChoisi | null): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const point = await pointAvecListe(client, ctx.teamId, pointId)
  const liste = point.section.liste
  exigerListeVisible(ctx.membership.role, liste)
  exigerDroitPoint(ctx, niveau, "modifier", liste, point)

  if (lien) {
    const acces = await typesAccessibles(ctx, [lien.lienType])
    if (!acces.has(lien.lienType)) refus(`Tu n'as pas accès à ${APP_DU_TYPE[lien.lienType].libelle} : impossible de lier cet objet.`)
    const portee = await porteeDeListe(ctx, liste.id)
    const objet = await lireObjetLie(ctx, lien.lienType, lien.lienId, portee)
    if (!objet) refus("Cet objet est introuvable, ou il n'est pas dans la portée de cette liste.")
  }

  await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
      tx.checklistItem.update({
        where: { id: pointId },
        data: lien
          ? { lienType: lien.lienType, lienId: lien.lienId, rev: { increment: 1 }, updatedBy: ctx.userId }
          : { lienId: null, rev: { increment: 1 }, updatedBy: ctx.userId },
      }),
    ),
  )
}

export async function lierPoint(pointId: string, lien: LienChoisi | null): Promise<void> {
  const { ctx, niveau } = await accesChecklist("contribution")
  return lierPointDans(ctx, niveau, pointId, lien)
}
