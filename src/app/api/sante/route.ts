import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

// Santé de l'application, pour le health check de Coolify. Publique (middleware). Une seule
// requête sur la base, avec le client applicatif. Aucune information sensible dans la réponse.
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 })
  }
}
