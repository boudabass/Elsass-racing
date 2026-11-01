"use client"

// Tiroir de la fiche d'un point (tâche 5.6, §1.3). Ouvert quand l'adresse porte « ?point= » ; fermer revient à la liste
// sans ce paramètre. Le contenu est rendu par le serveur (ContenuFichePoint) et passé en enfant.
import { useRouter } from "next/navigation"
import type { ReactNode } from "react"

import { Tiroir } from "@/components/formulaire/tiroir"

export function FichePointTiroir({ titre, sousTitre, retour, children }: { titre: string; sousTitre: string; retour: string; children: ReactNode }) {
  const router = useRouter()
  return (
    <Tiroir
      ouvert
      onOuvertChange={(ouvert) => {
        if (!ouvert) router.push(retour)
      }}
      titre={titre}
      sousTitre={sousTitre}
      libelleAnnuler="Fermer"
    >
      {children}
    </Tiroir>
  )
}
