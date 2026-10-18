// Lectures de Partenaires partagées avec les autres apps (brief 3.8). Comme celles de Voiture et de Saison : pas de
// garde, l'app appelante contrôle son propre accès. Ces fonctions ne renvoient que les champs utiles à la liaison,
// jamais les fiches d'écriture de Partenaires.

import type { ContexteTeam } from "@/core/contexte"
import { prismaPourTeam } from "@/lib/prisma"

// Contrepartie logo d'une convention signée ou en cours, pour Voiture (réserver l'emplacement à la décision).
// Null si la contrepartie n'existe plus, n'a plus d'emplacement, ou si sa convention est close.
export type ContrepartieLogoPourVoiture = {
  slotId: string
  partenaireId: string
  partenaireNom: string
  dateDebut: string
  dateFin: string
  logoFileId: string | null
}

export async function lireContrepartieLogoPourVoiture(ctx: ContexteTeam, benefitId: string): Promise<ContrepartieLogoPourVoiture | null> {
  const contrepartie = await prismaPourTeam(ctx.teamId, ctx.userId).partenairesBenefit.findFirst({
    where: { id: benefitId, teamId: ctx.teamId, deletedAt: null, type: "logo_voiture", slotId: { not: null } },
    select: {
      slotId: true,
      agreement: {
        select: {
          statut: true,
          dateDebut: true,
          dateFin: true,
          partnerId: true,
          partner: { select: { logoFileId: true, contact: { select: { nom: true } } } },
        },
      },
    },
  })
  if (!contrepartie || !["signee", "en_cours"].includes(contrepartie.agreement.statut)) return null
  const convention = contrepartie.agreement
  return {
    slotId: contrepartie.slotId as string,
    partenaireId: convention.partnerId,
    partenaireNom: convention.partner.contact.nom,
    dateDebut: convention.dateDebut.toISOString().slice(0, 10),
    dateFin: convention.dateFin.toISOString().slice(0, 10),
    logoFileId: convention.partner.logoFileId,
  }
}
