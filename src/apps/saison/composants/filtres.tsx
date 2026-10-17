"use client"

import { useState } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

// Filtres du calendrier : appliqués dès qu'on change une liste, sans bouton. Le choix reste dans
// l'URL (lien partageable, retour arrière). Les autres paramètres (vue, mois) sont conservés.
// Sur PC, ils sont en ligne. Sous md, un bouton « Filtres » ouvre le même formulaire dans un tiroir du bas
// (même composant que Budget), et les filtres actifs s'affichent en pastilles retirables.
export function FiltresCalendrier({
  saisons,
  saisonId,
  type,
  statut,
  types,
  statuts,
}: {
  saisons: Array<{ id: string; annee: number }>
  saisonId: string | null
  type: string
  statut: string
  types: Record<string, string>
  statuts: Record<string, string>
}) {
  const router = useRouter()
  const chemin = usePathname()
  const parametres = useSearchParams()
  const [tiroirOuvert, setTiroirOuvert] = useState(false)

  function changer(cle: string, valeur: string) {
    const suivant = new URLSearchParams(parametres.toString())
    if (valeur === "") suivant.delete(cle)
    else suivant.set(cle, valeur)
    // Changer la saison ne doit pas garder le mois affiché d'une autre saison.
    if (cle === "saison") suivant.delete("mois")
    router.push(`${chemin}?${suivant.toString()}`)
  }

  const champ = "min-h-11 rounded-md border border-bordure bg-surface px-2"
  const pastilles = [
    ...(type ? [{ cle: "type", libelle: types[type] ?? type }] : []),
    ...(statut ? [{ cle: "statut", libelle: statuts[statut] ?? statut }] : []),
  ]
  const nombreActifs = pastilles.length

  const controles = (
    <>
      <label className="flex flex-col gap-1">
        Saison
        <select name="saison" className={champ} value={saisonId ?? ""} onChange={(evenement) => changer("saison", evenement.target.value)}>
          {saisons.map((saison) => (
            <option key={saison.id} value={saison.id}>
              {saison.annee}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Type
        <select name="type" className={champ} value={type} onChange={(evenement) => changer("type", evenement.target.value)}>
          <option value="">Tous</option>
          {Object.entries(types).map(([valeur, libelle]) => (
            <option key={valeur} value={valeur}>
              {libelle}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Statut
        <select name="statut" className={champ} value={statut} onChange={(evenement) => changer("statut", evenement.target.value)}>
          <option value="">Tous</option>
          {Object.entries(statuts).map(([valeur, libelle]) => (
            <option key={valeur} value={valeur}>
              {libelle}
            </option>
          ))}
        </select>
      </label>
    </>
  )

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
      <div className="hidden flex-wrap items-end gap-3 md:flex">{controles}</div>

      <div className="md:hidden">
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
            <form className="mt-3 grid gap-3 pb-6" aria-label="Filtres du calendrier" onSubmit={(evenement) => evenement.preventDefault()}>
              {controles}
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {nombreActifs > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Filtres actifs">
          {pastilles.map((pastille) => (
            <li key={pastille.cle}>
              <button
                type="button"
                onClick={() => changer(pastille.cle, "")}
                className="inline-flex min-h-9 items-center gap-2 rounded-full border border-bordure bg-surface px-3 py-1 text-sm"
              >
                {pastille.libelle}
                <span aria-hidden>×</span>
                <span className="sr-only">Retirer ce filtre</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
