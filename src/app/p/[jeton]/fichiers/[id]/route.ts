// Fichier de la page partenaire (brief 3.7, §4). Le jeton est revalidé à chaque requête, puis le fichier n'est servi
// que s'il fait partie de la page du lien. Lu par le service de fichiers (ouvrirFlux), sans passer par HTTP.
// Mêmes en-têtes que /api/fichiers (CSP sandbox, nosniff), plus Referrer-Policy et Cache-Control no-store.
import { ouvrirFlux } from "@/core/fichiers/fichiers-serveur"
import { trouverLienPublic } from "@/apps/partenaires/lien-public"
import { lireFichierDuLien } from "@/apps/partenaires/page-publique-serveur"

export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Un fichier absent, ou hors de la page, donne le même 404 : rien ne dit s'il existe.
const introuvable = () => new Response("Fichier introuvable.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } })

// Nom encodé pour Content-Disposition (RFC 5987) : les caractères réservés sont aussi encodés.
function encoderNom(nom: string): string {
  return encodeURIComponent(nom).replace(/['()*]/g, (caractere) => `%${caractere.charCodeAt(0).toString(16).toUpperCase()}`)
}

export async function GET(_requete: Request, { params }: { params: Promise<{ jeton: string; id: string }> }) {
  const { jeton, id } = await params
  if (!UUID.test(id)) return introuvable()

  const lien = await trouverLienPublic(jeton)
  if (!lien) return introuvable()

  const fichier = await lireFichierDuLien(lien, id)
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
