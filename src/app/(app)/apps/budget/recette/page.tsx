import Link from "next/link"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/budget/ecran"
import { BOUTON, MONTANT } from "@/apps/budget/composants/classes"
import { EncaisserRecette } from "@/apps/budget/composants/encaisser"
import { FiltresMouvements, PastillesFiltres } from "@/apps/budget/composants/filtres"
import { pastillesFiltres, type ParametresFiltres } from "@/apps/budget/filtres-url"
import { lireChoix, listerMouvements, type MouvementLu } from "@/apps/budget/lectures-serveur"
import { formatEuros, libelleStatutRecette } from "@/apps/budget/libelles"
import { comptesEncaissement } from "@/apps/budget/regles"
import { jourDeParis } from "@/core/dates"
import { aAuMoins } from "@/core/droits/niveaux"
import { EcranVide } from "@/components/qg/ecran-vide"

// Onglet « Recette » de Budget (brief 3.14, point 3) : les recettes encaissées, puis les prévues, avec leur
// provenance, leur catégorie, leur montant et leur état. Mêmes filtres que la liste des mouvements. Chaque ligne
// mène au mouvement ; la création reste une page, ouverte par le bouton de l'en-tête.

const formatJour = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" })

// Provenance : le contact ou la personne saisis. Une recette proposée par une autre app n'a pas de provenance saisie :
// son libellé porte le nom de la provenance (p. ex. le partenaire), il en tient lieu. Jamais « proposée par une autre app ».
function provenance(recette: MouvementLu): string {
  if (recette.provenanceNom) return recette.provenanceNom
  return recette.origine === "proposee" ? recette.libelle : "Non renseignée"
}

export default async function PageRecettes({ searchParams }: { searchParams: Promise<ParametresFiltres> }) {
  const acces = await accesEcran("ecriture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour aux mouvements", href: "/apps/budget" }} />
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
  const recettes = mouvements.filter((mouvement) => mouvement.type === "recette")
  const encaissees = recettes.filter((recette) => recette.statut === "encaissee")
  const prevues = recettes.filter((recette) => recette.statut === "prevue")
  // Le total ne compte que l'encaissé : une recette prévue n'a pas encore été reçue.
  const totalEncaisse = encaissees.reduce((total, recette) => total + recette.montantCentimes, 0)
  // Encaisser une recette prévue : réservé au niveau gestion, comme sur la liste des mouvements.
  const peutEncaisser = aAuMoins(acces.niveau, "gestion")
  const encaissement = peutEncaisser ? { comptes: comptesEncaissement(choix.payeurs), aujourdhui: jourDeParis(new Date()) } : null
  const pastilles = pastillesFiltres(parametres, choix, "/apps/budget/recette")

  return (
    <section className="flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="titre-rallye text-3xl">Recettes</h1>
        <Link href="/apps/budget/recette/nouvelle" className={BOUTON}>
          Nouvelle recette
        </Link>
      </header>

      <FiltresMouvements
        saisons={choix.saisons.map((saison) => ({ id: saison.id, annee: saison.annee }))}
        epreuves={choix.epreuves.filter((epreuve) => !saisonId || epreuve.seasonId === saisonId).map(({ id, nom }) => ({ id, nom }))}
        categories={choix.categoriesRecette.map(({ id, nom }) => ({ id, nom }))}
        membres={choix.payeurs.filter((payeur) => payeur.type === "membre").map(({ id, nom }) => ({ id, nom }))}
        valeurs={{ saison: saisonId ?? "", epreuve: parametres.epreuve ?? "", categorie: parametres.categorie ?? "", membre: parametres.membre ?? "" }}
        afficherMembres={toutVisible}
        nombreActifs={pastilles.length}
        pastilles={<PastillesFiltres pastilles={pastilles} />}
      />

      <dl className="w-fit min-w-56 rounded-lg border border-bordure bg-surface px-4 py-3 text-sm" aria-label="Total des recettes de la sélection">
        <div className="flex items-baseline justify-between gap-6">
          <dt className="text-texte-discret">Total encaissé</dt>
          <dd className={`${MONTANT} text-base text-etat-ok sm:text-lg`}>{formatEuros(totalEncaisse)}</dd>
        </div>
      </dl>

      {recettes.length === 0 && <p className="text-sm text-texte-discret">Aucune recette pour ce choix.</p>}
      {encaissees.length > 0 && <ListeRecettes titre="Encaissées" recettes={encaissees} encaissement={null} />}
      {prevues.length > 0 && <ListeRecettes titre="Prévues" recettes={prevues} encaissement={encaissement} />}
    </section>
  )
}

function ListeRecettes({
  titre,
  recettes,
  encaissement,
}: {
  titre: string
  recettes: MouvementLu[]
  encaissement: { comptes: Array<{ id: string; nom: string; parDefaut: boolean }>; aujourdhui: string } | null
}) {
  return (
    <section className="flex flex-col gap-2" aria-label={titre}>
      <h2 className="text-base font-medium">
        {titre} <span className="font-normal text-texte-discret">({recettes.length})</span>
      </h2>
      <ul className="flex flex-col divide-y divide-bordure rounded-lg border border-bordure bg-surface">
        {recettes.map((recette) => (
          <li key={recette.id}>
            <Link href={`/apps/budget/mouvement/${recette.id}`} className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2">
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{provenance(recette)}</span>
                {provenance(recette) !== recette.libelle && <span className="truncate text-sm">{recette.libelle}</span>}
                <span className="text-xs text-texte-discret">
                  {formatJour.format(new Date(`${recette.date}T00:00:00Z`))} · {recette.categorieNom} · {libelleStatutRecette(recette)}
                </span>
              </span>
              <span className={`${MONTANT} shrink-0 text-etat-ok`}>+ {formatEuros(recette.montantCentimes)}</span>
            </Link>
            {encaissement && recette.statut === "prevue" && (
              <div className="px-4 pb-3">
                <EncaisserRecette recetteId={recette.id} comptes={encaissement.comptes} dateDefaut={encaissement.aujourdhui} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
