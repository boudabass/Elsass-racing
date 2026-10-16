import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/budget/ecran"
import { LignePrevisionnel } from "@/apps/budget/composants/formulaires"
import { lireChoix, lirePrevisionnel } from "@/apps/budget/lectures-serveur"
import { formatEuros, LIBELLE_ECART } from "@/apps/budget/libelles"
import { jourDeParis } from "@/apps/saison/regles"
import { EcranVide } from "@/components/qg/ecran-vide"
import { aAuMoins } from "@/core/droits/niveaux"

// Prévisionnel de la saison par catégorie : prévu, réel confirmé, écart, couleur. Voir : écriture.
// Modifier : gestion.

const COULEUR: Record<string, string> = { vert: "text-etat-ok", orange: "text-etat-orange", rouge: "text-etat-rouge" }

export default async function PagePrevisionnel({ searchParams }: { searchParams: Promise<{ saison?: string }> }) {
  const acces = await accesEcran("ecriture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour aux mouvements", href: "/apps/budget" }} />
  }
  const parametres = await searchParams
  const choix = await lireChoix()
  const anneeCourante = Number(jourDeParis(new Date()).slice(0, 4))
  const saisonId = parametres.saison ?? choix.saisons.find((saison) => saison.annee === anneeCourante)?.id ?? choix.saisons[0]?.id ?? null
  const lignes = saisonId ? await lirePrevisionnel(saisonId) : []
  const modifiable = aAuMoins(acces.niveau, "gestion")

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6">
      <h1 className="titre-rallye text-3xl">Prévisionnel</h1>
      {!saisonId && <p className="text-texte-discret">Aucune saison.</p>}
      {saisonId && (
        <>
          <p className="text-sm text-texte-discret">Montants de la saison, par catégorie de dépense. Le réel ne compte que les dépenses confirmées.</p>
          <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm sm:grid-cols-[1fr_8rem_8rem_8rem]">
            <span className="text-texte-discret">Catégorie</span>
            <span className="text-right text-texte-discret sm:block">Prévu</span>
            <span className="hidden text-right text-texte-discret sm:block">Réel</span>
            <span className="hidden text-right text-texte-discret sm:block">Écart</span>
          </div>
          <ul className="flex flex-col divide-y divide-bordure rounded-lg border border-bordure bg-surface">
            {lignes.map((ligne) => (
              <li key={ligne.categorieId} className="flex flex-col gap-2 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{ligne.nom}</span>
                  <span className="font-mono tabular-nums">
                    {ligne.prevu === null ? "Pas prévu" : formatEuros(ligne.prevu)} · réel {formatEuros(ligne.reel)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {ligne.couleur ? (
                    <span className={`${COULEUR[ligne.couleur] ?? ""} font-medium`}>
                      {LIBELLE_ECART[ligne.couleur as keyof typeof LIBELLE_ECART]}
                      {ligne.pourcent !== null ? ` · ${Math.round(ligne.pourcent)} %` : ""}
                    </span>
                  ) : (
                    <span className="text-texte-discret">Aucune dépense</span>
                  )}
                  {modifiable && (
                    <LignePrevisionnel seasonId={saisonId} categorie={{ id: ligne.categorieId, nom: ligne.nom }} prevuCentimes={ligne.prevu} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="text-xs text-texte-discret">Date du jour : {jourDeParis(new Date())}</p>
    </section>
  )
}
