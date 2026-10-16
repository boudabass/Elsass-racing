import { NextResponse } from "next/server"

import { verifierSante } from "@/lib/sante"

// Santé de l'application, pour le health check de Coolify. Publique (middleware). Vérifie la
// base, les droits du rôle de l'app et le catalogue. La réponse ne donne qu'une raison courte.
export const dynamic = "force-dynamic"

export async function GET() {
  const resultat = await verifierSante()
  if (resultat.ok) return NextResponse.json({ ok: true })
  return NextResponse.json({ ok: false, raison: resultat.raison }, { status: 503 })
}
