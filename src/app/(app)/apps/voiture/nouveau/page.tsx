import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/voiture/ecran"
import { FormulaireVehicule } from "@/apps/voiture/composants/formulaire-vehicule"
import { GABARITS } from "@/apps/voiture/gabarits"
import { EcranVide } from "@/components/qg/ecran-vide"

// Nouveau véhicule : nom, type, gabarit. Le reste (identité, papiers, déco) se remplit dans la fiche.
export default async function PageNouveauVehicule() {
  const acces = await accesEcran("ecriture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour aux véhicules", href: "/apps/voiture" }} />
  }

  return (
    <section className="flex max-w-xl flex-col gap-6">
      <h1 className="titre-rallye text-3xl">Nouveau véhicule</h1>
      <FormulaireVehicule gabarits={GABARITS.map((gabarit) => ({ cle: gabarit.cle, nom: gabarit.nom }))} />
    </section>
  )
}
