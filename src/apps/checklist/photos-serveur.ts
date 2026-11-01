// Photos d'un point de Check-lists (tâche 5.6, §1.3) : le service commun des notes et photos (5.0, src/core/notes) avec les
// droits du point. Voir : le point appartient à une liste visible pour le rôle. Ajouter et retirer : le même droit que
// annoter un point (services-serveur.ts, exigerDroitPoint). Les photos ne sortent pas dans « Tous les fichiers » : le
// type point n'est pas déclaré dans le registre d'origines (src/core/fichiers/origines.ts), donc il n'est pas affiché.

import { niveauDe } from "@/core/actions/actions-serveur"
import type { ContexteTeam } from "@/core/contexte"
import { aAuMoins } from "@/core/droits/niveaux"
import type { ControleFiche } from "@/core/notes/notes-serveur"
import { ErreurMetier } from "@/core/sdk/actions-serveur"
import { prismaPourTeam } from "@/lib/prisma"

import { exigerDroitPoint, exigerListeVisible, pointAvecListe } from "./services-serveur"

// Le point et sa liste, si le rôle les voit. Refus métier sinon (point supprimé, liste non ouverte à l'assistance).
async function pointVisible(ctx: ContexteTeam, pointId: string) {
  const point = await pointAvecListe(prismaPourTeam(ctx.teamId, ctx.userId), ctx.teamId, pointId)
  exigerListeVisible(ctx.membership.role, point.section.liste)
  return { point, liste: point.section.liste }
}

// Contrôle de la fiche « point » pour le service commun. Ce qu'il lève (ErreurMetier) est dit en français à l'écran.
export function controlePoint(pointId: string): ControleFiche {
  return {
    app: "checklist",
    ficheType: "point",
    ficheId: pointId,

    async voir(ctx: ContexteTeam) {
      const niveau = await niveauDe(ctx, "checklist")
      if (!aAuMoins(niveau, "lecture")) throw new ErreurMetier("Tu n'as pas accès à Check-lists.")
      await pointVisible(ctx, pointId)
    },

    async contribuer(ctx: ContexteTeam) {
      const niveau = await niveauDe(ctx, "checklist")
      const { point, liste } = await pointVisible(ctx, pointId)
      exigerDroitPoint(ctx, niveau, "annoter", liste, point)
    },

    async gerer(ctx: ContexteTeam) {
      return (await niveauDe(ctx, "checklist")) === "gestion"
    },
  }
}
