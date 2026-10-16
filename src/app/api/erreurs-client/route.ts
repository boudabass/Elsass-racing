import { NextResponse } from "next/server"
import { z } from "zod"

import { lireSession } from "@/core/auth/session-serveur"
import { LIMITE_MESSAGE, LIMITE_PILE } from "@/core/erreurs/client"
import { LimiteTentatives } from "@/lib/limite-tentatives-serveur"

// Réception des erreurs côté client : une ligne dans les logs du serveur (visible dans Coolify).
// Réservée aux sessions valides ; 20 envois par minute et par appareil. Aucune donnée de team.
export const dynamic = "force-dynamic"

const limite = new LimiteTentatives(20, 60_000)

const schemaErreur = z.object({
  message: z.string().max(LIMITE_MESSAGE),
  pile: z.string().max(LIMITE_PILE),
  page: z.string().max(300),
  version: z.string().max(100),
  navigateur: z.string().max(300),
  enLigne: z.boolean(),
  date: z.string().max(40),
})

export async function POST(requete: Request) {
  const session = await lireSession()
  if (!session) return NextResponse.json({ erreur: "Tu n'es pas connecté." }, { status: 401 })

  if (!limite.tenter(session.deviceId)) {
    return NextResponse.json({ erreur: "Trop d'erreurs envoyées. Réessaie dans une minute." }, { status: 429 })
  }

  const corps = schemaErreur.safeParse(await requete.json().catch(() => null))
  if (!corps.success) return NextResponse.json({ erreur: "Requête invalide." }, { status: 400 })

  console.error(`[erreur client] ${JSON.stringify(corps.data)}`)
  return new NextResponse(null, { status: 204 })
}
