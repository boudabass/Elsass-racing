"use client"

import Link from "next/link"
import { useState, type ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

import { CHAMP } from "./classes"

// Filtres des mouvements : appliqués dès qu'on change un choix, gardés dans l'URL (partageables).
// Sur PC, ils sont en ligne. Sur téléphone, un bouton « Filtres » ouvre le même formulaire dans un tiroir du
// bas (même composant que le menu +).
export function FiltresMouvements({
  saisons,
  epreuves,
  categories,
  membres,
  valeurs,
  afficherMembres,
  nombreActifs,
  pastilles,
}: {
  saisons: Array<{ id: string; annee: number }>
  epreuves: Array<{ id: string; nom: string }>
  categories: Array<{ id: string; nom: string }>
  membres: Array<{ id: string; nom: string }>
  valeurs: { saison: string; epreuve: string; categorie: string; membre: string }
  afficherMembres: boolean
  nombreActifs: number
  // Pastilles des filtres actifs : sur téléphone, sur la même rangée que le bouton Filtres ; sur ordinateur, sous le formulaire.
  pastilles: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const parametres = useSearchParams()
  const [tiroirOuvert, setTiroirOuvert] = useState(false)

  function changer(cle: string, valeur: string) {
    const suivant = new URLSearchParams(parametres.toString())
    if (valeur) suivant.set(cle, valeur)
    else suivant.delete(cle)
    suivant.delete("m") // un autre filtre ferme la fiche ouverte
    router.replace(`${pathname}${suivant.size > 0 ? `?${suivant.toString()}` : ""}`, { scroll: false })
  }

  const controles = (
    <>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-texte-discret">Saison</span>
        <select name="saison" value={valeurs.saison} onChange={(e) => changer("saison", e.target.value)} className={CHAMP}>
          {saisons.map((saison) => (
            <option key={saison.id} value={saison.id}>
              {saison.annee}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-texte-discret">Épreuve</span>
        <select name="epreuve" value={valeurs.epreuve} onChange={(e) => changer("epreuve", e.target.value)} className={CHAMP}>
          <option value="">Toutes</option>
          {epreuves.map((epreuve) => (
            <option key={epreuve.id} value={epreuve.id}>
              {epreuve.nom}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-texte-discret">Catégorie</span>
        <select name="categorie" value={valeurs.categorie} onChange={(e) => changer("categorie", e.target.value)} className={CHAMP}>
          <option value="">Toutes</option>
          {categories.map((categorie) => (
            <option key={categorie.id} value={categorie.id}>
              {categorie.nom}
            </option>
          ))}
        </select>
      </label>
      {afficherMembres && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-texte-discret">Membre</span>
          <select name="membre" value={valeurs.membre} onChange={(e) => changer("membre", e.target.value)} className={CHAMP}>
            <option value="">Tous</option>
            {membres.map((membre) => (
              <option key={membre.id} value={membre.id}>
                {membre.nom}
              </option>
            ))}
          </select>
        </label>
      )}
    </>
  )

  return (
    <>
      <div className="hidden md:block">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Filtres des mouvements" onSubmit={(evenement) => evenement.preventDefault()}>
          {controles}
        </form>
        {pastilles && <div className="mt-3">{pastilles}</div>}
      </div>

      <div className="flex flex-wrap items-center gap-2 md:hidden">
        <button
          type="button"
          onClick={() => setTiroirOuvert(true)}
          className="cible-tactile flex items-center gap-2 rounded-md border border-bordure bg-surface px-4 py-2 text-sm"
          aria-haspopup="dialog"
        >
          Filtres{nombreActifs > 0 ? ` (${nombreActifs})` : ""}
        </button>
        <Sheet open={tiroirOuvert} onOpenChange={setTiroirOuvert}>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto border-bordure bg-surface text-texte">
            <SheetHeader>
              <SheetTitle className="text-left text-texte-discret">Filtres</SheetTitle>
            </SheetHeader>
            <form className="mt-3 grid gap-3 pb-6" aria-label="Filtres des mouvements" onSubmit={(evenement) => evenement.preventDefault()}>
              {controles}
            </form>
          </SheetContent>
        </Sheet>
        {pastilles}
      </div>
    </>
  )
}

// Pastilles des filtres actifs : chacune mène à l'adresse qui retire ce seul filtre.
export function PastillesFiltres({ pastilles }: { pastilles: Array<{ cle: string; libelle: string; retirer: string }> }) {
  if (pastilles.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Filtres actifs">
      {pastilles.map((pastille) => (
        <li key={pastille.cle}>
          <Link href={pastille.retirer} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-bordure bg-surface px-3 py-1 text-sm">
            {pastille.libelle}
            <span aria-hidden>×</span>
            <span className="sr-only">Retirer ce filtre</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
