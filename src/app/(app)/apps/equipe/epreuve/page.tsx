import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/equipe/ecran"
import { PageEpreuveEcran } from "@/apps/equipe/composants/epreuve-ecran"
import { pageEpreuve } from "@/apps/equipe/lectures-ecran"
import { EcranVide } from "@/components/qg/ecran-vide"

// Prochaine épreuve (tâche 5.2) : présence, équipage (Saison), affectations et tâches liées.
export default async function PageProchaineEpreuve() {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }
  return <PageEpreuveEcran donnees={await pageEpreuve()} />
}
