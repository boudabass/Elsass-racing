// Lectures de Partenaires partagées avec les autres apps (brief 3.8). Comme celles de Voiture et de Saison : pas de
// garde, l'app appelante contrôle son propre accès. Ces fonctions ne renvoient que les champs utiles à la liaison,
// jamais les fiches d'écriture de Partenaires.

import type { ContexteTeam } from "@/core/contexte"
import { prismaPourTeam } from "@/lib/prisma"

// Emplacements de Voiture que des contreparties logo utilisent encore (non supprimées). Voiture s'en sert pour ne pas
// retirer un emplacement qu'une convention attend. Lecture seule.
export async function lireEmplacementsLiesDans(ctx: ContexteTeam, slotIds: string[]): Promise<Set<string>> {
  if (slotIds.length === 0) return new Set()
  const contreparties = await prismaPourTeam(ctx.teamId, ctx.userId).partenairesBenefit.findMany({
    where: { teamId: ctx.teamId, slotId: { in: slotIds }, deletedAt: null },
    select: { slotId: true },
  })
  return new Set(contreparties.map((c) => c.slotId as string))
}

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

const STATUTS_ACTIFS_PARTAGES = ["signee", "en_cours"] as const

// Partenaires dont la convention est signée ou en cours : la liste de la réservation à la main dans Voiture (brief 3.11,
// §3). Pas de contrôle d'accès ici : Voiture vérifie son propre droit avant d'appeler.
export interface PartenaireReservable {
  id: string
  nom: string
}

export async function lirePartenairesReservablesDans(ctx: ContexteTeam): Promise<PartenaireReservable[]> {
  const conventions = await prismaPourTeam(ctx.teamId, ctx.userId).partenairesAgreement.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, statut: { in: [...STATUTS_ACTIFS_PARTAGES] } },
    select: { partnerId: true, partner: { select: { contact: { select: { nom: true } } } } },
  })
  const uniques = new Map<string, PartenaireReservable>()
  for (const convention of conventions) {
    uniques.set(convention.partnerId, { id: convention.partnerId, nom: convention.partner.contact.nom })
  }
  return Array.from(uniques.values()).sort((a, b) => a.nom.localeCompare(b.nom, "fr"))
}

// La contrepartie logo de ce partenaire sur cet emplacement, dans une convention signée ou en cours : ce qui se
// réserve avec l'emplacement (dates de la convention, logo du partenaire). Null si aucune.
export async function lireReservationConventionDans(
  ctx: ContexteTeam,
  partenaireId: string,
  slotId: string,
): Promise<{ partenaireNom: string; dateDebut: string; dateFin: string; logoFileId: string | null } | null> {
  const benefice = await prismaPourTeam(ctx.teamId, ctx.userId).partenairesBenefit.findFirst({
    where: {
      teamId: ctx.teamId,
      deletedAt: null,
      type: "logo_voiture",
      slotId,
      agreement: { partnerId: partenaireId, deletedAt: null, statut: { in: [...STATUTS_ACTIFS_PARTAGES] } },
    },
    select: {
      agreement: {
        select: {
          dateDebut: true,
          dateFin: true,
          partner: { select: { logoFileId: true, contact: { select: { nom: true } } } },
        },
      },
    },
  })
  if (!benefice) return null
  const convention = benefice.agreement
  return {
    partenaireNom: convention.partner.contact.nom,
    dateDebut: convention.dateDebut.toISOString().slice(0, 10),
    dateFin: convention.dateFin.toISOString().slice(0, 10),
    logoFileId: convention.partner.logoFileId,
  }
}
