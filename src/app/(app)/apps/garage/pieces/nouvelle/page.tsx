import { notFound } from "next/navigation"
import { Lock, Wrench } from "lucide-react"

import { accesEcran } from "@/apps/garage/ecran"
import { ChoixVehicule } from "@/apps/garage/composants/atelier"
import { FormulairePieceNouvelle } from "@/apps/garage/composants/formulaires-saisie"
import { listerFournisseurs, listerVehiculesAtelier, lireVehiculeAtelier } from "@/apps/garage/lectures-serveur"
import { EcranVide } from "@/components/qg/ecran-vide"

// Ajouter une pièce au stock, depuis le bouton + (tâche 4.2, §4). Écriture seulement : prix et fournisseur compris.
export default async function PagePieceNouvelle({ searchParams }: { searchParams: Promise<{ vehicule?: string }> }) {
  const acces = await accesEcran("ecriture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }

  const vehicules = await listerVehiculesAtelier()
  if (vehicules.length === 0) {
    return (
      <EcranVide
        icone={Wrench}
        titre="Nouvelle pièce"
        lignes={["Ajoute d'abord ta voiture dans l'app Voiture."]}
        action={{ libelle: "Ouvrir l'app Voiture", href: "/apps/voiture" }}
      />
    )
  }

  const { vehicule } = await searchParams
  const choisi = vehicules.find((v) => v.id === vehicule) ?? vehicules[0]
  const atelier = await lireVehiculeAtelier(choisi.id)
  if (!atelier) notFound()
  const fournisseurs = await listerFournisseurs()

  return (
    <section className="flex max-w-xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="titre-rallye text-3xl">Nouvelle pièce</h1>
        {vehicules.length > 1 && <ChoixVehicule vehicules={vehicules} choisi={choisi.id} chemin="/apps/garage/pieces/nouvelle" />}
      </header>
      <FormulairePieceNouvelle
        key={choisi.id}
        vehicleId={choisi.id}
        organes={atelier.organes.map((o) => ({ componentTypeId: o.componentTypeId, nom: o.nom }))}
        fournisseurs={fournisseurs}
      />
    </section>
  )
}
