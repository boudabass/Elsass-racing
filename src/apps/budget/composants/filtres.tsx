"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { CHAMP } from "./classes"

// Filtres des mouvements : appliqués dès qu'on change un choix, gardés dans l'URL (partageables).
export function FiltresMouvements({
  saisons,
  epreuves,
  categories,
  membres,
  valeurs,
  afficherMembres,
}: {
  saisons: Array<{ id: string; annee: number }>
  epreuves: Array<{ id: string; nom: string }>
  categories: Array<{ id: string; nom: string }>
  membres: Array<{ id: string; nom: string }>
  valeurs: { saison: string; epreuve: string; categorie: string; membre: string }
  afficherMembres: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const parametres = useSearchParams()

  function changer(cle: string, valeur: string) {
    const suivant = new URLSearchParams(parametres.toString())
    if (valeur) suivant.set(cle, valeur)
    else suivant.delete(cle)
    suivant.delete("m") // un autre filtre ferme la fiche ouverte
    router.replace(`${pathname}${suivant.size > 0 ? `?${suivant.toString()}` : ""}`, { scroll: false })
  }

  return (
    <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Filtres des mouvements" onSubmit={(evenement) => evenement.preventDefault()}>
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
    </form>
  )
}
