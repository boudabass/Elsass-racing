import { cookies } from "next/headers"

import { prisma } from "@/lib/prisma"

import { COOKIE_SESSION, COOKIE_TEAM, DUREE_SESSION_SECONDES, verifierSession, type ContenuSession } from "./session"

// Magasin de cookies : celui de next/headers (actions, routes) ou celui d'une réponse.
export interface MagasinCookies {
  set(nom: string, valeur: string, options: OptionsCookie): unknown
  delete(nom: string): unknown
}

export interface OptionsCookie {
  httpOnly: boolean
  secure: boolean
  sameSite: "lax"
  path: string
  maxAge: number
}

// Secure partout sauf en développement, où le serveur tourne en http.
export function optionsCookie(): OptionsCookie {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax",
    path: "/",
    maxAge: DUREE_SESSION_SECONDES,
  }
}

export async function magasinCookies(): Promise<MagasinCookies> {
  return (await cookies()) as unknown as MagasinCookies
}

// Session valide : signature correcte ET appareil encore présent en base. Supprimer
// l'appareil (déconnexion, révocation depuis les réglages) coupe la session tout de suite.
export async function lireSession(): Promise<ContenuSession | null> {
  const jeton = (await cookies()).get(COOKIE_SESSION)?.value
  if (!jeton) return null

  const contenu = await verifierSession(jeton)
  if (!contenu) return null

  const appareil = await prisma.coreDevice.findFirst({
    where: { id: contenu.deviceId, userId: contenu.userId },
    select: { id: true },
  })
  return appareil ? contenu : null
}

export async function deconnecter(magasin: MagasinCookies): Promise<void> {
  const session = await lireSession()
  if (session) {
    await prisma.coreDevice.deleteMany({ where: { id: session.deviceId, userId: session.userId } })
  }
  magasin.delete(COOKIE_SESSION)
  magasin.delete(COOKIE_TEAM)
}

export { COOKIE_SESSION, COOKIE_TEAM }
