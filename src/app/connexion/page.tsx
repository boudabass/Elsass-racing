import { redirect } from "next/navigation"

import { lireSession } from "@/core/auth/session-serveur"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { NettoyageLocal } from "@/components/nettoyage-local"

import { FormulaireConnexion } from "./formulaire-connexion"

export default async function PageConnexion({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; email?: string }>
}) {
  if (await lireSession()) redirect("/qg")

  const { erreur, email } = await searchParams

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <NettoyageLocal />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <h1 className="text-2xl font-semibold leading-none tracking-tight">Connexion</h1>
        </CardHeader>
        <CardContent>
          <FormulaireConnexion erreurInitiale={erreur} emailInitial={email} />
        </CardContent>
      </Card>
    </main>
  )
}
