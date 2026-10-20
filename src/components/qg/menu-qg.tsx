"use client"

import { useState } from "react"
import Link from "next/link"

import { Tiroir } from "@/components/formulaire/tiroir"
import { basculerTerrainAction } from "@/core/actions/formulaires"
import { deconnexionAction } from "@/core/auth/actions"

// Menu de la barre haute : un tiroir de choix (brief 3.13b). Un lien ou un envoi ferme le tiroir.
export function MenuQg({ modeTerrain, plusieursTeams }: { modeTerrain: boolean; plusieursTeams: boolean }) {
  const [ouvert, setOuvert] = useState(false)
  const fermer = () => setOuvert(false)
  const lien = "cible-tactile flex items-center rounded-md px-3 hover:bg-surface-2"

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOuvert(true)}
        className="cible-tactile flex items-center rounded-md px-2 text-sm text-texte-discret hover:bg-surface-2 hover:text-texte"
      >
        Menu
      </button>
      <Tiroir ouvert={ouvert} onOuvertChange={setOuvert} titre="Menu" libelleAnnuler="Fermer">
        <nav aria-label="Menu de la team" className="flex flex-col gap-1">
          <Link href="/qg" onClick={fermer} className={lien}>
            Accueil du QG
          </Link>
          <Link href="/recherche" onClick={fermer} className={`${lien} md:hidden`}>
            Rechercher
          </Link>
          <Link href="/notes" onClick={fermer} className={lien}>
            Notes de la team
          </Link>
          {plusieursTeams && (
            <Link href="/equipes" onClick={fermer} className={lien}>
              Changer de team
            </Link>
          )}
        </nav>
        <form action={basculerTerrainAction} onSubmit={fermer} className="md:hidden">
          <input type="hidden" name="actif" value={modeTerrain ? "0" : "1"} />
          <button type="submit" className={`${lien} w-full text-left`}>
            {modeTerrain ? "Quitter le mode terrain" : "Passer en mode terrain"}
          </button>
        </form>
        <form action={deconnexionAction}>
          <button type="submit" className={`${lien} w-full text-left text-texte-discret hover:text-texte`}>
            Se déconnecter
          </button>
        </form>
      </Tiroir>
    </>
  )
}
