import { notFound } from "next/navigation"
import { Lock, Wrench } from "lucide-react"

import { accesEcran } from "@/apps/garage/ecran"
import { CassesEcran } from "@/apps/garage/composants/casses"
import { lireFichesCasse } from "@/apps/garage/lectures-casses-serveur"
import { listerVehiculesAtelier } from "@/apps/garage/lectures-serveur"
import { aAuMoins } from "@/core/droits/niveaux"
import { EcranVide } from "@/components/qg/ecran-vide"

// Casses du Garage (tâche 4.4, §3) : les fiches de la voiture choisie, « à compléter » en tête. Lecture pour l'assistance,
// écriture pour le responsable et l'équipage.
export default async function PageCasses({ searchParams }: { searchParams: Promise<{ vehicule?: string }> }) {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }

  const vehicules = await listerVehiculesAtelier()
  if (vehicules.length === 0) {
    return (
      <EcranVide
        icone={Wrench}
        titre="Casses"
        lignes={["Ajoute d'abord ta voiture dans l'app Voiture."]}
        action={{ libelle: "Ouvrir l'app Voiture", href: "/apps/voiture" }}
      />
    )
  }

  const { vehicule } = await searchParams
  const choisi = vehicules.find((v) => v.id === vehicule) ?? vehicules[0]
  const fiches = await lireFichesCasse(choisi.id)
  if (!fiches) notFound()

  return <CassesEcran vehicules={vehicules} choisi={choisi} fiches={fiches} peutEcrire={aAuMoins(acces.niveau, "ecriture")} />
}
