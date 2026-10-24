import { Lock } from "lucide-react"

import { dateDeParis } from "@/apps/garage/commandes"
import { EquipementsEcran } from "@/apps/garage/composants/equipements"
import { accesEcran } from "@/apps/garage/ecran"
import { lireEquipements } from "@/apps/garage/lectures-equipements-serveur"
import { EcranVide } from "@/components/qg/ecran-vide"

// Équipements de la team (tâche 4.6, brief §3) : remorque, outillage, levage, assistance, stand. Lecture pour l'assistance,
// sans la valeur ; ajout, modification et retrait pour le responsable et l'équipage. « ?nouveau=1 » ouvre l'ajout (bouton +).
export default async function PageEquipements({ searchParams }: { searchParams: Promise<{ nouveau?: string }> }) {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }

  const { nouveau } = await searchParams
  const { equipements, peutEcrire } = await lireEquipements()

  return (
    <EquipementsEcran
      equipements={equipements}
      peutEcrire={peutEcrire}
      aujourdhui={dateDeParis(new Date())}
      nouvelleOuverte={peutEcrire && nouveau === "1"}
    />
  )
}
