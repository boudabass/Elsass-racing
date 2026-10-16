import type { ReactNode } from "react"
import Link from "next/link"

import { ErreurAcces } from "@/core/droits/erreurs"
import { libelleErreurAcces } from "@/core/droits/erreurs"
import { exigerAcces } from "@/core/droits/garde-serveur"
import { EcranVide } from "@/components/qg/ecran-vide"
import { Lock } from "lucide-react"

import { RUBRIQUES_EQUIPE, RUBRIQUES_PERSONNELLES } from "@/apps/settings/rubriques"

// Coquille de Réglages : rubriques de la team à gauche, contenu à droite. Sur téléphone,
// la liste s'affiche d'abord (la rubrique ouverte a son bouton de retour).
export default async function LayoutReglages({ children }: { children: ReactNode }) {
  try {
    await exigerAcces("settings", "lecture")
  } catch (erreur) {
    if (erreur instanceof ErreurAcces) {
      return <EcranVide icone={Lock} titre="Tu n'as pas accès à Réglages" lignes={[libelleErreurAcces(erreur)]} action={{ libelle: "Retour au QG", href: "/qg" }} />
    }
    throw erreur
  }

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <nav aria-label="Rubriques de Réglages" className="flex shrink-0 flex-col gap-1 md:w-64">
        <p className="px-3 text-sm font-semibold uppercase tracking-wide text-texte-discret">Team</p>
        {RUBRIQUES_EQUIPE.map((r) => (
          <Link key={r.chemin} href={`/apps/settings/${r.chemin}`} className="cible-tactile rounded-md px-3 py-2 hover:bg-surface-2">
            {r.libelle}
          </Link>
        ))}
        <p className="mt-4 px-3 text-sm font-semibold uppercase tracking-wide text-texte-discret">Toi</p>
        {RUBRIQUES_PERSONNELLES.map((r) => (
          <span
            key={r.chemin}
            aria-disabled="true"
            title="Disponible en 1.10b"
            className="cible-tactile cursor-not-allowed rounded-md px-3 py-2 text-texte-discret"
          >
            {r.libelle} <span className="text-xs">(en 1.10b)</span>
          </span>
        ))}
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
