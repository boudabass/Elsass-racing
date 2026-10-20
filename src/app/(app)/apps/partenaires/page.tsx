import Link from "next/link"
import { Handshake, Lock } from "lucide-react"

import { accesEcran } from "@/apps/partenaires/ecran"
import { CarteProspect, LigneProspect, WidgetsProspection } from "@/apps/partenaires/composants/prospection"
import { filtreStatut, LIBELLES_STATUT_PARTENAIRE, STATUTS_COLONNES, STATUTS_PARTENAIRE, STATUTS_REPLIES, compterParStatut, trierProspection } from "@/apps/partenaires/affichage"
import { listerPartenaires } from "@/apps/partenaires/lectures-serveur"
import { widgetContrepartiesEnRetard, widgetPartenairesActifs, widgetRelancesSemaine } from "@/apps/partenaires/widgets-serveur"
import { jourParis } from "@/apps/partenaires/regles"
import { EcranVide } from "@/components/qg/ecran-vide"
import { LIEN } from "@/lib/classes-formulaire"

// Prospection : la liste par défaut, la vue en colonnes à partir de lg (sans glisser-déposer). Le filtre par statut
// et la vue sont gardés dans l'URL. Les trois widgets sont en tête de page.
function lienProspection({ statut, vue }: { statut?: string | null; vue?: "colonnes" | null }) {
  const parametres = new URLSearchParams()
  if (statut) parametres.set("statut", statut)
  if (vue) parametres.set("vue", vue)
  const texte = parametres.toString()
  return texte ? `/apps/partenaires?${texte}` : "/apps/partenaires"
}

const PASTILLE = "cible-tactile inline-flex shrink-0 items-center gap-2 rounded-full border px-4 text-sm"
const CLASSE_VUE = (choisie: boolean) => `cible-tactile px-4 text-sm ${choisie ? "bg-surface-2 font-medium text-texte" : "text-texte-discret"}`

export default async function PageProspection({ searchParams }: { searchParams: Promise<{ statut?: string; vue?: string }> }) {
  const parametres = await searchParams
  const acces = await accesEcran("ecriture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }

  const tous = await listerPartenaires()
  if (tous.length === 0) {
    return (
      <EcranVide
        icone={Handshake}
        titre="Prospection"
        lignes={["Aucun partenaire pour l'instant. Ajoute ton premier prospect : il suffit du nom de l'entreprise."]}
        action={{ libelle: "Ajouter un prospect", href: "/apps/partenaires/nouveau" }}
      />
    )
  }

  const aujourdhui = jourParis(new Date())
  const [relances, retards, actifs] = await Promise.all([widgetRelancesSemaine(), widgetContrepartiesEnRetard(), widgetPartenairesActifs()])
  const compte = compterParStatut(tous)
  const statut = filtreStatut(parametres.statut)
  const enColonnes = parametres.vue === "colonnes"
  const visibles = statut ? tous.filter((partenaire) => partenaire.statut === statut) : tous
  const triees = trierProspection(visibles, aujourdhui)

  return (
    <section className="flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="titre-rallye text-3xl">Prospection</h1>
        <p className="text-texte-discret">Les entreprises à qui la team propose un partenariat.</p>
      </div>

      <WidgetsProspection relances={relances} retards={retards} actifs={actifs} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filtrer par statut" className="-mx-4 flex w-[calc(100%+2rem)] gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:w-auto md:flex-wrap md:px-0">
          <Link href={lienProspection({ vue: enColonnes ? "colonnes" : null })} aria-current={statut === null ? "page" : undefined} className={`${PASTILLE} ${statut === null ? "border-marque bg-marque text-marque-texte" : "border-bordure"}`}>
            Tous <span>{compte.total}</span>
          </Link>
          {STATUTS_PARTENAIRE.map((choix) => (
            <Link
              key={choix}
              href={lienProspection({ statut: choix, vue: enColonnes ? "colonnes" : null })}
              aria-current={statut === choix ? "page" : undefined}
              className={`${PASTILLE} ${statut === choix ? "border-marque bg-marque text-marque-texte" : "border-bordure"}`}
            >
              {LIBELLES_STATUT_PARTENAIRE[choix]} <span>{compte[choix]}</span>
            </Link>
          ))}
        </nav>

        {/* La bascule n'apparaît qu'à partir de lg : en dessous, la liste reste la seule vue. */}
        {/* Sélecteur segmenté : un formulaire GET, donc il marche sans JavaScript, et chaque bouton dit s'il est choisi. */}
        <form method="get" aria-label="Affichage" className="hidden lg:flex">
          {statut && <input type="hidden" name="statut" value={statut} />}
          <div role="group" aria-label="Affichage" className="inline-flex w-fit overflow-hidden rounded-md border border-bordure">
            <button type="submit" name="vue" value="liste" aria-pressed={!enColonnes} className={CLASSE_VUE(!enColonnes)}>
              Liste
            </button>
            <button type="submit" name="vue" value="colonnes" aria-pressed={enColonnes} className={CLASSE_VUE(enColonnes)}>
              Colonnes
            </button>
          </div>
        </form>
      </div>

      {visibles.length === 0 ? (
        <p className="text-texte-discret">Aucun partenaire avec ce statut.</p>
      ) : (
        <>
          {/* Vue liste : seule vue sur téléphone, et par défaut à partir de lg. */}
          <ul className={`flex flex-col gap-2 ${enColonnes ? "lg:hidden" : ""}`}>
            {triees.map((partenaire) => (
              <LigneProspect key={partenaire.id} partenaire={partenaire} aujourdhui={aujourdhui} />
            ))}
          </ul>

          {/* Vue en colonnes : une colonne par statut, « Refus » et « Ancien partenaire » repliées en bas. */}
          <div className={enColonnes ? "hidden lg:flex lg:flex-col lg:gap-6" : "hidden"}>
            <div className="grid grid-cols-5 items-start gap-4">
              {STATUTS_COLONNES.map((colonne) => {
                const cartes = trierProspection(
                  visibles.filter((partenaire) => partenaire.statut === colonne),
                  aujourdhui,
                )
                return (
                  <section key={colonne} aria-labelledby={`colonne-${colonne}`} className="flex min-w-0 flex-col gap-3">
                    <h2 id={`colonne-${colonne}`} className="flex items-baseline justify-between gap-2 border-b border-bordure pb-2 font-medium">
                      {LIBELLES_STATUT_PARTENAIRE[colonne]}
                      <span className="text-sm text-texte-discret">{compte[colonne]}</span>
                    </h2>
                    {cartes.length === 0 ? (
                      <p className="text-sm text-texte-discret">Aucun</p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {cartes.map((partenaire) => (
                          <CarteProspect key={partenaire.id} partenaire={partenaire} aujourdhui={aujourdhui} />
                        ))}
                      </ul>
                    )}
                  </section>
                )
              })}
            </div>
            {STATUTS_REPLIES.map((colonne) => {
              const cartes = trierProspection(
                visibles.filter((partenaire) => partenaire.statut === colonne),
                aujourdhui,
              )
              if (cartes.length === 0) return null
              return (
                <section key={colonne} className="flex flex-col gap-3">
                  <h2 className="font-medium">
                    {LIBELLES_STATUT_PARTENAIRE[colonne]} ({cartes.length})
                  </h2>
                  <ul className="grid grid-cols-3 gap-2">
                    {cartes.map((partenaire) => (
                      <CarteProspect key={partenaire.id} partenaire={partenaire} aujourdhui={aujourdhui} />
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        </>
      )}

      <div>
        <Link href="/apps/partenaires/nouveau" className={LIEN}>
          Ajouter un prospect
        </Link>
      </div>
    </section>
  )
}
