"use client"

import { useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { styleFondu, useFonduDefilement } from "./fondu-defilement"

export interface MenuDeApp {
  cle: string
  nom: string
  // Entrées déjà filtrées par les droits du membre (entreeVisible, côté serveur).
  entrees: Array<{ libelle: string; chemin: string }>
}

// Menu de l'app courante, rendu par le socle pour toutes les apps. Sur ordinateur : une rangée sous
// le titre. Sur téléphone : une rangée qui défile horizontalement, l'entrée active marquée.
export function MenuApp({ menus }: { menus: MenuDeApp[] }) {
  const chemin = usePathname()
  const app = menus.find((m) => chemin === `/apps/${m.cle}` || chemin.startsWith(`/apps/${m.cle}/`))
  if (!app || app.entrees.length === 0) return null

  return <RangeeMenu nomApp={app.nom} cleApp={app.cle} entrees={app.entrees} chemin={chemin} />
}

function RangeeMenu({ nomApp, cleApp, entrees, chemin }: { nomApp: string; cleApp: string; entrees: MenuDeApp["entrees"]; chemin: string }) {
  const barre = useRef<HTMLElement>(null)
  const fondu = useFonduDefilement(barre)
  const base = `/apps/${cleApp}`
  return (
    <nav ref={barre} style={styleFondu(fondu)} aria-label={`Menu de ${nomApp}`} className="-mx-4 mb-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex w-max gap-2 md:w-auto md:flex-wrap">
        {entrees.map((entree) => {
          const href = entree.chemin === "/" ? base : `${base}${entree.chemin}`
          const actif = entree.chemin === "/" ? chemin === base : chemin === href || chemin.startsWith(`${href}/`)
          return (
            <li key={entree.chemin}>
              <Link
                href={href}
                aria-current={actif ? "page" : undefined}
                className={`cible-tactile flex items-center whitespace-nowrap rounded-md border px-3 text-sm ${
                  actif ? "border-marque bg-marque/10 font-medium text-marque" : "border-bordure text-texte-discret hover:bg-surface-2 hover:text-texte"
                }`}
              >
                {entree.libelle}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
