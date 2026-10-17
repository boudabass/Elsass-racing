import Link from "next/link"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/budget/ecran"
import { FiltresMouvements } from "@/apps/budget/composants/filtres"
import { BOUTON, MONTANT } from "@/apps/budget/composants/classes"
import { lireChoix, lireMouvement, listerMouvements, compterSuggestions, type MouvementLu } from "@/apps/budget/lectures-serveur"
import { formatEuros, libelle } from "@/apps/budget/libelles"
import { jourDeParis } from "@/core/dates"
import { prefsMembre } from "@/apps/settings/preferences-serveur"
import { appDecouverte } from "@/apps/settings/regles-personnelles"
import { EcranDecouverte } from "@/components/qg/ecran-decouverte"
import { EcranVide } from "@/components/qg/ecran-vide"
import { contexteQg } from "@/core/qg/donnees"
import { ECRANS_DECOUVERTE } from "@/core/sdk/decouverte"
import { aAuMoins } from "@/core/droits/niveaux"

// Mouvements de Budget : dépenses et recettes, plus récentes d'abord. Filtres dans l'URL ; la fiche d'un
// mouvement s'ouvre à droite sur PC (paramètre m), en pleine page sur téléphone.

const formatJour = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" })

export default async function PageMouvements({
  searchParams,
}: {
  searchParams: Promise<{ saison?: string; epreuve?: string; categorie?: string; membre?: string; m?: string }>
}) {
  const acces = await accesEcran("contribution")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }

  // Première ouverture par ce membre : l'écran explicatif, jusqu'au bouton « Commencer ».
  const { contexte } = await contexteQg()
  const prefs = await prefsMembre(contexte)
  if (!appDecouverte("budget", prefs.appsDecouvertes)) {
    return <EcranDecouverte appCle="budget" nom="Budget" lignes={ECRANS_DECOUVERTE.budget.lignes} />
  }

  const parametres = await searchParams
  const choix = await lireChoix()
  const anneeCourante = Number(jourDeParis(new Date()).slice(0, 4))
  const saisonDefaut = choix.saisons.find((saison) => saison.annee === anneeCourante) ?? choix.saisons[0] ?? null
  const saisonId = parametres.saison ?? saisonDefaut?.id ?? null

  const { mouvements, toutVisible } = await listerMouvements({
    saisonId,
    eventId: parametres.epreuve || null,
    categorieId: parametres.categorie || null,
    personneId: parametres.membre || null,
  })
  const depenses = mouvements.filter((mouvement) => mouvement.type === "depense" && mouvement.statut === "confirmee")
  const recettes = mouvements.filter((mouvement) => mouvement.type === "recette")
  const totalDepenses = depenses.reduce((total, mouvement) => total + mouvement.montantCentimes, 0)
  const totalRecettes = recettes.reduce((total, mouvement) => total + mouvement.montantCentimes, 0)
  const aConfirmer = aAuMoins(acces.niveau, "ecriture") ? await compterSuggestions() : 0
  const fiche = parametres.m ? await lireMouvement(parametres.m) : null

  // Filtres actifs en pastilles retirables (la saison ne s'retire pas : c'est le choix de période).
  const retirer = (cle: string) => {
    const sansCle = new URLSearchParams(Object.entries(parametres).filter(([nom, valeur]) => nom !== "m" && nom !== cle && valeur) as [string, string][])
    return `/apps/budget${sansCle.toString() ? `?${sansCle.toString()}` : ""}`
  }
  const pastilles = [
    ...(parametres.epreuve ? [{ cle: "epreuve", libelle: choix.epreuves.find((epreuve) => epreuve.id === parametres.epreuve)?.nom ?? "Épreuve" }] : []),
    ...(parametres.categorie ? [{ cle: "categorie", libelle: [...choix.categoriesDepense, ...choix.categoriesRecette].find((categorie) => categorie.id === parametres.categorie)?.nom ?? "Catégorie" }] : []),
    ...(parametres.membre ? [{ cle: "membre", libelle: choix.payeurs.find((payeur) => payeur.id === parametres.membre)?.nom ?? "Membre" }] : []),
  ].map((pastille) => ({ ...pastille, retirer: retirer(pastille.cle) }))

  const query = new URLSearchParams(Object.entries(parametres).filter(([cle, valeur]) => cle !== "m" && valeur) as [string, string][]).toString()
  const adresse = (id: string) => `/apps/budget?${query ? `${query}&` : ""}m=${id}`

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="titre-rallye text-3xl">Mouvements</h1>
        <div className="flex flex-wrap gap-2">
          {aAuMoins(acces.niveau, "ecriture") && aConfirmer > 0 && (
            <Link href="/apps/budget/a-confirmer" className="rounded-md border border-bordure px-3 py-2 text-sm">
              {aConfirmer} à confirmer
            </Link>
          )}
          <Link href={`/apps/budget/export${query ? `?${query}` : ""}`} className="rounded-md border border-bordure px-3 py-2 text-sm">
            Exporter (CSV)
          </Link>
          <Link href="/apps/budget/nouvelle" className={BOUTON}>
            Ajouter une dépense
          </Link>
        </div>
      </header>

      <FiltresMouvements
        saisons={choix.saisons.map((saison) => ({ id: saison.id, annee: saison.annee }))}
        epreuves={choix.epreuves.filter((epreuve) => !saisonId || epreuve.seasonId === saisonId).map(({ id, nom }) => ({ id, nom }))}
        categories={[...choix.categoriesDepense, ...choix.categoriesRecette].map(({ id, nom }) => ({ id, nom }))}
        membres={choix.payeurs.filter((payeur) => payeur.type === "membre").map(({ id, nom }) => ({ id, nom }))}
        valeurs={{ saison: saisonId ?? "", epreuve: parametres.epreuve ?? "", categorie: parametres.categorie ?? "", membre: parametres.membre ?? "" }}
        afficherMembres={toutVisible}
        nombreActifs={pastilles.length}
        pastilles={
          pastilles.length > 0 ? (
            <ul className="flex flex-wrap gap-2" aria-label="Filtres actifs">
              {pastilles.map((pastille) => (
                <li key={pastille.cle}>
                  <Link href={pastille.retirer} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-bordure bg-surface px-3 py-1 text-sm">
                    {pastille.libelle}
                    <span aria-hidden>×</span>
                    <span className="sr-only">Retirer ce filtre</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null
        }
      />

      <dl className="grid gap-3 text-sm sm:grid-cols-3" aria-label="Totaux de la sélection">
        <div className="rounded-lg border border-bordure bg-surface p-4">
          <dt className="text-texte-discret">Dépenses confirmées</dt>
          <dd className={`${MONTANT} text-lg`}>{formatEuros(totalDepenses)}</dd>
        </div>
        {toutVisible && (
          <div className="rounded-lg border border-bordure bg-surface p-4">
            <dt className="text-texte-discret">Recettes</dt>
            <dd className={`${MONTANT} text-lg text-etat-ok`}>{formatEuros(totalRecettes)}</dd>
          </div>
        )}
        {toutVisible && (
          <div className="rounded-lg border border-bordure bg-surface p-4">
            <dt className="text-texte-discret">Recettes moins dépenses</dt>
            <dd className={`${MONTANT} text-lg`}>{formatEuros(totalRecettes - totalDepenses)}</dd>
          </div>
        )}
      </dl>

      <div className="grid gap-6 md:grid-cols-[1fr_22rem]">
        <ul className={`flex flex-col divide-y divide-bordure rounded-lg border border-bordure bg-surface ${parametres.m ? "hidden md:flex" : ""}`}>
          {mouvements.length === 0 && <li className="px-4 py-6 text-sm text-texte-discret">Aucun mouvement pour ce choix.</li>}
          {mouvements.map((mouvement) => (
            <li key={mouvement.id}>
              <Link href={adresse(mouvement.id)} aria-current={parametres.m === mouvement.id ? "true" : undefined} className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{mouvement.libelle}</span>
                  <span className="text-xs text-texte-discret">
                    {formatJour.format(new Date(`${mouvement.date}T00:00:00Z`))} · {mouvement.categorieNom}
                    {mouvement.payeurNom ? ` · ${mouvement.payeurNom}` : ""}
                  </span>
                </span>
                <span className={`${MONTANT} shrink-0 ${mouvement.type === "recette" ? "text-etat-ok" : ""}`}>
                  {mouvement.type === "recette" ? "+" : "−"} {formatEuros(mouvement.montantCentimes)}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <aside className={parametres.m ? "" : "hidden md:block"} aria-label="Fiche du mouvement">
          {fiche ? (
            <FicheMouvement mouvement={fiche} retour={query ? `/apps/budget?${query}` : "/apps/budget"} />
          ) : (
            <p className="text-sm text-texte-discret">Choisis un mouvement pour voir sa fiche.</p>
          )}
        </aside>
      </div>
    </section>
  )
}

function FicheMouvement({ mouvement, retour }: { mouvement: MouvementLu; retour: string }) {
  const estDepense = mouvement.type === "depense"
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-bordure bg-surface p-4 text-sm">
      <Link href={retour} className="text-texte-discret md:hidden">
        ← Retour à la liste
      </Link>
      <h2 className="text-base font-medium">{mouvement.libelle}</h2>
      <p className={`${MONTANT} text-xl`}>{formatEuros(mouvement.montantCentimes)}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-texte-discret">Sens</dt>
        <dd>{estDepense ? "Dépense" : "Recette"}</dd>
        <dt className="text-texte-discret">Date</dt>
        <dd>{mouvement.date}</dd>
        <dt className="text-texte-discret">Catégorie</dt>
        <dd>{mouvement.categorieNom}</dd>
        {mouvement.payeurNom && (
          <>
            <dt className="text-texte-discret">{estDepense ? "Payé par" : "Encaissé sur"}</dt>
            <dd>{mouvement.payeurNom}</dd>
          </>
        )}
        {mouvement.eventNom && (
          <>
            <dt className="text-texte-discret">Épreuve</dt>
            <dd>{mouvement.eventNom}</dd>
          </>
        )}
        <dt className="text-texte-discret">Statut</dt>
        <dd>{estDepense ? (mouvement.statut === "confirmee" ? "Confirmée" : "À confirmer") : libelle("BudgetStatutRecette", mouvement.statut)}</dd>
        {estDepense && mouvement.remboursement && (
          <>
            <dt className="text-texte-discret">Remboursement</dt>
            <dd>{libelle("BudgetRemboursement", mouvement.remboursement)}</dd>
          </>
        )}
        <dt className="text-texte-discret">Origine</dt>
        <dd>{libelle("BudgetOrigine", mouvement.origine)}</dd>
      </dl>
      {/* Les droits sont ceux de la page : elle refuse ce que le membre ne peut pas modifier ou supprimer. */}
      <div className="flex flex-wrap gap-2 pt-1">
        <Link href={`/apps/budget/mouvement/${mouvement.id}`} className="cible-tactile flex items-center rounded-md border border-bordure px-3 hover:bg-surface-2">
          Modifier
        </Link>
        <Link href={`/apps/budget/mouvement/${mouvement.id}#supprimer`} className="cible-tactile flex items-center rounded-md border border-etat-rouge px-3 text-etat-rouge hover:bg-surface-2">
          Supprimer
        </Link>
      </div>
    </article>
  )
}
