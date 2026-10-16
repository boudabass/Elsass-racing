import { NextResponse, type NextRequest } from "next/server"

import { prisma } from "@/lib/prisma"
import { lireSession } from "@/core/auth/session-serveur"
import { accepterInvitation, trouverInvitation } from "@/core/invitations/invitations-serveur"
import { COOKIE_INVITATION, DUREE_COOKIE_INVITATION_SECONDES } from "@/core/invitations/cookies"

// Lien d'invitation. Sans session : le secret est mémorisé dix minutes, et l'adresse de
// l'invitation est proposée sur la page de connexion. Avec session : acceptation directe.
export async function GET(requete: NextRequest) {
  const secret = requete.nextUrl.searchParams.get("t") ?? ""
  const invitation = await trouverInvitation(secret)
  if (!invitation || invitation.acceptee_at || invitation.expire_at <= new Date()) {
    return new NextResponse(null, { status: 303, headers: { Location: "/connexion?erreur=invitation" } })
  }

  const session = await lireSession()
  if (!session) {
    const reponse = new NextResponse(null, {
      status: 303,
      headers: { Location: `/connexion?email=${encodeURIComponent(invitation.email ?? "")}` },
    })
    reponse.cookies.set(COOKIE_INVITATION, secret, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV !== "development",
      path: "/",
      maxAge: DUREE_COOKIE_INVITATION_SECONDES,
    })
    return reponse
  }

  const compte = await prisma.coreUser.findUnique({ where: { id: session.userId }, select: { id: true, email: true } })
  const resultat = compte ? await accepterInvitation(secret, compte) : { ok: false as const, raison: "invalide" as const }
  const destination = resultat.ok ? "/qg" : `/equipes?erreur=${resultat.raison}`
  const reponse = new NextResponse(null, { status: 303, headers: { Location: destination } })
  reponse.cookies.delete(COOKIE_INVITATION)
  return reponse
}
