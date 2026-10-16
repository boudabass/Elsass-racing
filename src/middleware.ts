import { NextResponse, type NextRequest } from "next/server"

import { COOKIE_SESSION, verifierSession } from "@/core/auth/session"

// Vérifie la signature de la session, sans accès base (le middleware tourne à la
// périphérie). La révocation, elle, est contrôlée par les pages et les actions.

function estPublic(chemin: string): boolean {
  return (
    chemin === "/connexion" ||
    chemin.startsWith("/connexion/") ||
    chemin === "/invitation" ||
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

  const jeton = requete.cookies.get(COOKIE_SESSION)?.value
  if (jeton && (await verifierSession(jeton))) return NextResponse.next()

  // Redirection vers /connexion sur la même origine que la requête (nextUrl).
  const destination = requete.nextUrl.clone()
  destination.pathname = "/connexion"
  destination.search = ""
  return NextResponse.redirect(destination, 307)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
}
