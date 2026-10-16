import { redirect } from "next/navigation"

import { deconnexionAction } from "@/core/auth/actions"
import { libelleRole } from "@/core/auth/libelles"
import { lireSession } from "@/core/auth/session-serveur"
import { teamCourante } from "@/core/auth/team-serveur"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

// Page provisoire : l'enveloppe du QG arrive à la tâche 1.9.
export default async function PageQg() {
  const courante = await teamCourante()
  if (!courante) {
    redirect((await lireSession()) ? "/equipes" : "/connexion")
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle className="text-2xl">{courante.team.nom}</CardTitle>
          <CardDescription>{libelleRole(courante.membership.role)}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={deconnexionAction}>
            <Button type="submit" variant="outline">
              Se déconnecter
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
