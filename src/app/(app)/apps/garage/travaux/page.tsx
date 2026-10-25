import { notFound } from "next/navigation"
import { Lock, Wrench } from "lucide-react"

import { accesEcran } from "@/apps/garage/ecran"
import { TravauxEcran } from "@/apps/garage/composants/travaux"
import { lireChoixTravaux, listerVehiculesAtelier, lireTravaux } from "@/apps/garage/lectures-serveur"
import { EcranVide } from "@/components/qg/ecran-vide"

// Travaux du Garage (tâche 4.3, §3) : les ordres de la voiture choisie, en trois colonnes.
export default async function PageTravaux({ searchParams }: { searchParams: Promise<{ vehicule?: string }> }) {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }

  const vehicules = await listerVehiculesAtelier()
  if (vehicules.length === 0) {
    return (
      <EcranVide
        icone={Wrench}
        titre="Travaux"
        lignes={["Ajoute d'abord ta voiture dans l'app Voiture."]}
        action={{ libelle: "Ouvrir l'app Voiture", href: "/apps/voiture" }}
      />
    )
  }

  const { vehicule } = await searchParams
  const choisi = vehicules.find((v) => v.id === vehicule) ?? vehicules[0]
  const travaux = await lireTravaux(choisi.id)
  if (!travaux) notFound()
  const choix = travaux.peutEcrire ? await lireChoixTravaux(choisi.id) : null

  return <TravauxEcran vehicules={vehicules} choisi={choisi} travaux={travaux} choix={choix} />
}
