import { exigerContexte } from "@/core/droits/garde-serveur"
import { ErreurAcces } from "@/core/droits/erreurs"
import { niveauxDe, ouvrirFlux } from "@/core/fichiers/fichiers-serveur"
import { peutLire } from "@/core/fichiers/regles"
import { prismaPourTeam } from "@/lib/prisma"

// Lecture d'un fichier (brief 3.1, section 1.3). Tout refus renvoie 404 : on ne révèle pas qu'un fichier
// existe. Le fichier est lu en flux, et la réponse n'exécute rien (CSP sandbox, nosniff).
export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const introuvable = () => new Response("Fichier introuvable.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } })

// Nom encodé pour Content-Disposition (RFC 5987) : les caractères réservés sont aussi encodés.
function encoderNom(nom: string): string {
  return encodeURIComponent(nom).replace(/['()*]/g, (caractere) => `%${caractere.charCodeAt(0).toString(16).toUpperCase()}`)
}

export async function GET(_requete: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) return introuvable()

  try {
    const { session, team, contexte } = await exigerContexte()
    const client = prismaPourTeam(team.id, session.userId)

    const fichier = await client.coreFile.findFirst({ where: { id, teamId: team.id, deletedAt: null } })
    if (!fichier) return introuvable()

    const rattachements = await client.coreAttachment.findMany({ where: { fileId: id, teamId: team.id, deletedAt: null }, select: { app: true } })
    const applis = Array.from(new Set(rattachements.map((rattachement) => rattachement.app)))
    const niveaux = await niveauxDe(contexte, applis)

    const autorise = peutLire({
      estDansLaTeam: true,
      applis,
      niveaux,
      estLogoTeam: team.logoFileId === id,
      estAuteur: fichier.createdBy === session.userId,
    })
    if (!autorise) return introuvable()

    const flux = await ouvrirFlux(fichier.storageKey, fichier.taille)
    if (!flux) return introuvable()

    return new Response(flux, {
      headers: {
        "Content-Type": fichier.mimeType,
        "Content-Length": String(fichier.taille),
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        "Content-Disposition": `inline; filename*=UTF-8''${encoderNom(fichier.nom)}`,
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch (erreur) {
    if (erreur instanceof ErreurAcces) return introuvable()
    throw erreur
  }
}
