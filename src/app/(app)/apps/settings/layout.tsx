import type { ReactNode } from "react"
import Link from "next/link"

import { contexteQg } from "@/core/qg/donnees"
import { niveauDe } from "@/core/actions/actions-serveur"
import { aAuMoins } from "@/core/droits/niveaux"

import { RUBRIQUES_EQUIPE, RUBRIQUES_PERSONNELLES } from "@/apps/settings/rubriques"

// Coquille de Réglages : rubriques à gauche, contenu à droite. Sur téléphone, la liste
// s'affiche d'abord. Les rubriques personnelles sont ouvertes à tout membre ; les rubriques
// de la team n'apparaissent que pour qui a au moins la lecture sur Réglages.
export default async function LayoutReglages({ children }: { children: ReactNode }) {
  const { contexte } = await contexteQg()
  const voitRubriquesEquipe = aAuMoins(await niveauDe(contexte, "settings"), "lecture")

  return (
    <div className="flex flex-col gap-6">
      <h1 className="titre-rallye text-3xl">Réglages</h1>
      <div className="flex flex-col gap-6 md:flex-row">
        <nav aria-label="Rubriques de Réglages" className="flex shrink-0 flex-col gap-1 md:w-64">
          {voitRubriquesEquipe && (
            <>
              <p className="px-3 text-sm font-semibold uppercase tracking-wide text-texte-discret">Team</p>
              {RUBRIQUES_EQUIPE.map((r) => (
                <Link key={r.chemin} href={`/apps/settings/${r.chemin}`} className="cible-tactile rounded-md px-3 py-2 hover:bg-surface-2">
                  {r.libelle}
                </Link>
              ))}
            </>
          )}
          <p className="mt-4 px-3 text-sm font-semibold uppercase tracking-wide text-texte-discret">Toi</p>
          {RUBRIQUES_PERSONNELLES.map((r) => (
            <Link key={r.chemin} href={`/apps/settings/${r.chemin}`} className="cible-tactile rounded-md px-3 py-2 hover:bg-surface-2">
              {r.libelle}
            </Link>
          ))}
        </nav>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
