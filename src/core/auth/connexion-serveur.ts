import { cookies } from "next/headers"

import { prisma } from "@/lib/prisma"
import { newId } from "@/core/ids"
import { accepterInvitation } from "@/core/invitations/invitations-serveur"
import { COOKIE_INVITATION } from "@/core/invitations/cookies"

import { nomDeAppareil } from "./appareil"
import { COOKIE_SESSION, signerSession } from "./session"
import { optionsCookie, type MagasinCookies } from "./session-serveur"
import { choisirTeam, listerTeamsDe } from "./team-serveur"

// Ouvre une session après un jeton consommé : crée l'appareil, pose le cookie de
// session, reprend une invitation en attente si elle existe, choisit la team si elle est
// unique, et renvoie la page d'arrivée.
export async function finaliserConnexion(
  userId: string,
  userAgent: string | null,
  magasin: MagasinCookies,
): Promise<string> {
  const appareil = await prisma.coreDevice.create({
    data: {
      id: newId(),
      userId,
      nom: nomDeAppareil(userAgent),
      plateforme: "web",
    },
  })

  magasin.set(COOKIE_SESSION, await signerSession({ userId, deviceId: appareil.id }), optionsCookie())
  await prisma.coreUser.update({ where: { id: userId }, data: { derniereConnexionAt: new Date() } })

  // Invitation mémorisée pendant la connexion : acceptée maintenant, à usage unique.
  const secretInvitation = (await cookies()).get(COOKIE_INVITATION)?.value
  if (secretInvitation) {
    magasin.delete(COOKIE_INVITATION)
    const compte = await prisma.coreUser.findUnique({ where: { id: userId }, select: { id: true, email: true } })
    if (compte) {
      const acceptation = await accepterInvitation(secretInvitation, compte)
      if (acceptation.ok) {
        await choisirTeam(acceptation.teamId, magasin, userId)
        return "/qg"
      }
    }
  }

  const teams = await listerTeamsDe(userId)
  if (teams.length === 1) {
    await choisirTeam(teams[0].team.id, magasin, userId)
    return "/qg"
  }
  // Zéro team : la page /equipes affiche l'écran « pas encore de team ». Plusieurs : le choix.
  return "/equipes"
}
