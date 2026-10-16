import Link from "next/link"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/budget/ecran"
import { lireChoix, lireCoutsParEpreuve } from "@/apps/budget/lectures-serveur"
import { formatEuros } from "@/apps/budget/libelles"
import { jourDeParis } from "@/apps/saison/regles"
import { EcranVide } from "@/components/qg/ecran-vide"

// Coût réel de chaque épreuve de la saison : total, détail par catégorie en barres horizontales,
// et moyenne d'un rallye.

export default async function PageParEpreuve({ searchParams }: { searchParams: Promise<{ saison?: string }> }) {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }
  const parametres = await searchParams
  const choix = await lireChoix()
  const anneeCourante = Number(jourDeParis(new Date()).slice(0, 4))
  const saisonId = parametres.saison ?? choix.saisons.find((saison) => saison.annee === anneeCourante)?.id ?? choix.saisons[0]?.id ?? null
  const { epreuves, moyenneRallye } = saisonId ? await lireCoutsParEpreuve(saisonId) : { epreuves: [], moyenneRallye: null }
  const maximum = Math.max(1, ...epreuves.flatMap((epreuve) => epreuve.parCategorie.map((ligne) => ligne.montant)))

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

      <p className="text-sm text-texte-discret">
        {moyenneRallye === null ? "Pas encore de rallye avec des dépenses." : `Coût moyen d'un rallye : ${formatEuros(moyenneRallye)}.`}
      </p>

      {epreuves.length === 0 && <p className="text-texte-discret">Aucune épreuve pour cette saison.</p>}
      <ul className="flex flex-col gap-4">
        {epreuves.map((epreuve) => (
          <li key={epreuve.id} className="flex flex-col gap-3 rounded-lg border border-bordure bg-surface p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Link href={`/apps/budget?epreuve=${epreuve.id}`} className="font-medium hover:underline">
                {epreuve.nom}
              </Link>
              <span className="font-mono tabular-nums">{formatEuros(epreuve.total)}</span>
            </div>
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
        ))}
      </ul>
    </section>
  )
}
