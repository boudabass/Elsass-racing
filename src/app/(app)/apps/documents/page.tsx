import { Lock } from "lucide-react"

import { CoffreEcran } from "@/apps/documents/composants/coffre-ecran"
import { accesEcran } from "@/apps/documents/ecran"
import { lireCoffre, lireDossiersRangement } from "@/apps/documents/lectures-serveur"
import { EcranVide } from "@/components/qg/ecran-vide"

// Coffre-fort (tâche 5.3, brief §5) : compteurs d'échéances, une carte par dossier, « + ».
export default async function PageCoffre() {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }
  const donnees = await lireCoffre()
  // La liste de rangement ne sert qu'à « Document » : elle n'est lue que si l'on peut ajouter.
  const rangement = donnees.peutAjouter.permis ? await lireDossiersRangement() : []
  return <CoffreEcran donnees={donnees} rangement={rangement} />
}
