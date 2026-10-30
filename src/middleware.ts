import { NextResponse, type NextRequest } from "next/server"

import { COOKIE_SESSION, verifierSession } from "@/core/auth/session"
import { limiteJetonsInvalides, MESSAGE_TROP_DE_TENTATIVES, trouverLienPublic } from "@/apps/partenaires/lien-public"
import { limiteLiensInvalides, trouverLienDocument } from "@/apps/documents/lien-public"
import { ipClient } from "@/lib/ip-client"
import { urlPublique } from "@/lib/url-publique"

// Vérifie la signature de la session, sans accès base (le middleware tourne à la
// périphérie). La révocation, elle, est contrôlée par les pages et les actions.
// Les pages partenaire (/p/…) font exception : elles n'ont pas de session, et le jeton se vérifie ici, en base,
// avant toute page. Ce middleware tourne donc dans le runtime Node (voir config).

// En-têtes des pages partenaire (brief 3.7, point 1). Le jeton est dans l'adresse : il ne part pas vers un autre
// site (Referrer), n'est ni indexé, ni gardé en cache, ni affiché dans un cadre. « unsafe-inline » sur les scripts :
// Next injecte ses scripts d'amorçage en ligne ; aucun script ni style d'un tiers n'est autorisé.
const CSP_PAGE_PUBLIQUE = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "object-src 'none'",
].join("; ")

function enTetesPublics(reponse: NextResponse): NextResponse {
  reponse.headers.set("Referrer-Policy", "no-referrer")
  reponse.headers.set("X-Robots-Tag", "noindex, nofollow")
  reponse.headers.set("Cache-Control", "private, no-store")
  reponse.headers.set("X-Content-Type-Options", "nosniff")
  reponse.headers.set("Content-Security-Policy", CSP_PAGE_PUBLIQUE)
  return reponse
}

// Le jeton est le premier segment après /p/ : /p/<jeton> et /p/<jeton>/fichiers/<id>.
async function traiterPagePublique(requete: NextRequest): Promise<NextResponse> {
  const chemin = requete.nextUrl.pathname
  if (chemin === "/p/introuvable") return enTetesPublics(NextResponse.next())

  const ip = ipClient(requete.headers)
  if (limiteJetonsInvalides.estBloquee(ip)) {
    return enTetesPublics(
      new NextResponse(MESSAGE_TROP_DE_TENTATIVES, {
        status: 429,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "600" },
      }),
    )
  }

  const lien = await trouverLienPublic(chemin.split("/")[2] ?? "")
  if (!lien) {
    // Jeton inventé, révoqué, expiré ou partenaire supprimé : la même page, avec le même 404 (voir app/p/introuvable).
    limiteJetonsInvalides.echec(ip)
    const url = requete.nextUrl.clone()
    url.pathname = "/p/introuvable"
    return enTetesPublics(NextResponse.rewrite(url))
  }
  return enTetesPublics(NextResponse.next())
}

// Pages de partage d'un document (tâche 5.4) : même règle que /p/. Le jeton est le premier segment après /d/ :
// /d/<jeton> et /d/<jeton>/fichier. Un lien qui ne vaut plus part vers la même page 404 (voir app/d/introuvable).
async function traiterPageDocument(requete: NextRequest): Promise<NextResponse> {
  const chemin = requete.nextUrl.pathname
  if (chemin === "/d/introuvable") return enTetesPublics(NextResponse.next())

  const ip = ipClient(requete.headers)
  if (limiteLiensInvalides.estBloquee(ip)) {
    return enTetesPublics(
      new NextResponse("Trop de tentatives. Réessayez dans quelques minutes.", {
        status: 429,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "600" },
      }),
    )
  }

  const lien = await trouverLienDocument(chemin.split("/")[2] ?? "")
  if (!lien) {
    limiteLiensInvalides.echec(ip)
    const url = requete.nextUrl.clone()
    url.pathname = "/d/introuvable"
    return enTetesPublics(NextResponse.rewrite(url))
  }
  return enTetesPublics(NextResponse.next())
}

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
  if (chemin === "/p" || chemin.startsWith("/p/")) return traiterPagePublique(requete)
  if (chemin === "/d" || chemin.startsWith("/d/")) return traiterPageDocument(requete)
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
// Runtime Node : la page partenaire valide son jeton en base (lien-public.ts), ce que le runtime Edge ne fait pas.
export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|api/fichiers).*)"],
}
