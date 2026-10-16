import { prisma, prismaPourTeam } from "@/lib/prisma"
import { envoyerMail } from "@/lib/mail-serveur"
import { newId } from "@/core/ids"
import type { ContexteTeam } from "@/core/contexte"
import { genererSecretLien, hacherSecret } from "@/core/auth/jetons"
import { emettre } from "@/core/evenements/bus-serveur"

export const DUREE_INVITATION_JOURS = 7

function urlApp(): string {
  return process.env.APP_URL ?? "http://localhost:3000"
}

function expiration(maintenant: Date): Date {
  return new Date(maintenant.getTime() + DUREE_INVITATION_JOURS * 24 * 60 * 60 * 1000)
}

// Mail d'invitation. Si l'envoi échoue, l'invitation créée est retirée : pas d'invitation
// dont personne n'a le lien.
async function envoyerInvitation(email: string, nomTeam: string, secret: string): Promise<void> {
  await envoyerMail({
    a: email,
    sujet: `Tu es invité dans la team ${nomTeam}`,
    texte:
      `Bonjour,\n\n` +
      `Tu es invité à rejoindre la team ${nomTeam} sur Elsass Racing.\n\n` +
      `Ouvre ce lien pour accepter (valable ${DUREE_INVITATION_JOURS} jours) :\n` +
      `${urlApp()}/invitation?t=${secret}\n\n` +
      `Si tu ne connais pas cette team, ignore ce message.`,
  })
}

export async function creerInvitation(
  ctx: ContexteTeam,
  nomTeam: string,
  donnees: { email: string; role: string; personId: string | null },
): Promise<string> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const maintenant = new Date()
  const secret = genererSecretLien()
  const id = newId()

  await client.coreInvitation.create({
    data: {
      id,
      teamId: ctx.teamId,
      email: donnees.email,
      role: donnees.role as "responsable" | "equipage" | "assistance" | "invite",
      personId: donnees.personId,
      envoyeeParUserId: ctx.userId,
      expireAt: expiration(maintenant),
      hash: hacherSecret(secret),
    },
  })

  try {
    await envoyerInvitation(donnees.email, nomTeam, secret)
  } catch (erreur) {
    console.error("Envoi de l'invitation impossible :", erreur instanceof Error ? erreur.message : "erreur inconnue")
    await client.coreInvitation.delete({ where: { id } })
    throw new Error("Impossible d'envoyer l'invitation pour le moment. Réessaie dans quelques minutes.")
  }

  await emettre(ctx, "settings.membre_invite", { invitationId: id, role: donnees.role })
  return id
}

// Nouveau secret, nouvelle expiration, nouveau mail : l'ancien lien ne marche plus.
export async function renvoyerInvitation(ctx: ContexteTeam, nomTeam: string, invitationId: string): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const invitation = await client.coreInvitation.findFirst({
    where: { id: invitationId, teamId: ctx.teamId, accepteeAt: null },
    select: { email: true },
  })
  if (!invitation?.email) throw new Error("Cette invitation n'existe plus ou a déjà été acceptée.")

  const secret = genererSecretLien()
  const maintenant = new Date()
  await client.coreInvitation.update({
    where: { id: invitationId },
    data: { hash: hacherSecret(secret), expireAt: expiration(maintenant) },
  })
  await envoyerInvitation(invitation.email, nomTeam, secret)
}

export async function annulerInvitation(ctx: ContexteTeam, invitationId: string): Promise<void> {
  await prismaPourTeam(ctx.teamId, ctx.userId).coreInvitation.deleteMany({
    where: { id: invitationId, teamId: ctx.teamId, accepteeAt: null },
  })
}

export type ResultatAcceptation =
  | { ok: true; teamId: string }
  | { ok: false; raison: "invalide" | "expiree" | "autre_adresse" }

interface InvitationActive {
  id: string
  team_id: string
  email: string | null
  role: "responsable" | "equipage" | "assistance" | "invite"
  person_id: string | null
  expire_at: Date
  acceptee_at: Date | null
}

// Lit une invitation à partir du hash de son secret (fonction SECURITY DEFINER, hors team).
export async function trouverInvitation(secret: string): Promise<InvitationActive | null> {
  if (!secret) return null
  const lignes = await prisma.$queryRaw<InvitationActive[]>`
    SELECT * FROM core_invitation_active_par_hash(${hacherSecret(secret)})`
  return lignes[0] ?? null
}

// Accepte une invitation pour le compte connecté. L'adresse du compte doit être celle de
// l'invitation. Crée ou réactive l'adhésion, lie la personne, émet settings.membre_rejoint.
export async function accepterInvitation(
  secret: string,
  compte: { id: string; email: string },
): Promise<ResultatAcceptation> {
  const invitation = await trouverInvitation(secret)
  if (!invitation) return { ok: false, raison: "invalide" }
  if (invitation.acceptee_at) return { ok: false, raison: "invalide" }
  if (invitation.expire_at <= new Date()) return { ok: false, raison: "expiree" }
  if ((invitation.email ?? "").toLowerCase() !== compte.email.toLowerCase()) {
    return { ok: false, raison: "autre_adresse" }
  }

  const client = prismaPourTeam(invitation.team_id, compte.id)
  const existante = await client.coreMembership.findFirst({
    where: { teamId: invitation.team_id, userId: compte.id },
    select: { id: true },
  })
  const adhesion = existante
    ? await client.coreMembership.update({
        where: { id: existante.id },
        data: { role: invitation.role, statut: "actif", personId: invitation.person_id },
        select: { id: true, role: true },
      })
    : await client.coreMembership.create({
        data: {
          id: newId(),
          teamId: invitation.team_id,
          userId: compte.id,
          role: invitation.role,
          statut: "actif",
          personId: invitation.person_id,
        },
        select: { id: true, role: true },
      })

  if (invitation.person_id) {
    await client.corePerson.updateMany({
      where: { id: invitation.person_id, teamId: invitation.team_id, userId: null },
      data: { userId: compte.id },
    })
  }

  await client.coreInvitation.update({
    where: { id: invitation.id },
    data: { accepteeAt: new Date() },
  })

  await emettre(
    { teamId: invitation.team_id, userId: compte.id, membership: { id: adhesion.id, role: adhesion.role } },
    "settings.membre_rejoint",
    { membershipId: adhesion.id },
  )

  return { ok: true, teamId: invitation.team_id }
}
