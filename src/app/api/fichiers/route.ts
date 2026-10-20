import { NextResponse } from "next/server"

import { APPS } from "@/core/catalogue"
import { ErreurAcces, libelleErreurAcces } from "@/core/droits/erreurs"
import { exigerAcces } from "@/core/droits/garde-serveur"
import { enregistrerFichier } from "@/core/fichiers/fichiers-serveur"
import { TAILLE_MAX } from "@/core/fichiers/regles"
import { ErreurMetier } from "@/core/sdk/actions-serveur"

// Envoi d'un fichier (brief 3.1, section 1.3). Multipart : champs « fichier » et « app ». La garde est
// celle de l'app, au niveau contribution. Hors session ou sans team : 401, jamais une redirection.
export const dynamic = "force-dynamic"

function refusJson(statut: number, message: string) {
  return NextResponse.json({ message }, { status: statut })
}

// Marge pour l'enveloppe multipart (noms de champs, en-têtes des parties) au-dessus de la taille du fichier.
const MARGE_MULTIPART = 1024 * 1024

export async function POST(requete: Request) {
  // Un corps annoncé trop lourd est refusé avant que formData() ne le lise en entier.
  const longueur = requete.headers.get("content-length")
  if (longueur !== null && Number(longueur) > TAILLE_MAX + MARGE_MULTIPART) {
    return refusJson(413, "Fichier trop lourd : 10 Mo au plus.")
  }

  const formulaire = await requete.formData().catch(() => null)
  const app = formulaire?.get("app")
  const fichier = formulaire?.get("fichier")
  if (typeof app !== "string" || !APPS.some((entree) => entree.cle === app)) return refusJson(400, "Application inconnue.")
  if (!(fichier instanceof File)) return refusJson(400, "Aucun fichier reçu.")
  if (fichier.size > TAILLE_MAX) return refusJson(400, "Fichier trop lourd : 10 Mo au plus.")

  try {
    const { session, team, membership } = await exigerAcces(app, "contribution")
    const enregistre = await enregistrerFichier(
      { teamId: team.id, userId: session.userId, membership: { id: membership.id, role: membership.role } },
      { octets: new Uint8Array(await fichier.arrayBuffer()), nomOrigine: fichier.name },
    )
    return NextResponse.json(enregistre, { status: 201 })
  } catch (erreur) {
    if (erreur instanceof ErreurAcces) {
      const sansSession = erreur.raison === "non_connecte" || erreur.raison === "aucune_team"
      return refusJson(sansSession ? 401 : 403, libelleErreurAcces(erreur))
    }
    if (erreur instanceof ErreurMetier) return refusJson(400, erreur.message)
    throw erreur
  }
}
