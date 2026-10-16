import Link from "next/link"

import type { AppVisible } from "@/core/sdk/apps"
import type { NiveauAlerte } from "@/core/qg/donnees"

import { iconeApp } from "./icones"

export interface DonneesTuile {
  actions: number
  alerte: NiveauAlerte | null
  alertes: number
  taches: number
}

// Une tuile par app visible, dans l'ordre du QG. Clic = /apps/<cle>.
export function GrilleQG({
  apps,
  tuiles,
}: {
  apps: AppVisible[]
  tuiles: Record<string, DonneesTuile>
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {apps.map(({ manifeste }) => {
        const Icone = iconeApp(manifeste.icone)
        const donnees = tuiles[manifeste.cle] ?? { actions: 0, alerte: null, alertes: 0, taches: 0 }
        return (
          <li key={manifeste.cle}>
            <Link
              href={`/apps/${manifeste.cle}`}
              className="cible-tactile group relative flex min-h-[9.5rem] flex-col justify-between rounded-lg border border-bordure bg-surface p-4 transition-colors duration-150 hover:border-marque hover:bg-surface-2"
            >
              <div className="flex items-start justify-between gap-2">
                <Icone className="h-8 w-8 text-marque" aria-hidden />
                <div className="flex items-center gap-2">
                  {donnees.alerte && (
                    <span
                      aria-label={donnees.alerte === "rouge" ? "Alerte urgente" : "Alerte à surveiller"}
                      className={`h-3 w-3 rounded-full ${donnees.alerte === "rouge" ? "bg-etat-rouge" : "bg-etat-orange"}`}
                    />
                  )}
                  {donnees.actions > 0 && (
                    <span className="chiffre rounded-md bg-marque px-2 py-0.5 text-sm font-semibold text-white">
                      {donnees.actions}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <h2 className="titre-rallye text-xl leading-tight">{manifeste.nom}</h2>
                <p className="mt-1 text-sm text-texte-discret">{libelleEtat(donnees)}</p>
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

// Ligne d'état courte : l'action d'abord, puis l'alerte, puis la tâche.
export function libelleEtat(donnees: DonneesTuile): string {
  if (donnees.actions > 0) return `${donnees.actions} ${donnees.actions > 1 ? "actions à traiter" : "action à traiter"}`
  if (donnees.alertes > 0) return `${donnees.alertes} ${donnees.alertes > 1 ? "alertes" : "alerte"}`
  if (donnees.taches > 0) return `${donnees.taches} ${donnees.taches > 1 ? "tâches à faire" : "tâche à faire"}`
  return "Tout est en ordre"
}
