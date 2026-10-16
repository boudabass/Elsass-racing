"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Search } from "lucide-react"

import { BoutonPlus, type EntreePlus } from "./bouton-plus"
import { iconeApp, House } from "./icones"

export interface AppNavigation {
  cle: string
  nom: string
  icone: string
}

// PC : colonne d'icônes à gauche, bouton + en haut. Téléphone : barre basse à quatre
// emplacements fixes (QG, boîte d'actions, +, recherche).
export function Navigation({
  apps,
  entreesPlus,
  boiteMobile,
}: {
  apps: AppNavigation[]
  entreesPlus: EntreePlus[]
  boiteMobile: ReactNode
}) {
  const chemin = usePathname()
  const actif = (href: string) => chemin === href || chemin.startsWith(`${href}/`)

  return (
    <>
      <nav aria-label="Apps" className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-20 shrink-0 flex-col items-center gap-3 border-r border-bordure py-4 md:flex">
        <BoutonPlus entrees={entreesPlus} className="h-12 w-12" />
        <div className="my-1 h-px w-10 bg-bordure" />
        {apps.map((app) => {
          const Icone = iconeApp(app.icone)
          const href = `/apps/${app.cle}`
          return (
            <Link
              key={app.cle}
              href={href}
              title={app.nom}
              aria-current={actif(href) ? "page" : undefined}
              className={`cible-tactile flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-md text-xs transition-colors duration-150 ${
                actif(href) ? "bg-marque text-white" : "text-texte-discret hover:bg-surface-2 hover:text-texte"
              }`}
            >
              <Icone className="h-5 w-5" aria-hidden />
              <span className="sr-only">{app.nom}</span>
            </Link>
          )
        })}
      </nav>

      <nav
        aria-label="Navigation rapide"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-bordure bg-surface md:hidden"
      >
        <Link href="/qg" className="cible-tactile flex flex-col items-center justify-center gap-1 py-2 text-xs" aria-current={chemin === "/qg" ? "page" : undefined}>
          <House className="h-5 w-5" aria-hidden />
          QG
        </Link>
        <div className="flex flex-col items-center justify-center gap-1 py-2 text-xs">{boiteMobile}</div>
        <div className="flex flex-col items-center justify-center gap-1 py-2 text-xs">
          <BoutonPlus entrees={entreesPlus} />
          Ajouter
        </div>
        <Link href="/recherche" className="cible-tactile flex flex-col items-center justify-center gap-1 py-2 text-xs" aria-current={chemin === "/recherche" ? "page" : undefined}>
          <Search className="h-5 w-5" aria-hidden />
          Recherche
        </Link>
      </nav>
    </>
  )
}
