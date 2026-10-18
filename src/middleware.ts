import { NextResponse, type NextRequest } from "next/server"

import { COOKIE_SESSION, verifierSession } from "@/core/auth/session"
import { urlPublique } from "@/lib/url-publique"

// Vérifie la signature de la session, sans accès base (le middleware tourne à la
// périphérie). La révocation, elle, est contrôlée par les pages et les actions.

function estPublic(chemin: string): boolean {
  return (
    chemin === "/connexion" ||
    chemin.startsWith("/connexion/") ||
    chemin === "/invitation" ||
    chemin === "/hors-ligne" ||
    chemin === "/api/sante" ||
    chemin.startsWith("/_next") ||
    chemin.startsWith("/icones/") ||
    chemin === "/manifest.webmanifest" ||
    chemin === "/sw.js" ||
    chemin === "/favicon.ico"
  )
}

export async function middleware(requete: NextRequest) {
  const chemin = requete.nextUrl.pathname
  if (estPublic(chemin)) return NextResponse.next()

  // Routes de synchro : pas de redirection (un client attend du JSON). Chaque route exige la
  // session et la team elle-même, et répond 401 ou 403. (Les fichiers : /api/fichiers est hors du
  // matcher, voir plus bas.)
  if (chemin.startsWith("/api/synchro/") || chemin === "/api/erreurs-client") return NextResponse.next()

  const jeton = requete.cookies.get(COOKIE_SESSION)?.value
  if (jeton && (await verifierSession(jeton))) return NextResponse.next()

  // Redirection vers /connexion, sur le domaine public (pas sur l'origine vue par Next).
  return NextResponse.redirect(urlPublique("/connexion", requete), 307)
}

// /api/fichiers est hors du matcher : Next clone le corps de chaque requête passée au middleware, avec
// une limite de 10 Mo, ce qui tronquerait un envoi de fichier. La route vérifie la session elle-même,
// et répond 401 (envoi) ou 404 (lecture), sans redirection.
export const config = {
  matcher: ["/((?!_next/static|_next/image|api/fichiers).*)"],
}
