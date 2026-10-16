import { redirect } from "next/navigation"

import { deconnexionAction, choisirTeamAction } from "@/core/auth/actions"
import { libelleRole } from "@/core/auth/libelles"
import { lireSession } from "@/core/auth/session-serveur"
import { listerTeamsDe } from "@/core/auth/team-serveur"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function PageEquipes() {
  const session = await lireSession()
  if (!session) redirect("/connexion")

  const teams = await listerTeamsDe(session.userId)

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 py-12">
      {teams.length === 0 ? (
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <CardTitle>Tu n&apos;as pas encore de team</CardTitle>
            <CardDescription>Demande une invitation au responsable de ta team.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={deconnexionAction}>
              <Button type="submit" variant="outline">
                Se déconnecter
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Choisis ta team</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {teams.map(({ team, role }) => (
              <form key={team.id} action={choisirTeamAction}>
                <input type="hidden" name="teamId" value={team.id} />
                <button
                  type="submit"
                  className="flex w-full flex-col items-start rounded-md border border-border px-4 py-3 text-left hover:bg-accent"
                >
                  <span className="font-medium">{team.nom}</span>
                  <span className="text-sm text-muted-foreground">{libelleRole(role)}</span>
                </button>
              </form>
            ))}
            <form action={deconnexionAction} className="pt-2">
              <Button type="submit" variant="ghost" className="w-full">
                Se déconnecter
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </main>
  )
}
