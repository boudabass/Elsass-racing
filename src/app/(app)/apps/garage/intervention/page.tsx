import { Lock, Wrench } from "lucide-react"

import { accesEcran } from "@/apps/garage/ecran"
import { ChoixVehicule, VoitureNonSuivie } from "@/apps/garage/composants/atelier"
import { FormulaireIntervention } from "@/apps/garage/composants/formulaires-intervention"
import { listerVehiculesAtelier, lireChoixIntervention } from "@/apps/garage/lectures-serveur"
import { EcranVide } from "@/components/qg/ecran-vide"

// Intervention rapide, depuis le bouton + (tâche 4.3, brief §4). Responsable, équipage et assistance.
export default async function PageIntervention({ searchParams }: { searchParams: Promise<{ vehicule?: string }> }) {
  const acces = await accesEcran("contribution")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }

  const vehicules = await listerVehiculesAtelier()
  if (vehicules.length === 0) {
    return (
      <EcranVide
        icone={Wrench}
        titre="Intervention"
        lignes={["Ajoutez d'abord votre voiture dans l'app Voiture."]}
        action={{ libelle: "Ouvrir l'app Voiture", href: "/apps/voiture" }}
      />
    )
  }

  const { vehicule } = await searchParams
  const choisi = vehicules.find((v) => v.id === vehicule) ?? vehicules[0]
  const choix = await lireChoixIntervention(choisi.id)

  return (
    <section className="flex max-w-xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="titre-rallye text-3xl">Intervention</h1>
        {vehicules.length > 1 && <ChoixVehicule vehicules={vehicules} choisi={choisi.id} chemin="/apps/garage/intervention" />}
      </header>
      {choix.organes.length === 0 ? (
        <VoitureNonSuivie vehicleId={choisi.id} />
      ) : (
        <FormulaireIntervention
          key={choisi.id}
          vehicleId={choisi.id}
          organes={choix.organes}
          organesOccupes={choix.organesOccupes}
          pieces={choix.pieces}
        />
      )}
    </section>
  )
}
