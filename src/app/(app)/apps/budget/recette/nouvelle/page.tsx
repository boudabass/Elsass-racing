import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/budget/ecran"
import { FormulaireRecette } from "@/apps/budget/composants/formulaires"
import { lireChoix } from "@/apps/budget/lectures-serveur"
import { jourDeParis } from "@/core/dates"
import { EcranVide } from "@/components/qg/ecran-vide"

// Nouvelle recette (écriture), ouverte par le bouton de la liste des recettes (brief 3.14, point 3) : montant,
// catégorie, provenance ; prévue ou encaissée ; en nature avec sa description et sa valeur estimée.

export default async function PageNouvelleRecette() {
  const acces = await accesEcran("ecriture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour aux recettes", href: "/apps/budget/recette" }} />
  }
  const choix = await lireChoix()

  return (
    <section className="flex max-w-2xl flex-col gap-6">
      <h1 className="titre-rallye text-3xl">Nouvelle recette</h1>
      <FormulaireRecette
        categories={choix.categoriesRecette}
        payeurs={choix.payeurs.map(({ id, nom }) => ({ id, nom }))}
        epreuves={choix.epreuves.map(({ id, nom }) => ({ id, nom }))}
        epreuveEnCoursId={choix.epreuveEnCoursId}
        dateDuJour={jourDeParis(new Date())}
      />
    </section>
  )
}
