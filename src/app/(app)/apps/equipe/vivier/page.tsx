import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/equipe/ecran"
import { PageVivierEcran } from "@/apps/equipe/composants/vivier-ecran"
import { pageVivier } from "@/apps/equipe/lectures-ecran"
import { EcranVide } from "@/components/qg/ecran-vide"

// Vivier (tâche 5.2) : des personnes qu'on pourrait appeler. Réservé au niveau écriture sur Équipe.
export default async function PageVivier() {
  const acces = await accesEcran("ecriture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }
  return <PageVivierEcran donnees={await pageVivier()} peutEcrire />
}
