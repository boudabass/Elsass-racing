import { redirect } from "next/navigation"

import { lireSession } from "@/core/auth/session-serveur"

export default async function PageAccueil() {
  redirect((await lireSession()) ? "/qg" : "/connexion")
}
