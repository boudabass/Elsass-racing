import Link from "next/link"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/budget/ecran"
import { lireChoix, lireCoutsParEpreuve } from "@/apps/budget/lectures-serveur"
import { coutAuKm, ecartPrevisionnel } from "@/apps/budget/regles"
import { formatEuros, LIBELLE_ECART } from "@/apps/budget/libelles"
import { lireKmChronometresValides } from "@/apps/saison/lectures-serveur"
import { jourDeParis } from "@/core/dates"
import { EcranVide } from "@/components/qg/ecran-vide"

// Coût réel de chaque épreuve de la saison : total, prévu quand il existe (avec l'écart en couleur),
// détail par catégorie en barres horizontales, coût moyen d'un rallye et coût du km chronométré.
// Les km viennent des résultats validés de Saison (fonction de lecture de Saison, jamais une requête directe).

const COULEUR: Record<string, string> = { vert: "text-etat-ok", orange: "text-etat-orange", rouge: "text-etat-rouge" }

export default async function PageParEpreuve({ searchParams }: { searchParams: Promise<{ saison?: string }> }) {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }
  const parametres = await searchParams
  const choix = await lireChoix()
  const anneeCourante = Number(jourDeParis(new Date()).slice(0, 4))
  const saisonId = parametres.saison ?? choix.saisons.find((saison) => saison.annee === anneeCourante)?.id ?? choix.saisons[0]?.id ?? null
  const donnees = saisonId ? await lireCoutsParEpreuve(saisonId) : null
  const km = saisonId ? await lireKmChronometresValides(saisonId) : 0
  const epreuves = donnees?.epreuves ?? []
  const maximum = Math.max(1, ...epreuves.flatMap((epreuve) => epreuve.parCategorie.map((ligne) => ligne.montant)))
  const coutKm = donnees ? coutAuKm(donnees.totalSaisonCentimes, km) : null

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="titre-rallye text-3xl">Par épreuve</h1>
        <form className="flex items-center gap-2 text-sm">
          <label htmlFor="saison" className="text-texte-discret">
            Saison
          </label>
          <select id="saison" name="saison" defaultValue={saisonId ?? ""} className="min-h-11 rounded-md border border-bordure bg-surface px-3">
            {choix.saisons.map((saison) => (
              <option key={saison.id} value={saison.id}>
                {saison.annee}
              </option>
            ))}
          </select>
          <button type="submit" className="cible-tactile rounded-md border border-bordure px-3">
            Voir
          </button>
        </form>
      </header>

      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-lg border border-bordure bg-surface p-4">
          <dt className="text-texte-discret">Coût moyen d&apos;un rallye</dt>
          <dd className="font-mono tabular-nums">{donnees?.moyenneRallye === null || donnees?.moyenneRallye === undefined ? "Pas encore de rallye chiffré" : formatEuros(donnees.moyenneRallye)}</dd>
        </div>
        <div className="rounded-lg border border-bordure bg-surface p-4">
          <dt className="text-texte-discret">Coût du km chronométré</dt>
          <dd className="font-mono tabular-nums">{coutKm === null ? "Pas encore de km validés" : `${formatEuros(coutKm)} / km`}</dd>
        </div>
        <div className="rounded-lg border border-bordure bg-surface p-4">
          <dt className="text-texte-discret">Km chronométrés validés</dt>
          <dd className="font-mono tabular-nums">{km.toFixed(1)} km</dd>
        </div>
      </dl>

      {epreuves.length === 0 && <p className="text-texte-discret">Aucune épreuve pour cette saison.</p>}
      <ul className="flex flex-col gap-4">
        {epreuves.map((epreuve) => {
          const ecart = epreuve.prevuCentimes !== null ? ecartPrevisionnel(epreuve.prevuCentimes, epreuve.total) : null
          return (
            <li key={epreuve.id} className="flex flex-col gap-3 rounded-lg border border-bordure bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={`/apps/budget?epreuve=${epreuve.id}`} className="font-medium hover:underline">
                  {epreuve.nom}
                </Link>
                <span className="font-mono tabular-nums">
                  {formatEuros(epreuve.total)}
                  {epreuve.prevuCentimes !== null && <span className="text-texte-discret"> · prévu {formatEuros(epreuve.prevuCentimes)}</span>}
                </span>
              </div>
              {ecart && (
                <p className={`text-sm font-medium ${COULEUR[ecart.couleur] ?? ""}`}>
                  {LIBELLE_ECART[ecart.couleur]}
                  {ecart.pourcent !== null ? ` · ${Math.round(ecart.pourcent)} % du prévu` : ""}
                </p>
              )}
              {epreuve.parCategorie.length === 0 ? (
                <p className="text-sm text-texte-discret">Aucune dépense confirmée.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {epreuve.parCategorie.map((ligne) => (
                    <li key={ligne.categorieId} className="grid grid-cols-[8rem_1fr_auto] items-center gap-3 text-sm">
                      <span className="truncate">{ligne.nom}</span>
                      <span className="h-3 rounded bg-surface-2" aria-hidden>
                        <span className="block h-3 rounded bg-marque" style={{ width: `${(ligne.montant / maximum) * 100}%` }} />
                      </span>
                      <span className="font-mono tabular-nums">{formatEuros(ligne.montant)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
