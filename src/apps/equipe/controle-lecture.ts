// Contrôle de lecture des documents des dossiers personnels d'Équipe (tâche 5.8, §3.1) : pièce de licence, justificatif de
// spécialité, document d'équipement. Même règle que la fiche : la personne elle-même, ou le niveau écriture et plus.
import type { ContexteTeam } from "@/core/contexte"
import { niveauDe } from "@/core/actions/actions-serveur"
import type { ControleLecture } from "@/core/fichiers/controles-lecture"
import { prismaPourTeam } from "@/lib/prisma"

import { voitDocumentsDuDossier } from "./regles"
import { personneDuMembre } from "./services-serveur"

// Personne à qui appartient la ligne (licence, équipement ou spécialité), ou null si elle n'existe pas dans la team.
async function personneDeLaFiche(ctx: ContexteTeam, ficheType: string, ficheId: string): Promise<string | null> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const ou = { where: { id: ficheId, teamId: ctx.teamId, deletedAt: null }, select: { personId: true } }
  if (ficheType === "licence") return (await client.equipeLicence.findFirst(ou))?.personId ?? null
  if (ficheType === "gear") return (await client.equipeGear.findFirst(ou))?.personId ?? null
  return (await client.equipeSkill.findFirst(ou))?.personId ?? null
}

function controleDossier(ficheType: string): ControleLecture {
  return {
    app: "equipe",
    ficheType,
    async peutLire(ctx, ficheId) {
      const personneId = await personneDeLaFiche(ctx, ficheType, ficheId)
      if (personneId === null) return false
      const niveau = await niveauDe(ctx, "equipe")
      return voitDocumentsDuDossier({ estSoi: (await personneDuMembre(ctx)) === personneId, niveau })
    },
  }
}

export const controlesLectureEquipe: ControleLecture[] = ["licence", "gear", "skill"].map(controleDossier)
