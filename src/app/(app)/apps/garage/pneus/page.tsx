import { notFound } from "next/navigation"
import { Lock, Wrench } from "lucide-react"

import { accesEcran } from "@/apps/garage/ecran"
import { PneusEcran } from "@/apps/garage/composants/pneus"
import { lireTrains, listerVehiculesAtelier } from "@/apps/garage/lectures-serveur"
import { aAuMoins } from "@/core/droits/niveaux"
import { EcranVide } from "@/components/qg/ecran-vide"

// Pneus du Garage (tâche 4.4, §2) : les trains de la voiture choisie. Lecture pour l'assistance, écriture pour le responsable et l'équipage.
export default async function PagePneus({ searchParams }: { searchParams: Promise<{ vehicule?: string; filtre?: string }> }) {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }

  const vehicules = await listerVehiculesAtelier()
  if (vehicules.length === 0) {
    return (
      <EcranVide
        icone={Wrench}
        titre="Pneus"
        lignes={["Ajoute d'abord ta voiture dans l'app Voiture."]}
        action={{ libelle: "Ouvrir l'app Voiture", href: "/apps/voiture" }}
      />
    )
  }

  const { vehicule, filtre } = await searchParams
  const choisi = vehicules.find((v) => v.id === vehicule) ?? vehicules[0]
  const lecture = await lireTrains(choisi.id)
  if (!lecture) notFound()

  return (
    <PneusEcran
      vehicules={vehicules}
      choisi={choisi}
      trains={lecture.trains}
      filtre={filtre === "usés" ? "usés" : "tous"}
      peutEcrire={aAuMoins(acces.niveau, "ecriture")}
    />
  )
}
