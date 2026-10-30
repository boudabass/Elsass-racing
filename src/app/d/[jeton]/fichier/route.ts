// Fichier de la page de partage (tâche 5.4). Le jeton est revalidé à chaque requête ; seule la version courante est servie.
// Pas de journal ici : l'ouverture de la page est la seule chose comptée. Mêmes en-têtes que la page partenaire.
import { ouvrirFlux } from "@/core/fichiers/fichiers-serveur"
import { trouverLienDocument } from "@/apps/documents/lien-public"
import { lireFichierCourantDuLien } from "@/apps/documents/page-publique-serveur"

export const dynamic = "force-dynamic"

// Un lien qui ne vaut plus, ou un fichier absent : le même 404, rien ne dit lequel.
const introuvable = () => new Response("Fichier introuvable.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } })

// Nom encodé pour Content-Disposition (RFC 5987) : les caractères réservés sont aussi encodés.
function encoderNom(nom: string): string {
  return encodeURIComponent(nom).replace(/['()*]/g, (caractere) => `%${caractere.charCodeAt(0).toString(16).toUpperCase()}`)
}

export async function GET(_requete: Request, { params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params
  const lien = await trouverLienDocument(jeton)
  if (!lien) return introuvable()

  const fichier = await lireFichierCourantDuLien(lien)
  if (!fichier) return introuvable()

  const flux = await ouvrirFlux(fichier.storageKey, fichier.taille)
  if (!flux) return introuvable()

  return new Response(flux, {
    headers: {
      "Content-Type": fichier.mimeType,
      "Content-Length": String(fichier.taille),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "Content-Disposition": `inline; filename*=UTF-8''${encoderNom(fichier.nom)}`,
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "private, no-store",
    },
  })
}
