import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/equipe/ecran"
import { PageBinomesEcran } from "@/apps/equipe/composants/binomes-ecran"
import { pageBinomes } from "@/apps/equipe/lectures-ecran"
import { EcranVide } from "@/components/qg/ecran-vide"

// Binômes (tâche 5.2) : pilote et copilote, avec leurs chiffres officiels. Lecture seule.
export default async function PageBinomes() {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }
  return <PageBinomesEcran donnees={await pageBinomes()} />
}
