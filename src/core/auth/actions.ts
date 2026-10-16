"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { lireSession, deconnecter, magasinCookies } from "./session-serveur"
import { choisirTeam } from "./team-serveur"
import { consommerCode, demanderConnexion } from "./jetons-serveur"
import { finaliserConnexion } from "./connexion-serveur"
import type { EtatConnexion } from "./etat-connexion"
import { LIBELLES_DEMANDE_CONNEXION } from "./libelles-connexion"

// Chaque action revérifie la session elle-même : Next expose toutes les actions d'un
// module, y compris depuis une page publique.

async function cleClient(): Promise<string> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "inconnu"
  return ip
}

export async function demanderLienAction(
  _etat: EtatConnexion,
  formData: FormData,
): Promise<EtatConnexion> {
  const email = String(formData.get("email") ?? "")
  const resultat = await demanderConnexion(email, await cleClient())

  if (!resultat.ok) {
    return { etape: "email", erreur: LIBELLES_DEMANDE_CONNEXION[resultat.raison] }
  }
  return { etape: "code", email: email.trim().toLowerCase() }
}

export async function validerCodeAction(
  _etat: EtatConnexion,
  formData: FormData,
): Promise<EtatConnexion> {
  const email = String(formData.get("email") ?? "")
  const code = String(formData.get("code") ?? "")

  const resultat = await consommerCode(email, code)
  if (!resultat.ok) {
    const erreur =
      resultat.raison === "bloque"
        ? "Trop de codes incorrects. Réessaie dans 10 minutes."
        : "Code incorrect ou expiré."
    return { etape: "code", email, erreur }
  }

  const magasin = await magasinCookies()
  const destination = await finaliserConnexion(resultat.userId, (await headers()).get("user-agent"), magasin)
  redirect(destination)
}

export async function choisirTeamAction(formData: FormData): Promise<void> {
  const session = await lireSession()
  if (!session) redirect("/connexion")

  const teamId = String(formData.get("teamId") ?? "")
  const magasin = await magasinCookies()
  const ok = await choisirTeam(teamId, magasin, session.userId)
  redirect(ok ? "/qg" : "/equipes")
}

export async function deconnexionAction(): Promise<void> {
  await deconnecter(await magasinCookies())
  redirect("/connexion")
}
