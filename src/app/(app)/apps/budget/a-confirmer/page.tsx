import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/budget/ecran"
import { ActionsSuggestion } from "@/apps/budget/composants/formulaires"
import { lireChoix, listerSuggestions } from "@/apps/budget/lectures-serveur"
import { formatEuros, libelle } from "@/apps/budget/libelles"
import { EcranVide } from "@/components/qg/ecran-vide"

// Mouvements proposés par les autres apps : Confirmer (payeur et catégorie modifiables) ou Ignorer.

export default async function PageAConfirmer() {
  const acces = await accesEcran("ecriture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour aux mouvements", href: "/apps/budget" }} />
  }
  const [suggestions, choix] = await Promise.all([listerSuggestions(), lireChoix()])

  return (
    <section className="flex max-w-3xl flex-col gap-6">
      <h1 className="titre-rallye text-3xl">À confirmer</h1>
      {suggestions.length === 0 && <p className="text-texte-discret">Rien à confirmer pour l'instant.</p>}
      <ul className="flex flex-col gap-4">
        {suggestions.map((suggestion) => {
          const categories = suggestion.sens === "depense" ? choix.categoriesDepense : choix.categoriesRecette
          return (
            <li key={suggestion.id} className="flex flex-col gap-3 rounded-lg border border-bordure bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-medium">{suggestion.libelle}</h2>
                <span className="chiffre">{formatEuros(suggestion.montantCentimes)}</span>
              </div>
              <p className="text-sm text-texte-discret">
                {libelle("BudgetSens", suggestion.sens)} · proposé par {suggestion.appOrigine}
                {suggestion.eventNom ? ` · ${suggestion.eventNom}` : ""}
              </p>
              <ActionsSuggestion
                id={suggestion.id}
                payeurs={choix.payeurs.map(({ id, nom }) => ({ id, nom }))}
                payeurId={suggestion.payeurId ?? choix.payeurs.find((payeur) => payeur.type === "caisse_team")?.id ?? null}
                categories={categories}
                categorieId={suggestion.categorieId}
              />
            </li>
          )
        })}
      </ul>
    </section>
  )
}
