import Link from "next/link"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/budget/ecran"
import { LignePrevisionnel } from "@/apps/budget/composants/formulaires"
import { lireChoix, lirePrevisionnel } from "@/apps/budget/lectures-serveur"
import { formatEuros, phraseEcart } from "@/apps/budget/libelles"
import { jourDeParis } from "@/core/dates"
import { EcranVide } from "@/components/qg/ecran-vide"
import { aAuMoins } from "@/core/droits/niveaux"

// Prévisionnel : le prévu par catégorie, pour la saison entière ou pour une épreuve choisie. Le réel ne
// compte que les dépenses confirmées. Voir : écriture (l'assistance ne le voit pas). Modifier : gestion.

const COULEUR: Record<string, string> = { vert: "text-etat-ok", orange: "text-etat-orange", rouge: "text-etat-rouge" }

export default async function PagePrevisionnel({ searchParams }: { searchParams: Promise<{ saison?: string; epreuve?: string }> }) {
  const acces = await accesEcran("ecriture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour aux mouvements", href: "/apps/budget" }} />
  }
  const parametres = await searchParams
  const choix = await lireChoix()
  const anneeCourante = Number(jourDeParis(new Date()).slice(0, 4))
  const saisonId = parametres.saison ?? choix.saisons.find((saison) => saison.annee === anneeCourante)?.id ?? choix.saisons[0]?.id ?? null
  const epreuvesSaison = choix.epreuves.filter((epreuve) => epreuve.seasonId === saisonId)
  // Une épreuve n'est retenue que si elle appartient à la saison affichée.
  const epreuve = epreuvesSaison.find((candidate) => candidate.id === parametres.epreuve) ?? null
  const lignes = saisonId ? await lirePrevisionnel(saisonId, epreuve?.id ?? null) : []
  const modifiable = aAuMoins(acces.niveau, "gestion")
  const portee = epreuve ? `l'épreuve ${epreuve.nom}` : "la saison"
  const aucunPrevu = lignes.every((ligne) => ligne.prevu === null)
  const adresse = (epreuveId: string | null) => (epreuveId ? `?saison=${saisonId}&epreuve=${epreuveId}` : `?saison=${saisonId}`)

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6">
      <h1 className="titre-rallye text-3xl">Prévisionnel</h1>
      {!saisonId && <p className="text-texte-discret">Aucune saison.</p>}
      {saisonId && (
        <>
          <nav aria-label="Portée du prévisionnel" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:thin]">
            {[{ id: null, nom: "Saison entière" }, ...epreuvesSaison.map(({ id, nom }) => ({ id, nom }))].map((choixPortee) => {
              const actif = (epreuve?.id ?? null) === choixPortee.id
              return (
                <Link
                  key={choixPortee.id ?? "saison"}
                  href={adresse(choixPortee.id)}
                  aria-current={actif ? "page" : undefined}
                  className={`min-h-11 shrink-0 whitespace-nowrap rounded-md border px-3 py-2 text-sm ${actif ? "border-marque bg-marque/10 font-medium text-marque" : "border-bordure text-texte-discret hover:bg-surface-2"}`}
                >
                  {choixPortee.nom}
                </Link>
              )
            })}
          </nav>

          <p className="text-sm text-texte-discret">
            {epreuve
              ? "Le prévu de cette épreuve, par catégorie. Le réel ne compte que les dépenses confirmées de cette épreuve."
              : "Le prévu de la saison, par catégorie. Le réel ne compte que les dépenses confirmées. Fixe un montant prévu pour voir où en est chaque catégorie."}
          </p>

          {aucunPrevu && (
            <p className="rounded-md border border-bordure px-4 py-3 text-sm">
              Aucun montant prévu pour {portee}. Saisis un montant par catégorie pour voir l'écart.
              {!modifiable && " Le responsable ou un gestionnaire le saisit."}
            </p>
          )}

          <div className="hidden grid-cols-[1fr_8rem_8rem_auto] gap-x-4 text-sm text-texte-discret sm:grid">
            <span>Catégorie</span>
            <span className="text-right">Prévu</span>
            <span className="text-right">Réel</span>
            <span>Écart</span>
          </div>
          <ul className="flex flex-col divide-y divide-bordure rounded-lg border border-bordure bg-surface">
            {lignes.map((ligne) => (
              <li key={`${ligne.categorieId}-${epreuve?.id ?? "saison"}`} className="flex flex-col gap-2 px-4 py-3 text-sm sm:grid sm:grid-cols-[1fr_8rem_8rem_auto] sm:items-center sm:gap-x-4">
                <span className="font-medium">{ligne.nom}</span>
                <span className="font-mono tabular-nums sm:text-right">{ligne.prevu === null ? "Pas prévu" : formatEuros(ligne.prevu)}</span>
                <span className="font-mono tabular-nums sm:text-right">{formatEuros(ligne.reel)}</span>
                <span className={`${ligne.couleur ? COULEUR[ligne.couleur] ?? "" : "text-texte-discret"} font-medium`}>
                  {phraseEcart(ligne.prevu, ligne.reel, ligne.pourcent, ligne.couleur as "vert" | "orange" | "rouge" | null)}
                </span>
                {modifiable && (
                  <LignePrevisionnel
                    seasonId={saisonId}
                    eventId={epreuve?.id ?? null}
                    categorie={{ id: ligne.categorieId, nom: ligne.nom }}
                    prevuCentimes={ligne.prevu}
                  />
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="text-xs text-texte-discret">Date du jour : {jourDeParis(new Date())}</p>
    </section>
  )
}
