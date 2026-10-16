import { prisma } from "@/lib/prisma"
import { newId } from "@/core/ids"

import { nomDeAppareil } from "./appareil"
import { COOKIE_SESSION, signerSession } from "./session"
import { optionsCookie, type MagasinCookies } from "./session-serveur"
import { choisirTeam, listerTeamsDe } from "./team-serveur"

// Ouvre une session après un jeton consommé : crée l'appareil, pose le cookie de
// session, choisit la team si elle est unique, et renvoie la page d'arrivée.
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

  const teams = await listerTeamsDe(userId)
  if (teams.length === 1) {
    await choisirTeam(teams[0].team.id, magasin, userId)
    return "/qg"
  }
  // Zéro team : la page /equipes affiche l'écran « pas encore de team ». Plusieurs : le choix.
  return "/equipes"
}
