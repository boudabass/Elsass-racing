import { Lock, Wrench } from "lucide-react"

import { accesEcran } from "@/apps/garage/ecran"
import { ChoixVehicule } from "@/apps/garage/composants/atelier"
import { FormulaireTrain } from "@/apps/garage/composants/pneus"
import { listerFournisseurs, listerVehiculesAtelier } from "@/apps/garage/lectures-serveur"
import { EcranVide } from "@/components/qg/ecran-vide"

// Ajouter un train de pneus (tâche 4.4, §2). Écriture seulement : prix et fournisseur compris.
export default async function PageTrainNouveau({ searchParams }: { searchParams: Promise<{ vehicule?: string }> }) {
  const acces = await accesEcran("ecriture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }

  const vehicules = await listerVehiculesAtelier()
  if (vehicules.length === 0) {
    return (
      <EcranVide
        icone={Wrench}
        titre="Nouveau train"
        lignes={["Ajoute d'abord ta voiture dans l'app Voiture."]}
        action={{ libelle: "Ouvrir l'app Voiture", href: "/apps/voiture" }}
      />
    )
  }

  const { vehicule } = await searchParams
  const choisi = vehicules.find((v) => v.id === vehicule) ?? vehicules[0]
  const fournisseurs = await listerFournisseurs()

  return (
    <section className="flex max-w-xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="titre-rallye text-3xl">Nouveau train</h1>
        {vehicules.length > 1 && <ChoixVehicule vehicules={vehicules} choisi={choisi.id} chemin="/apps/garage/pneus/nouveau" />}
      </header>
      <FormulaireTrain key={choisi.id} vehicleId={choisi.id} fournisseurs={fournisseurs} />
    </section>
  )
}
