import { cookies } from "next/headers"

import { donneesQg } from "@/core/qg/donnees"
import { COOKIE_TERRAIN } from "@/core/qg/cookies"
import { GrilleQG, type DonneesTuile } from "@/components/qg/grille-qg"

export default async function PageQg({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const { erreur } = await searchParams
  const terrain = (await cookies()).get(COOKIE_TERRAIN)?.value === "1"
  const donnees = await donneesQg(terrain)

  const tuiles: Record<string, DonneesTuile> = {}
  for (const { manifeste } of donnees.apps) {
    tuiles[manifeste.cle] = {
      actions: donnees.actionsParApp[manifeste.cle] ?? 0,
      alerte: donnees.alerteParApp[manifeste.cle] ?? null,
      alertes: donnees.alertesParApp[manifeste.cle] ?? 0,
      taches: donnees.tachesParApp[manifeste.cle] ?? 0,
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="titre-rallye text-3xl md:text-4xl">Le QG</h1>
        <p className="text-texte-discret">{donnees.team.nom}</p>
      </header>

      {erreur && (
        <p role="alert" className="rounded-lg border border-etat-rouge bg-surface px-4 py-3 text-etat-rouge">
          {erreur}
        </p>
      )}

      {donnees.apps.length === 0 ? (
        <p className="py-12 text-center text-texte-discret">Aucune app n'est activée pour ton accès. Demande-la au responsable de la team.</p>
      ) : (
        <GrilleQG apps={donnees.apps} tuiles={tuiles} />
      )}
    </div>
  )
}
