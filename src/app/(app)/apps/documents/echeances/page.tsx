import { Lock } from "lucide-react"

import { EcheancesEcran } from "@/apps/documents/composants/echeances-ecran"
import { accesEcran } from "@/apps/documents/ecran"
import { lireEcheances } from "@/apps/documents/lectures-echeances"
import { EcranVide } from "@/components/qg/ecran-vide"

// Échéances (tâche 5.4, brief §1) : documents propres, papiers de Voiture, licences et homologations d'Équipe, par zone.
export default async function PageEcheances() {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }
  const donnees = await lireEcheances()
  return <EcheancesEcran donnees={donnees} />
}
