import { notFound } from "next/navigation"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/checklist/ecran"
import { PageModele } from "@/apps/checklist/composants/page-modele"
import { pageModele } from "@/apps/checklist/lectures-ecran"
import { EcranVide } from "@/components/qg/ecran-vide"

// Un modèle et ses points (tâche 5.6, §1.7).
export default async function PageModeleEcran({ params }: { params: Promise<{ id: string }> }) {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }
  const { id } = await params
  const donnees = await pageModele(id)
  if (!donnees) notFound()
  return <PageModele donnees={donnees} />
}
