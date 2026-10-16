import type { ReactNode } from "react"
import Link from "next/link"
import { Search } from "lucide-react"

import { deconnexionAction } from "@/core/auth/actions"
import { basculerTerrainAction } from "@/core/actions/formulaires"

import { IndicateurSynchro } from "./indicateur-synchro"
import { Logo } from "./logo"

const formatEuro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })
function formaterSolde(centimes: number): string {
  return formatEuro.format(centimes / 100)
}

export interface BarreHauteDonnees {
  nomTeam: string
  saison: string | null
  prochaine: { nom: string; compteARebours: string } | null
  nombreActions: number
  modeTerrain: boolean
  // Solde de Budget (saison en cours, ou « Mon solde » en contribution) ; null si rien à montrer.
  solde: { libelle: string; montantCentimes: number } | null
}

// Barre haute : identité de la team, saison, prochaine épreuve, boîte d'actions, recherche,
// mode terrain et menu. Le solde de saison viendra avec l'app Budget : emplacement réservé.
export function BarreHaute({
  donnees,
  boite,
}: {
  donnees: BarreHauteDonnees
  boite: ReactNode
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-bordure bg-fond/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:px-6">
        <Link href="/qg" className="cible-tactile flex items-center gap-3" aria-label={`${donnees.nomTeam} : retour au QG`}>
          <Logo nom={donnees.nomTeam} />
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="titre-rallye text-lg">{donnees.nomTeam}</span>
            {donnees.saison && <span className="text-xs text-texte-discret">{donnees.saison}</span>}
          </span>
        </Link>

        {donnees.solde && (
          <Link
            href="/apps/budget"
            className="hidden flex-col leading-tight md:flex"
            aria-label={`${donnees.solde.libelle} : ${formaterSolde(donnees.solde.montantCentimes)}`}
          >
            <span className="text-xs text-texte-discret">{donnees.solde.libelle}</span>
            <span
              className={`chiffre text-base font-medium ${donnees.solde.montantCentimes < 0 ? "text-etat-rouge" : "text-etat-ok"}`}
            >
              {formaterSolde(donnees.solde.montantCentimes)}
            </span>
          </Link>
        )}

        <div className="ml-auto flex items-center gap-2">
          {donnees.prochaine && (
            <div className="mr-2 hidden flex-col items-end leading-tight lg:flex">
              <span className="chiffre titre-rallye text-base text-marque">{donnees.prochaine.compteARebours}</span>
              <span className="max-w-[16rem] truncate text-xs text-texte-discret">{donnees.prochaine.nom}</span>
            </div>
          )}

          {/* Mobile : compte à rebours, sans le nom de l'épreuve. */}
          {donnees.prochaine && (
            <span className="chiffre titre-rallye mr-1 text-base text-marque lg:hidden">{donnees.prochaine.compteARebours}</span>
          )}

          <div className="relative">{boite}</div>

          <IndicateurSynchro />

          <Link
            href="/recherche"
            aria-label="Rechercher"
            className="cible-tactile hidden items-center justify-center rounded-md text-texte-discret hover:bg-surface-2 hover:text-texte md:flex"
          >
            <Search className="h-5 w-5" aria-hidden />
          </Link>

          <form action={basculerTerrainAction} className="hidden md:block">
            <input type="hidden" name="actif" value={donnees.modeTerrain ? "0" : "1"} />
            <button
              type="submit"
              className={`cible-tactile rounded-md border px-3 py-1 text-sm ${
                donnees.modeTerrain ? "border-marque bg-marque text-white" : "border-bordure text-texte-discret hover:bg-surface-2"
              }`}
            >
              {donnees.modeTerrain ? "Terrain : activé" : "Mode terrain"}
            </button>
          </form>

          <details className="relative">
            <summary className="cible-tactile flex cursor-pointer list-none items-center rounded-md px-2 text-sm text-texte-discret hover:bg-surface-2 hover:text-texte">
              Menu
            </summary>
            <div className="absolute right-0 mt-2 flex w-64 flex-col gap-1 rounded-lg border border-bordure bg-surface p-2 shadow-lg">
              <Link href="/qg" className="cible-tactile flex items-center rounded-md px-3 hover:bg-surface-2">
                Accueil du QG
              </Link>
              <Link href="/recherche" className="cible-tactile flex items-center rounded-md px-3 hover:bg-surface-2 md:hidden">
                Rechercher
              </Link>
              <Link href="/notes" className="cible-tactile flex items-center rounded-md px-3 hover:bg-surface-2">
                Notes de la team
              </Link>
              <form action={basculerTerrainAction} className="md:hidden">
                <input type="hidden" name="actif" value={donnees.modeTerrain ? "0" : "1"} />
                <button type="submit" className="cible-tactile flex w-full items-center rounded-md px-3 text-left hover:bg-surface-2">
                  {donnees.modeTerrain ? "Quitter le mode terrain" : "Passer en mode terrain"}
                </button>
              </form>
              <form action={deconnexionAction}>
                <button type="submit" className="cible-tactile flex w-full items-center rounded-md px-3 text-left text-texte-discret hover:bg-surface-2 hover:text-texte">
                  Se déconnecter
                </button>
              </form>
            </div>
          </details>
        </div>
      </div>
    </header>
  )
}
