import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/checklist/ecran"
import { PageModeles } from "@/apps/checklist/composants/page-modeles"
import { pageModeles } from "@/apps/checklist/lectures-ecran"
import { EcranVide } from "@/components/qg/ecran-vide"

// Bibliothèque des modèles (tâche 5.6, §1.7). Pas d'accès pour l'assistance : la liste est vide pour elle.
export default async function PageModelesEcran() {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }
  return <PageModeles donnees={await pageModeles()} />
}
