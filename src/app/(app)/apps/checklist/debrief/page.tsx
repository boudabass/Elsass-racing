import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/checklist/ecran"
import { PageDebrief } from "@/apps/checklist/composants/page-debrief"
import { pageDebrief } from "@/apps/checklist/lectures-ecran"
import { EcranVide } from "@/components/qg/ecran-vide"

// Débrief après l'épreuve (tâche 5.6, §1.6). Réservé à l'écriture et à la gestion (menu).
export default async function PageDebriefEcran({ searchParams }: { searchParams: Promise<{ epreuve?: string }> }) {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }
  const { epreuve } = await searchParams
  return <PageDebrief donnees={await pageDebrief(epreuve)} />
}
