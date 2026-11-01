import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/checklist/ecran"
import { PagePreparation } from "@/apps/checklist/composants/page-preparation"
import { pagePreparation } from "@/apps/checklist/lectures-ecran"
import { EcranVide } from "@/components/qg/ecran-vide"

// Préparation de l'épreuve (tâche 5.6, §1.1) : l'épreuve (la prochaine par défaut, « ?epreuve= » pour une autre).
export default async function PagePreparationEcran({ searchParams }: { searchParams: Promise<{ epreuve?: string }> }) {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }
  const { epreuve } = await searchParams
  return <PagePreparation donnees={await pagePreparation(epreuve)} />
}
