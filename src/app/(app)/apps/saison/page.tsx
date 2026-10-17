import Link from "next/link"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/saison/ecran"
import { listerEpreuves, listerSaisons } from "@/apps/saison/lectures-serveur"
import { FiltresCalendrier } from "@/apps/saison/composants/filtres"
import { FormulaireNouvelleSaison } from "@/apps/saison/composants/saisons"
import { resteAFaire } from "@/apps/saison/reste-a-faire"
import { jourDeParis } from "@/core/dates"
import { jourCivil, prochaineEpreuve, type StatutEpreuve } from "@/apps/saison/regles"
import { LIBELLE_STATUT_EPREUVE, LIBELLE_TYPE_EPREUVE, libelle } from "@/apps/saison/libelles"
import { EcranVide } from "@/components/qg/ecran-vide"
import { aAuMoins } from "@/core/droits/niveaux"

// Calendrier de Saison : liste par défaut, vue mois en bascule, filtres saison, type, statut.
// Les filtres sont des formulaires GET : l'écran fonctionne sans JavaScript.


const COULEUR_STATUT: Record<StatutEpreuve, string> = {
  envisagee: "text-texte-discret",
  en_cours: "text-etat-ok",
  terminee: "text-texte",
  annulee: "text-texte-discret",
}


const formatJour = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" })

// Jours entre aujourd'hui (Paris) et le premier jour de l'épreuve, pour le compte à rebours.
function compteARebours(dateDebut: Date, dateFin: Date): string {
  const aujourdhui = jourDeParis(new Date())
  const jourDebut = jourCivil(dateDebut)
  if (aujourdhui >= jourDebut && aujourdhui <= jourCivil(dateFin)) return "En cours"
  if (aujourdhui > jourCivil(dateFin)) return "Passée"
  const jours = Math.round((Date.parse(`${jourDebut}T00:00:00Z`) - Date.parse(`${aujourdhui}T00:00:00Z`)) / 86_400_000)
  return jours === 1 ? "Demain" : `Dans ${jours} jours`
}

function moisDe(epreuve: { dateDebut: Date }): string {
  return jourCivil(epreuve.dateDebut).slice(0, 7)
}

export default async function PageCalendrier({
  searchParams,
}: {
  searchParams: Promise<{ saison?: string; type?: string; statut?: string; vue?: string; mois?: string }>
}) {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }
  const parametres = await searchParams
  const { saisons } = await listerSaisons()
  const saisonCourante = saisons.find((saison) => saison.enCours) ?? saisons[0] ?? null
  const saisonId = parametres.saison ?? saisonCourante?.id ?? null

  // Team sans saison : aucun chemin n'existait pour en ouvrir une. Le formulaire est celui de l'historique (gestion).
  if (saisons.length === 0) {
    const peutCreer = aAuMoins(acces.niveau, "gestion")
    return (
      <section className="flex max-w-xl flex-col items-start gap-6">
        <h1 className="font-titre text-2xl uppercase">Saison</h1>
        <p className="text-texte-discret">
          Aucune saison pour cette team. Ouvre la première saison : ses épreuves s'y rangeront.
        </p>
        {peutCreer ? (
          <div className="flex w-full flex-col gap-3">
            <h2 className="font-medium">Créer la saison</h2>
            <FormulaireNouvelleSaison prochaineAnnee={new Date().getUTCFullYear()} />
          </div>
        ) : (
          <p className="text-sm text-texte-discret">Le responsable ou un gestionnaire ouvre la saison.</p>
        )}
      </section>
    )
  }

  const { epreuves: toutes } = await listerEpreuves(saisonId)
  const epreuves = toutes.filter(
    (epreuve) =>
      (!parametres.type || epreuve.type === parametres.type) && (!parametres.statut || epreuve.statut === parametres.statut),
  )
  const peutEcrire = aAuMoins(acces.niveau, "ecriture")
  const lienNouvelle = "/apps/saison/nouvelle"

  if (toutes.length === 0) {
    return (
      <section className="flex max-w-xl flex-col items-start gap-4">
        <h1 className="font-titre text-2xl uppercase">Saison</h1>
        <p className="text-texte-discret">Ajoute ta première épreuve : elle prend ses dates, son lieu et ses engagements.</p>
        {peutEcrire && (
          <Link href={lienNouvelle} className="inline-flex min-h-11 items-center rounded-md bg-marque px-4 py-3 font-medium text-marque-texte">
            Ajouter une épreuve
          </Link>
        )}
      </section>
    )
  }

  const prochaine = prochaineEpreuve(
    epreuves.map((epreuve) => ({ ...epreuve, engagements: epreuve.engagements.map((engagement) => engagement.statut) })),
    new Date(),
  )
  const vueMois = parametres.vue === "mois"
  const moisAffiche = parametres.mois ?? (prochaine ? moisDe(prochaine) : jourCivil(new Date()).slice(0, 7))

  return (
    <section className="flex max-w-4xl flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-titre text-2xl uppercase">Saison {saisonCourante?.annee ?? ""}</h1>
        {peutEcrire && (
          <Link href={lienNouvelle} className="inline-flex min-h-11 items-center rounded-md bg-marque px-4 py-2 text-sm font-medium text-marque-texte">
            Ajouter une épreuve
          </Link>
        )}
      </header>

      {prochaine && (
        <Link
          href={`/apps/saison/epreuves/${prochaine.id}`}
          className="flex flex-col gap-1 rounded-lg border border-bordure bg-surface px-4 py-3"
        >
          <span className="text-xs uppercase text-texte-discret">Prochaine épreuve</span>
          <span className="font-medium">{prochaine.nom}</span>
          <span className="text-sm tabular-nums">
            {formatJour.format(prochaine.dateDebut)} · {compteARebours(prochaine.dateDebut, prochaine.dateFin)}
          </span>
        </Link>
      )}

      <div className="flex flex-wrap items-end gap-3 text-sm">
        <FiltresCalendrier
          saisons={saisons}
          saisonId={saisonId}
          type={parametres.type ?? ""}
          statut={parametres.statut ?? ""}
          types={LIBELLE_TYPE_EPREUVE}
          statuts={LIBELLE_STATUT_EPREUVE}
        />
        <div className="ml-auto flex gap-2">
          <Link
            href={{ query: { ...parametres, vue: "liste", mois: undefined } }}
            className={`min-h-11 rounded-md border px-3 py-2 ${!vueMois ? "border-marque" : "border-bordure"}`}
          >
            Liste
          </Link>
          <Link
            href={{ query: { ...parametres, vue: "mois", mois: moisAffiche } }}
            className={`min-h-11 rounded-md border px-3 py-2 ${vueMois ? "border-marque" : "border-bordure"}`}
          >
            Mois
          </Link>
        </div>
      </div>

      {vueMois ? (
        <VueMois mois={moisAffiche} epreuves={epreuves} parametres={parametres} />
      ) : (
        <ul className="flex flex-col divide-y divide-bordure rounded-lg border border-bordure bg-surface">
          {epreuves.length === 0 && <li className="px-4 py-6 text-texte-discret">Aucune épreuve ne correspond à ces filtres.</li>}
          {epreuves.map((epreuve) => {
            const reste = resteAFaire({
              statut: epreuve.statut,
              engagements: epreuve.engagements.map((engagement) => ({ statut: engagement.statut, resultat: engagement.resultat })),
            })
            return (
              <li key={epreuve.id}>
                <Link href={`/apps/saison/epreuves/${epreuve.id}`} className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr_auto] sm:items-center">
                  <span className="text-sm tabular-nums text-texte-discret">
                    {formatJour.format(epreuve.dateDebut)} – {formatJour.format(epreuve.dateFin)}
                  </span>
                  <span className="flex flex-col">
                    <span className="font-medium">{epreuve.nom}</span>
                    <span className="text-sm text-texte-discret">
                      {libelle(LIBELLE_TYPE_EPREUVE, epreuve.type)}
                      {epreuve.lieu ? ` · ${epreuve.lieu}` : ""}
                    </span>
                  </span>
                  <span className="flex flex-col items-start gap-1 text-sm sm:items-end">
                    <span className={COULEUR_STATUT[epreuve.statut]}>{LIBELLE_STATUT_EPREUVE[epreuve.statut]}</span>
                    {reste && <span className="font-medium text-etat-orange">{reste}</span>}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// Vue mois : une grille de 6 semaines, lundi en premier. Chaque épreuve est un lien sur son premier jour.
function VueMois({
  mois,
  epreuves,
  parametres,
}: {
  mois: string
  epreuves: Array<{ id: string; nom: string; dateDebut: Date; dateFin: Date }>
  parametres: Record<string, string | undefined>
}) {
  const [annee, numeroMois] = mois.split("-").map(Number)
  const premier = new Date(Date.UTC(annee, numeroMois - 1, 1))
  const decalage = (premier.getUTCDay() + 6) % 7
  const cases = Array.from({ length: 42 }, (_, index) => new Date(Date.UTC(annee, numeroMois - 1, 1 - decalage + index)))
  const moisPrecedent = jourCivil(new Date(Date.UTC(annee, numeroMois - 2, 1))).slice(0, 7)
  const moisSuivant = jourCivil(new Date(Date.UTC(annee, numeroMois, 1))).slice(0, 7)
  const libelleMois = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(premier)

  return (
    <section className="flex flex-col gap-3">
      <nav className="flex items-center justify-between">
        <Link href={{ query: { ...parametres, vue: "mois", mois: moisPrecedent } }} className="min-h-11 px-3 py-2">
          ←
        </Link>
        <h2 className="font-medium capitalize">{libelleMois}</h2>
        <Link href={{ query: { ...parametres, vue: "mois", mois: moisSuivant } }} className="min-h-11 px-3 py-2">
          →
        </Link>
      </nav>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-bordure bg-bordure text-xs">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((jour) => (
          <div key={jour} className="bg-surface px-1 py-2 text-center text-texte-discret">
            {jour}
          </div>
        ))}
        {cases.map((jour) => {
          const cle = jourCivil(jour)
          const du = epreuves.filter((epreuve) => jourCivil(epreuve.dateDebut) <= cle && cle <= jourCivil(epreuve.dateFin))
          const horsMois = jour.getUTCMonth() !== numeroMois - 1
          return (
            <div key={cle} className={`min-h-16 bg-surface p-1 ${horsMois ? "opacity-40" : ""}`}>
              <span className="tabular-nums">{jour.getUTCDate()}</span>
              {du.map((epreuve) => (
                <Link key={epreuve.id} href={`/apps/saison/epreuves/${epreuve.id}`} className="mt-1 block truncate rounded border border-marque px-1">
                  {epreuve.nom}
                </Link>
              ))}
            </div>
          )
        })}
      </div>
    </section>
  )
}
