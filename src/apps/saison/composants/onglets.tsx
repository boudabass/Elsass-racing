"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"

// Onglets de la fiche épreuve. Sur téléphone, ils défilent horizontalement sans couper l'écran ;
// l'onglet actif est ramené dans la vue à l'affichage (sans effet sur la page elle-même).
export function Onglets({ base, onglets, actif }: { base: string; onglets: ReadonlyArray<{ cle: string; libelle: string }>; actif: string }) {
  const barre = useRef<HTMLElement>(null)

  // Ne défile que la barre elle-même : scrollIntoView faisait aussi bouger la page et rognait le premier onglet.
  useEffect(() => {
    const barreEl = barre.current
    const courant = barreEl?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!barreEl || !courant) return
    const decalage = courant.offsetLeft - (barreEl.clientWidth - courant.offsetWidth) / 2
    barreEl.scrollLeft = Math.max(0, decalage)
  }, [actif])

  return (
    <nav ref={barre} className="-mx-4 flex gap-2 overflow-x-auto border-b border-bordure px-4 [scrollbar-width:thin]" aria-label="Onglets de l'épreuve">
      {onglets.map((tab) => (
        <Link
          key={tab.cle}
          href={`${base}?onglet=${tab.cle}`}
          aria-current={actif === tab.cle ? "page" : undefined}
          className={`min-h-11 shrink-0 whitespace-nowrap px-3 py-2 ${actif === tab.cle ? "border-b-2 border-marque font-medium" : "text-texte-discret"}`}
        >
          {tab.libelle}
        </Link>
      ))}
    </nav>
  )
}
