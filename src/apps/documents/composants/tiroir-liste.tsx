"use client"

// Liste repliable de Documents (archivés, historique des versions) : un bouton ouvre un tiroir de lecture. Rien ne se
// déplie dans la page (brief 3.13, tiroirs-interface.test.ts).

import { useState, type ReactNode } from "react"

import { Tiroir } from "@/components/formulaire/tiroir"
import { BOUTON_SECONDAIRE } from "@/lib/classes-formulaire"

export function TiroirListe({ libelle, titre, sousTitre, children }: { libelle: string; titre: string; sousTitre?: string; children: ReactNode }) {
  const [ouvert, setOuvert] = useState(false)
  return (
    <>
      <button type="button" aria-haspopup="dialog" onClick={() => setOuvert(true)} className={BOUTON_SECONDAIRE}>
        {libelle}
      </button>
      <Tiroir ouvert={ouvert} onOuvertChange={setOuvert} titre={titre} sousTitre={sousTitre} libelleAnnuler="Fermer">
        {children}
      </Tiroir>
    </>
  )
}
