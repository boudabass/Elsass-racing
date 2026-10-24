import { Lock, Wrench } from "lucide-react"

import { accesEcran } from "@/apps/garage/ecran"
import { ChoixVehicule } from "@/apps/garage/composants/atelier"
import { FormulaireCasse } from "@/apps/garage/composants/casses"
import { listerEpreuvesDeLaVoiture } from "@/apps/garage/lectures-casses-serveur"
import { listerVehiculesAtelier } from "@/apps/garage/lectures-serveur"
import { EcranVide } from "@/components/qg/ecran-vide"

// Ajouter une casse à la main (tâche 4.4, §3) : voiture et date obligatoires, épreuve facultative. Écriture seulement.
export default async function PageCasseNouvelle({ searchParams }: { searchParams: Promise<{ vehicule?: string }> }) {
  const acces = await accesEcran("ecriture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }

  const vehicules = await listerVehiculesAtelier()
  if (vehicules.length === 0) {
    return (
      <EcranVide
        icone={Wrench}
        titre="Nouvelle casse"
        lignes={["Ajoutez d'abord votre voiture dans l'app Voiture."]}
        action={{ libelle: "Ouvrir l'app Voiture", href: "/apps/voiture" }}
      />
    )
  }

  const { vehicule } = await searchParams
  const choisi = vehicules.find((v) => v.id === vehicule) ?? vehicules[0]
  const epreuves = await listerEpreuvesDeLaVoiture(choisi.id)

  return (
    <section className="flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="titre-rallye text-3xl">Nouvelle casse</h1>
        {vehicules.length > 1 && <ChoixVehicule vehicules={vehicules} choisi={choisi.id} chemin="/apps/garage/casses/nouvelle" />}
      </header>
      <FormulaireCasse vehicleId={choisi.id} epreuves={epreuves} />
    </section>
  )
}
