"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { BOUTON, BOUTON_SECONDAIRE } from "@/lib/classes-formulaire"

export interface LigneReglage {
  id: string
  dateLibelle: string
  epreuve: string | null
  conditions: string | null
  revetement: string | null
  note: string | null
  auteur: string
}

// Liste des fiches de réglage, avec deux cases à cocher : le bouton « Comparer » n'est actif qu'avec exactement
// deux fiches cochées. Une troisième case reste désactivée tant que deux sont cochées.
export function ListeReglages({ base, lignes }: { base: string; lignes: LigneReglage[] }) {
  const router = useRouter()
  const [cochees, setCochees] = useState<string[]>([])

  function basculer(id: string) {
    setCochees((actuelles) => (actuelles.includes(id) ? actuelles.filter((x) => x !== id) : [...actuelles, id].slice(-2)))
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-bordure">
        {lignes.map((ligne) => {
          const coche = cochees.includes(ligne.id)
          const bloquee = !coche && cochees.length === 2
          const precisions = [ligne.conditions, ligne.revetement, ligne.note].filter(Boolean).join(" · ")
          return (
            <li key={ligne.id} className="flex items-start gap-3 py-3">
              <input
                type="checkbox"
                checked={coche}
                disabled={bloquee}
                onChange={() => basculer(ligne.id)}
                aria-label={`Comparer la fiche du ${ligne.dateLibelle}`}
                className="mt-3 h-5 w-5 shrink-0"
              />
              <Link href={`${base}/reglages/${ligne.id}`} className="cible-tactile flex flex-1 flex-col gap-1">
                <span className="font-medium">
                  {ligne.dateLibelle}
                  {ligne.epreuve ? ` · ${ligne.epreuve}` : ""}
                </span>
                <span className="text-sm text-texte-discret">
                  {precisions ? `${precisions} · ` : ""}
                  {ligne.auteur}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
      <div>
        <button
          type="button"
          disabled={cochees.length !== 2}
          onClick={() => router.push(`${base}/reglages/comparer?a=${cochees[0]}&b=${cochees[1]}`)}
          className={`${cochees.length === 2 ? BOUTON : BOUTON_SECONDAIRE} w-full sm:w-auto`}
        >
          Comparer les deux fiches
        </button>
      </div>
    </div>
  )
}
