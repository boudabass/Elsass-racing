import { notFound } from "next/navigation"
import { Lock, Wrench } from "lucide-react"

import { accesEcran } from "@/apps/garage/ecran"
import { type FiltreStock, StockEcran } from "@/apps/garage/composants/stock"
import { listerFournisseurs, listerVehiculesAtelier, lireStock, lireVehiculeAtelier } from "@/apps/garage/lectures-serveur"
import { aAuMoins } from "@/core/droits/niveaux"
import { EcranVide } from "@/components/qg/ecran-vide"

// Stock du Garage (tâche 4.2, §3) : les pièces de rechange de la voiture choisie, avec son filtre.
export default async function PageStock({ searchParams }: { searchParams: Promise<{ vehicule?: string; filtre?: string }> }) {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }

  const vehicules = await listerVehiculesAtelier()
  if (vehicules.length === 0) {
    return (
      <EcranVide
        icone={Wrench}
        titre="Stock"
        lignes={["Ajoute d'abord ta voiture dans l'app Voiture."]}
        action={{ libelle: "Ouvrir l'app Voiture", href: "/apps/voiture" }}
      />
    )
  }

  const { vehicule, filtre } = await searchParams
  const choisi = vehicules.find((v) => v.id === vehicule) ?? vehicules[0]
  const filtreChoisi: FiltreStock = filtre === "hors" ? "hors" : "stock"
  const pieces = await lireStock(choisi.id)
  if (!pieces) notFound()
  const atelier = await lireVehiculeAtelier(choisi.id)
  if (!atelier) notFound()
  const fournisseurs = aAuMoins(acces.niveau, "ecriture") ? await listerFournisseurs() : undefined

  return (
    <StockEcran
      vehicules={vehicules}
      choisi={choisi}
      filtre={filtreChoisi}
      pieces={pieces}
      organes={atelier.organes.map((o) => ({ componentTypeId: o.componentTypeId, nom: o.nom }))}
      niveau={acces.niveau}
      fournisseurs={fournisseurs}
    />
  )
}
