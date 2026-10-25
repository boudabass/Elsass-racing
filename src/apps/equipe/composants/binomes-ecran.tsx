import type { PageBinomes } from "../lectures-ecran"

// Binômes (tâche 5.2) : un pilote et son copilote, avec leurs chiffres sur les épreuves à résultat validé.
// Lecture seule : l'équipage se choisit dans Saison, sur l'engagement.

const NOMBRE = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 })

export function PageBinomesEcran({ donnees }: { donnees: PageBinomes }) {
  return (
    <section className="flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="titre-rallye text-3xl">Binômes</h1>
        <p className="text-sm text-texte-discret">
          Pilote et copilote, sur les épreuves à résultat validé dans Saison. L&apos;équipage se choisit sur l&apos;engagement, dans Saison.
        </p>
      </header>

      {donnees.binomes.length === 0 ? (
        <p className="text-texte-discret">Pas encore de binôme avec un résultat validé.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {donnees.binomes.map((binome) => (
            <li key={binome.cle} className="flex flex-col gap-3 rounded-lg border border-bordure bg-surface p-4">
              <div className="flex flex-col gap-1 text-sm">
                <p>
                  <span className="text-texte-discret">Pilote : </span>
                  <span className="font-semibold">{binome.pilote}</span>
                </p>
                <p>
                  <span className="text-texte-discret">Copilote : </span>
                  <span className="font-semibold">{binome.copilote}</span>
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-texte-discret">Épreuves</dt>
                  <dd className="chiffre font-semibold">{binome.stats.epreuvesCommunes}</dd>
                </div>
                <div>
                  <dt className="text-texte-discret">Arrivées</dt>
                  <dd className="chiffre font-semibold">{binome.stats.arriveesEnsemble}</dd>
                </div>
                <div>
                  <dt className="text-texte-discret">Km chronométrés</dt>
                  <dd className="chiffre font-semibold">{NOMBRE.format(binome.stats.kmEnsemble)} km</dd>
                </div>
                <div>
                  <dt className="text-texte-discret">Meilleur résultat</dt>
                  <dd className="chiffre font-semibold">
                    {binome.stats.meilleurResultat === null ? (
                      <>
                        <span aria-hidden="true">—</span>
                        <span className="sr-only">pas encore de classement</span>
                      </>
                    ) : (
                      binome.stats.meilleurResultat
                    )}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
