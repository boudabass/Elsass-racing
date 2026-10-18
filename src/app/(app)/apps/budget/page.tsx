import Link from "next/link"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/budget/ecran"
import { FiltresMouvements } from "@/apps/budget/composants/filtres"
import { BOUTON, MONTANT } from "@/apps/budget/composants/classes"
import { EncaisserRecette } from "@/apps/budget/composants/encaisser"
import { lireChoix, lireMouvement, listerMouvements, compterSuggestions, type MouvementLu } from "@/apps/budget/lectures-serveur"
import { formatEuros, libelle } from "@/apps/budget/libelles"
import { comptesEncaissement } from "@/apps/budget/regles"
import { jourDeParis, jourEnFrancais } from "@/core/dates"
import { prefsMembre } from "@/apps/settings/preferences-serveur"
import { appDecouverte } from "@/apps/settings/regles-personnelles"
import { EcranDecouverte } from "@/components/qg/ecran-decouverte"
import { EcranVide } from "@/components/qg/ecran-vide"
import { contexteQg } from "@/core/qg/donnees"
import { ECRANS_DECOUVERTE } from "@/core/sdk/decouverte"
import { aAuMoins } from "@/core/droits/niveaux"
import { LIEN } from "@/lib/classes-formulaire"

// Mouvements de Budget : dépenses et recettes, plus récentes d'abord. Filtres dans l'URL ; la fiche d'un
// mouvement s'ouvre à droite sur PC (paramètre m), en pleine page sur téléphone.

const formatJour = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" })

// « Encaissée le 18 octobre 2026 » pour une recette encaissée, le libellé de statut sinon (brief 3.9, §3).
function libelleStatutRecette(mouvement: MouvementLu): string {
  return mouvement.encaisseeLe
    ? `Encaissée le ${jourEnFrancais(new Date(`${mouvement.encaisseeLe}T00:00:00Z`))}`
    : libelle("BudgetStatutRecette", mouvement.statut)
}

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
  // Encaisser une recette prévue : réservé au niveau gestion (brief 3.9, §3). Date par défaut : aujourd'hui.
  const peutEncaisser = aAuMoins(acces.niveau, "gestion")
  const encaissement = { comptes: comptesEncaissement(choix.payeurs), aujourdhui: jourDeParis(new Date()) }

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
    <section className="flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="titre-rallye text-3xl">Mouvements</h1>
        <div className="flex flex-wrap gap-2">
          {aAuMoins(acces.niveau, "ecriture") && aConfirmer > 0 && (
            <Link href="/apps/budget/a-confirmer" className="rounded-md border border-bordure px-3 py-2 text-sm">
              {aConfirmer} à confirmer
            </Link>
          )}
          <Link href="/apps/budget/nouvelle" className={BOUTON}>
            Ajouter une dépense
          </Link>
          {aAuMoins(acces.niveau, "ecriture") && (
            <Link href={`/apps/budget/bilan${parametres.saison ? `?saison=${parametres.saison}` : ""}`} className={LIEN}>
              Bilan de saison (PDF)
            </Link>
          )}
          {/* Action secondaire : un lien discret, après le bouton principal. */}
          <Link href={`/apps/budget/export${query ? `?${query}` : ""}`} className="inline-flex min-h-11 items-center px-2 text-sm text-texte-discret hover:text-texte">
            Exporter (CSV)
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
                  <Link href={pastille.retirer} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-bordure bg-surface px-3 py-1 text-sm">
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

      {/* Téléphone : une seule carte, trois lignes (libellé à gauche, montant à droite). Ordinateur : trois cartes. */}
      <dl className="flex flex-col divide-y divide-bordure overflow-hidden rounded-lg border border-bordure bg-surface text-sm sm:grid sm:grid-cols-3 sm:gap-3 sm:divide-y-0 sm:overflow-visible sm:border-0 sm:bg-transparent" aria-label="Totaux de la sélection">
        <div className="flex items-baseline justify-between gap-3 px-4 py-3 sm:block sm:rounded-lg sm:border sm:border-bordure sm:bg-surface sm:p-4">
          <dt className="text-texte-discret">Dépenses confirmées</dt>
          <dd className={`${MONTANT} text-base sm:text-lg`}>{formatEuros(totalDepenses)}</dd>
        </div>
        {toutVisible && (
          <div className="flex items-baseline justify-between gap-3 px-4 py-3 sm:block sm:rounded-lg sm:border sm:border-bordure sm:bg-surface sm:p-4">
            <dt className="text-texte-discret">Recettes</dt>
            <dd className={`${MONTANT} text-base text-etat-ok sm:text-lg`}>{formatEuros(totalRecettes)}</dd>
          </div>
        )}
        {toutVisible && (
          <div className="flex items-baseline justify-between gap-3 px-4 py-3 sm:block sm:rounded-lg sm:border sm:border-bordure sm:bg-surface sm:p-4">
            <dt className="text-texte-discret">Recettes moins dépenses</dt>
            <dd className={`${MONTANT} text-base sm:text-lg`}>{formatEuros(totalRecettes - totalDepenses)}</dd>
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
            {peutEncaisser && mouvement.type === "recette" && mouvement.statut === "prevue" && parametres.m !== mouvement.id && (
              <div className="px-4 pb-3">
                <EncaisserRecette recetteId={mouvement.id} comptes={encaissement.comptes} dateDefaut={encaissement.aujourdhui} />
              </div>
            )}
            </li>
          ))}
        </ul>

        <aside className={parametres.m ? "" : "hidden md:block"} aria-label="Fiche du mouvement">
          {fiche ? (
            <FicheMouvement
              mouvement={fiche}
              retour={query ? `/apps/budget?${query}` : "/apps/budget"}
              encaissement={peutEncaisser && fiche.type === "recette" && fiche.statut === "prevue" ? encaissement : null}
            />
          ) : (
            <p className="text-sm text-texte-discret">Choisis un mouvement pour voir sa fiche.</p>
          )}
        </aside>
      </div>
    </section>
  )
}

function FicheMouvement({
  mouvement,
  retour,
  encaissement,
}: {
  mouvement: MouvementLu
  retour: string
  encaissement: { comptes: Array<{ id: string; nom: string; parDefaut: boolean }>; aujourdhui: string } | null
}) {
  const estDepense = mouvement.type === "depense"
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-bordure bg-surface p-4 text-sm">
      <Link href={retour} className="cible-tactile inline-flex items-center text-texte-discret md:hidden">
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
        <dd>{estDepense ? (mouvement.statut === "confirmee" ? "Confirmée" : "À confirmer") : libelleStatutRecette(mouvement)}</dd>
        {estDepense && mouvement.remboursement && (
          <>
            <dt className="text-texte-discret">Remboursement</dt>
            <dd>{libelle("BudgetRemboursement", mouvement.remboursement)}</dd>
          </>
        )}
        <dt className="text-texte-discret">Origine</dt>
        <dd>{libelle("BudgetOrigine", mouvement.origine)}</dd>
      </dl>
      {encaissement && <EncaisserRecette recetteId={mouvement.id} comptes={encaissement.comptes} dateDefaut={encaissement.aujourdhui} />}
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
