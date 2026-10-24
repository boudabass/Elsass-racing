import { notFound } from "next/navigation"
import { Lock, Wrench } from "lucide-react"

import { PlanEcran } from "@/apps/garage/composants/plan"
import { accesEcran } from "@/apps/garage/ecran"
import { lirePlanEcran } from "@/apps/garage/lectures-plan-serveur"
import { listerVehiculesAtelier } from "@/apps/garage/lectures-serveur"
import { aAuMoins } from "@/core/droits/niveaux"
import { EcranVide } from "@/components/qg/ecran-vide"

// Plan avant épreuve (tâche 4.5, §2) : constat seul, par voiture, pour l'épreuve choisie ou la prochaine engagée.
// Lecture pour l'assistance (sans coût), écriture pour le responsable et l'équipage, rien pour l'invité.
export default async function PagePlan({ searchParams }: { searchParams: Promise<{ vehicule?: string; epreuve?: string }> }) {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }

  const vehicules = await listerVehiculesAtelier()
  if (vehicules.length === 0) {
    return (
      <EcranVide
        icone={Wrench}
        titre="Plan avant épreuve"
        lignes={["Ajoutez d'abord votre voiture dans l'app Voiture."]}
        action={{ libelle: "Ouvrir l'app Voiture", href: "/apps/voiture" }}
      />
    )
  }

  const { vehicule, epreuve } = await searchParams
  const choisi = vehicules.find((v) => v.id === vehicule) ?? vehicules[0]
  const plan = await lirePlanEcran(choisi.id, epreuve ?? null)
  if (!plan) notFound()

  return <PlanEcran vehicules={vehicules} choisi={choisi} plan={plan} peutVoirPrix={aAuMoins(acces.niveau, "ecriture")} />
}
