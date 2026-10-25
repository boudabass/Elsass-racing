"use client"

// Anciens membres : un bouton qui ouvre un tiroir (rien ne se déplie dans la page, brief 3.13). Leur fiche reste ouverte
// par le lien : ils ne sont jamais effacés, et leur historique se lit.

import Link from "next/link"
import { useState } from "react"

import { Tiroir } from "@/components/formulaire/tiroir"
import { BOUTON_SECONDAIRE } from "@/lib/classes-formulaire"

import type { MembrePersonne } from "../lectures-serveur"

export function AnciensMembres({ anciens }: { anciens: MembrePersonne[] }) {
  const [ouvert, setOuvert] = useState(false)
  return (
    <>
      <button type="button" aria-haspopup="dialog" onClick={() => setOuvert(true)} className={BOUTON_SECONDAIRE}>
        Anciens membres ({anciens.length})
      </button>
      <Tiroir
        ouvert={ouvert}
        onOuvertChange={setOuvert}
        titre="Anciens membres"
        sousTitre="Ils ont quitté la team. Leur historique reste consultable."
        libelleAnnuler="Fermer"
      >
        <ul className="flex flex-col gap-2">
          {anciens.map((personne) => (
            <li key={personne.personId}>
              <Link href={`/apps/equipe/personnes/${personne.personId}`} className="cible-tactile inline-flex items-center underline underline-offset-4">
                {personne.prenom} {personne.nom}
              </Link>
            </li>
          ))}
        </ul>
      </Tiroir>
    </>
  )
}
