import { NextResponse, type NextRequest } from "next/server"

import { finaliserConnexion } from "@/core/auth/connexion-serveur"
import { consommerLien } from "@/core/auth/jetons-serveur"
import { optionsCookie, type MagasinCookies, type OptionsCookie } from "@/core/auth/session-serveur"

// Route et non page : seul un Route Handler peut poser des cookies puis rediriger.
// Le secret du lien est dans la requête ; il est consommé ici, une seule fois.
export async function GET(requete: NextRequest) {
  const secret = requete.nextUrl.searchParams.get("t") ?? ""
  const resultat = await consommerLien(secret)

  if (!resultat.ok) {
    return new NextResponse(null, { status: 303, headers: { Location: "/connexion?erreur=lien" } })
  }

  // Les cookies sont collectés, puis posés sur la réponse une fois la destination connue.
  const aPoser: Array<{ nom: string; valeur: string; options: OptionsCookie }> = []
  const magasin: MagasinCookies = {
    set(nom, valeur, options) {
      aPoser.push({ nom, valeur, options })
    },
    delete(nom) {
      // Suppression : cookie expiré immédiatement, posé sur la réponse.
      aPoser.push({ nom, valeur: "", options: { ...optionsCookie(), maxAge: 0 } })
    },
  }

  const destination = await finaliserConnexion(
    resultat.userId,
    requete.headers.get("user-agent"),
    magasin,
  )

  const reponse = new NextResponse(null, { status: 303, headers: { Location: destination } })
  for (const { nom, valeur, options } of aPoser) {
    reponse.cookies.set(nom, valeur, options)
  }
  return reponse
}
