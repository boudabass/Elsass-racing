import type { ReactNode } from "react"
import Link from "next/link"
import { House, Search } from "lucide-react"

import { deconnexionAction } from "@/core/auth/actions"
import { basculerTerrainAction } from "@/core/actions/formulaires"

import { IndicateurSynchro } from "./indicateur-synchro"
import { Logo } from "./logo"

const formatEuro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })
function formaterSolde(centimes: number): string {
  return formatEuro.format(centimes / 100)
}

// La couleur n'est qu'un renfort : la phrase du solde dit déjà qui doit quoi.
function couleurSolde(centimes: number): string {
  return centimes < 0 ? "text-etat-rouge" : "text-etat-ok"
}

function libelleSolde(solde: { libelle: string; montantCentimes: number; texte?: string }): string {
  return solde.texte ?? `${solde.libelle} : ${formaterSolde(solde.montantCentimes)}`
}

export interface BarreHauteDonnees {
  nomTeam: string
  saison: string | null
  prochaine: { nom: string; compteARebours: string } | null
  nombreActions: number
  modeTerrain: boolean
  // Solde de Budget (saison en cours, ou « Mon solde » en contribution) ; null si rien à montrer.
  // texte : phrase en clair (solde d'un membre) ; sans elle, le libellé et le montant.
  solde: { libelle: string; montantCentimes: number; texte?: string } | null
  // Le compte appartient à plusieurs teams : le menu propose d'en changer.
  plusieursTeams: boolean
}

// Barre haute : identité de la team, saison, prochaine épreuve, boîte d'actions, recherche,
// mode terrain et menu. Le solde de Budget : dans la barre à partir de md, en ligne compacte sous elle sur téléphone.
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
          {/* Pas encore de logo téléversé : les initiales sur ordinateur, une icône QG sur téléphone. */}
          <span aria-hidden className="titre-rallye flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-marque text-white sm:hidden">
            <House className="h-5 w-5" aria-hidden />
          </span>
          <span className="hidden sm:block">
            <Logo nom={donnees.nomTeam} />
          </span>
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="titre-rallye text-lg">{donnees.nomTeam}</span>
            {donnees.saison && <span className="text-xs text-texte-discret">{donnees.saison}</span>}
          </span>
        </Link>

        {donnees.solde && (
          <Link
            href="/apps/budget"
            className="hidden flex-col leading-tight md:flex"
            aria-label={`${donnees.solde.libelle} : ${libelleSolde(donnees.solde)}`}
          >
            {donnees.solde.texte ? (
              <span className={`text-sm font-medium ${couleurSolde(donnees.solde.montantCentimes)}`}>{donnees.solde.texte}</span>
            ) : (
              <>
                <span className="text-xs text-texte-discret">{donnees.solde.libelle}</span>
                <span className={`chiffre text-base font-medium ${couleurSolde(donnees.solde.montantCentimes)}`}>
                  {formaterSolde(donnees.solde.montantCentimes)}
                </span>
              </>
            )}
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
            <span className="chiffre titre-rallye mr-1 whitespace-nowrap text-base text-marque lg:hidden">{donnees.prochaine.compteARebours}</span>
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
              {donnees.plusieursTeams && (
                <Link href="/equipes" className="cible-tactile flex items-center rounded-md px-3 hover:bg-surface-2">
                  Changer de team
                </Link>
              )}
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

      {/* Téléphone : le solde tient en une ligne compacte sous la barre (au-dessus de md, il est dans la barre). */}
      {donnees.solde && (
        <Link
          href="/apps/budget"
          className="flex items-center justify-between gap-2 border-t border-bordure px-4 py-1 text-xs md:hidden"
          aria-label={`${donnees.solde.libelle} : ${libelleSolde(donnees.solde)}`}
        >
          {donnees.solde.texte ? (
            <span className={`font-medium ${couleurSolde(donnees.solde.montantCentimes)}`}>{donnees.solde.texte}</span>
          ) : (
            <>
              <span className="text-texte-discret">{donnees.solde.libelle}</span>
              <span className={`chiffre font-medium ${couleurSolde(donnees.solde.montantCentimes)}`}>
                {formaterSolde(donnees.solde.montantCentimes)}
              </span>
            </>
          )}
        </Link>
      )}
    </header>
  )
}
