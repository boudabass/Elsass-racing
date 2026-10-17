import { contexteQg, donneesQg } from "@/core/qg/donnees"
import { modeTerrainDuMembre } from "@/apps/settings/preferences-serveur"
import { rechercher, grouperParApp } from "@/core/recherche/recherche-serveur"
import { iconeApp } from "@/components/qg/icones"

export default async function PageRecherche({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams
  const { contexte } = await contexteQg()
  const terrain = await modeTerrainDuMembre(contexte)
  const donnees = await donneesQg(terrain)

  const requete = q.trim()
  const resultats = requete ? await rechercher(contexte, requete) : []

  // Un résultat n'est montré que si l'app de sa fiche est visible pour ce membre.
  const visibles = new Set<string>(donnees.apps.map((a) => a.manifeste.cle))
  const groupes = grouperParApp(resultats.filter((r) => visibles.has(r.app)))
  const nombre = Object.values(groupes).reduce((somme, liste) => somme + liste.length, 0)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="titre-rallye text-3xl md:text-4xl">Recherche</h1>

      <form action="/recherche" role="search" className="flex gap-2">
        <label htmlFor="recherche" className="sr-only">
          Rechercher dans la team
        </label>
        <input
          id="recherche"
          name="q"
          type="search"
          defaultValue={requete}
          autoFocus
          placeholder="Une épreuve, un pilote, une pièce…"
          className="cible-tactile w-full rounded-md border border-bordure-champ bg-surface px-4 py-2 text-texte placeholder:text-texte-discret"
        />
        <button type="submit" className="cible-tactile rounded-md bg-marque px-5 py-2 font-medium text-marque-texte hover:opacity-90">
          Chercher
        </button>
      </form>

      {requete && nombre === 0 && <p className="py-8 text-center text-texte-discret">Aucun résultat pour « {requete} ».</p>}

      {nombre > 0 &&
        Object.entries(groupes).map(([cleApp, liste]) => {
          const app = donnees.apps.find((a) => a.manifeste.cle === cleApp)
          const Icone = app ? iconeApp(app.manifeste.icone) : null
          return (
            <section key={cleApp} aria-label={app?.manifeste.nom ?? cleApp} className="flex flex-col gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-texte-discret">
                {Icone && <Icone className="h-4 w-4" aria-hidden />}
                {app?.manifeste.nom ?? cleApp}
              </h2>
              <ul className="flex flex-col gap-2">
                {liste.map((resultat) => (
                  <li key={`${resultat.ficheType}-${resultat.ficheId}`} className="rounded-lg border border-bordure bg-surface p-4">
                    <p className="font-medium">{resultat.titre}</p>
                    <p className="line-clamp-2 text-sm text-texte-discret">{resultat.texte}</p>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
    </div>
  )
}
