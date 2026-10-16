import Link from "next/link"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/budget/ecran"
import { FormulaireRecette } from "@/apps/budget/composants/formulaires"
import { lireChoix } from "@/apps/budget/lectures-serveur"
import { jourDeParis } from "@/apps/saison/regles"
import { EcranVide } from "@/components/qg/ecran-vide"

// Nouvelle recette (écriture) : montant, catégorie, provenance ; prévue ou encaissée ; en nature avec sa
// description et sa valeur estimée.

export default async function PageNouvelleRecette() {
  const acces = await accesEcran("ecriture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour aux mouvements", href: "/apps/budget" }} />
  }
  const choix = await lireChoix()

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
      <Link href="/apps/budget" className="text-sm text-texte-discret">
        ← Mouvements
      </Link>
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
