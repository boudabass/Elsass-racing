"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { useEffect, useState } from "react"

import type { ProchaineEtape } from "@/core/actions/prochaine-etape"
import { libelleCompteARebours } from "@/core/actions/prochaine-etape"

// Bouton flottant « Prochaine étape », sur tous les écrans du QG.
// Sur téléphone seulement : masqué pendant qu'un champ de formulaire a le focus (il recouvrait la
// liste « Voiture »), réduit à une icône pendant le défilement vers le bas. Il reste joignable.
// Sur ordinateur, rien ne change.
export function BoutonProchaineEtape({ etape, maintenant }: { etape: ProchaineEtape; maintenant: Date }) {
  const [champFocus, setChampFocus] = useState(false)
  const [reduit, setReduit] = useState(false)

  useEffect(() => {
    const entree = (evenement: FocusEvent) => {
      const cible = evenement.target
      setChampFocus(cible instanceof HTMLElement && ["INPUT", "SELECT", "TEXTAREA"].includes(cible.tagName))
    }
    const sortie = () => setChampFocus(false)
    document.addEventListener("focusin", entree)
    document.addEventListener("focusout", sortie)
    return () => {
      document.removeEventListener("focusin", entree)
      document.removeEventListener("focusout", sortie)
    }
  }, [])

  useEffect(() => {
    let dernierY = window.scrollY
    const defiler = () => {
      const y = window.scrollY
      if (y > dernierY + 4) setReduit(true)
      else if (y < dernierY - 4) setReduit(false)
      dernierY = y
    }
    window.addEventListener("scroll", defiler, { passive: true })
    return () => window.removeEventListener("scroll", defiler)
  }, [])

  // Rien d'urgent : pas de bulle. Elle recouvrait le contenu, sur téléphone comme sur ordinateur, pour un message sans action.
  if (etape.genre === "rien") return null

  // Action : la boîte d'actions s'ouvre sur cette action (pas l'app d'origine, qui n'a pas
  // encore d'écran). Compte à rebours : la saison.
  const destination = etape.genre === "action" ? `/qg?boite=${etape.action.id}` : "/apps/saison"
  // Action : son titre et sa raison. Compte à rebours : le décompte, puis le nom de l'épreuve.
  const compteARebours = etape.genre === "compte_a_rebours" ? libelleCompteARebours(etape.epreuve, maintenant) : null
  const titreAffiche = etape.genre === "action" ? etape.libelle : etape.epreuve.nom
  const pourquoi = etape.genre === "action" ? etape.pourquoi : null

  const classeLien = [
    "cible-tactile fixed bottom-24 right-4 z-40 flex max-w-xs flex-col rounded-lg bg-marque px-4 py-3 text-marque-texte shadow-lg hover:opacity-90 md:bottom-6 md:right-6",
    champFocus && "max-md:hidden",
    reduit && "max-md:max-w-none max-md:flex-row max-md:items-center max-md:justify-center max-md:rounded-full max-md:px-0 max-md:py-0 max-md:h-14 max-md:w-14",
  ]
    .filter(Boolean)
    .join(" ")
  const masqueSiReduit = reduit ? "max-md:hidden" : ""

  return (
    <Link href={destination} aria-label={titreAffiche} className={classeLien}>
      {compteARebours && <span className={`chiffre titre-rallye text-lg leading-none ${masqueSiReduit}`}>{compteARebours}</span>}
      <span className={compteARebours ? `mt-1 text-sm ${masqueSiReduit}` : `font-semibold leading-snug ${masqueSiReduit}`}>{titreAffiche}</span>
      {pourquoi && <span className={`mt-1 text-xs opacity-90 ${masqueSiReduit}`}>{pourquoi}</span>}
      {reduit && <ArrowRight aria-hidden className="h-6 w-6 md:hidden" />}
    </Link>
  )
}
