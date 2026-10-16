"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"

// Filtres du calendrier : appliqués dès qu'on change une liste, sans bouton. Le choix reste dans
// l'URL (lien partageable, retour arrière). Les autres paramètres (vue, mois) sont conservés.
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

  function changer(cle: string, valeur: string) {
    const suivant = new URLSearchParams(parametres.toString())
    if (valeur === "") suivant.delete(cle)
    else suivant.set(cle, valeur)
    // Changer la saison ne doit pas garder le mois affiché d'une autre saison.
    if (cle === "saison") suivant.delete("mois")
    router.push(`${chemin}?${suivant.toString()}`)
  }

  const champ = "min-h-11 rounded-md border border-bordure bg-surface px-2"

  return (
    <>
      <label className="flex flex-col gap-1">
        Saison
        <select className={champ} value={saisonId ?? ""} onChange={(evenement) => changer("saison", evenement.target.value)}>
          {saisons.map((saison) => (
            <option key={saison.id} value={saison.id}>
              {saison.annee}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Type
        <select className={champ} value={type} onChange={(evenement) => changer("type", evenement.target.value)}>
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
        <select className={champ} value={statut} onChange={(evenement) => changer("statut", evenement.target.value)}>
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
}
