import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/budget/ecran"
import { FormulaireDepense } from "@/apps/budget/composants/formulaires"
import { lireChoix } from "@/apps/budget/lectures-serveur"
import { jourDeParis } from "@/core/dates"
import { EcranVide } from "@/components/qg/ecran-vide"
import { aAuMoins } from "@/core/droits/niveaux"

// Nouvelle dépense en trois champs (montant, catégorie, payé par), le reste sous « Plus de détails ».
// Écrite dans la base locale : elle fonctionne hors ligne et part à la prochaine connexion.
// Sans écriture, on ne peut payer qu'en son nom : la liste des payeurs se limite à « Moi ».

export default async function PageNouvelleDepense({ searchParams }: { searchParams: Promise<{ epreuve?: string }> }) {
  const parametres = await searchParams
  const acces = await accesEcran("contribution")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }
  const choix = await lireChoix()
  const payeurs = aAuMoins(acces.niveau, "ecriture") ? choix.payeurs : choix.payeurs.filter((payeur) => payeur.id === choix.moiId)

  return (
    <section className="flex max-w-xl flex-col gap-6">
      <h1 className="titre-rallye text-3xl">Nouvelle dépense</h1>
      <FormulaireDepense
        options={{
          categories: choix.categoriesDepense,
          categorieEngagementId: choix.categorieEngagementId,
          payeurs,
          moiId: choix.moiId,
          epreuves: choix.epreuves.map(({ id, nom }) => ({ id, nom })),
          epreuveEnCoursId: choix.epreuves.some((epreuve) => epreuve.id === parametres.epreuve) ? (parametres.epreuve ?? null) : choix.epreuveEnCoursId,
          dateDuJour: jourDeParis(new Date()),
          engagements: choix.engagements,
        }}
      />
    </section>
  )
}
