import { prismaPourTeam } from "@/lib/prisma"
import type { ContexteTeam } from "@/core/contexte"

// Lectures de Réglages, toutes dans le contexte de team (RLS).

export async function lireEquipe(ctx: ContexteTeam) {
  return prismaPourTeam(ctx.teamId, ctx.userId).coreTeam.findUniqueOrThrow({
    where: { id: ctx.teamId },
    select: {
      nom: true,
      couleurPrincipale: true,
      couleurSecondaire: true,
      logoFileId: true,
      disciplinePrincipale: true,
      fuseau: true,
      langue: true,
      associationNom: true,
      associationRna: true,
      associationSiege: true,
    },
  })
}

export async function listerMembres(ctx: ContexteTeam) {
  const membres = await prismaPourTeam(ctx.teamId, ctx.userId).coreMembership.findMany({
    where: { teamId: ctx.teamId, statut: { not: "parti" } },
    include: { user: { select: { email: true, derniereConnexionAt: true } }, person: { select: { prenom: true, nom: true } } },
    orderBy: { createdAt: "asc" },
  })
  return membres.map((m) => ({
    id: m.id,
    role: m.role,
    statut: m.statut,
    nom: m.person ? `${m.person.prenom} ${m.person.nom}` : m.user.email,
    email: m.user.email,
    derniereConnexion: m.user.derniereConnexionAt,
  }))
}

export async function listerInvitationsEnAttente(ctx: ContexteTeam) {
  const maintenant = new Date()
  const invitations = await prismaPourTeam(ctx.teamId, ctx.userId).coreInvitation.findMany({
    where: { teamId: ctx.teamId, accepteeAt: null, expireAt: { gt: maintenant } },
    include: { person: { select: { prenom: true, nom: true } } },
    orderBy: { createdAt: "asc" },
  })
  return invitations.map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    personne: i.person ? `${i.person.prenom} ${i.person.nom}` : null,
    joursRestants: Math.max(0, Math.ceil((i.expireAt.getTime() - maintenant.getTime()) / (24 * 60 * 60 * 1000))),
  }))
}

// Personnes de la team sans compte lié, proposables pour une invitation.
export async function listerPersonnesLibres(ctx: ContexteTeam) {
  return prismaPourTeam(ctx.teamId, ctx.userId).corePerson.findMany({
    where: { teamId: ctx.teamId, userId: null, membreTeam: true },
    select: { id: true, prenom: true, nom: true },
    orderBy: { nom: "asc" },
  })
}
