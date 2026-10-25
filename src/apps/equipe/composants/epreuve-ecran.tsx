import Link from "next/link"

import { jourEnFrancais } from "@/core/dates"
import { LIEN } from "@/lib/classes-formulaire"

import { AffecterPersonne, BasculerTache, RetirerAffectation } from "./formulaires-vivier-epreuve"
import type { PageEpreuve } from "../lectures-ecran"

// Prochaine épreuve (tâche 5.2) : qui vient, l'équipage choisi dans Saison, et les affectations de l'assistance avec
// leurs tâches liées. Le pilote et le copilote ne s'affectent pas ici : ils se choisissent sur l'engagement, dans Saison.

const RAISON_ECRITURE = "Il faut le niveau écriture sur Équipe pour affecter ou retirer une personne."

function Liste({ titre, noms }: { titre: string; noms: string[] }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm text-texte-discret">
        {titre} <span className="chiffre font-semibold text-texte">{noms.length}</span>
      </p>
      {noms.length > 0 && <p className="text-sm">{noms.join(", ")}</p>}
    </div>
  )
}

export function PageEpreuveEcran({ donnees }: { donnees: PageEpreuve }) {
  const { epreuve, presence } = donnees
  if (!epreuve) {
    return (
      <section className="flex w-full max-w-4xl flex-col gap-4">
        <h1 className="titre-rallye text-3xl">Prochaine épreuve</h1>
        <p className="text-texte-discret">Aucune épreuve à venir pour le moment. Elle apparaît ici dès qu&apos;elle est envisagée dans Saison.</p>
      </section>
    )
  }

  const peutEcrire = donnees.peutEcrire
  return (
    <section className="flex w-full max-w-4xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="titre-rallye text-3xl">{epreuve.nom}</h1>
        <p className="text-texte-discret">
          Prochaine épreuve · {jourEnFrancais(epreuve.dateDebut)}
        </p>
      </header>

      <section aria-labelledby="presence-titre" className="flex flex-col gap-3">
        <h2 id="presence-titre" className="text-lg font-semibold">
          Présence
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Liste titre="Viennent" noms={presence.vient} />
          <Liste titre="Peut-être" noms={presence.peutEtre} />
          <Liste titre="Ne viennent pas" noms={presence.neVientPas} />
          <Liste titre="Sans réponse" noms={presence.sansReponse} />
        </div>
      </section>

      <section aria-labelledby="equipage-titre" className="flex flex-col gap-3">
        <h2 id="equipage-titre" className="text-lg font-semibold">
          Équipage
        </h2>
        {donnees.equipage.length === 0 ? (
          <p className="text-sm text-texte-discret">
            Pas encore d&apos;engagement. Le pilote et le copilote se choisissent sur l&apos;engagement, dans Saison.
          </p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {donnees.equipage.map((ligne) => (
              <li key={ligne.engagementId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-bordure p-3">
                <span>
                  Pilote : <span className="font-semibold">{ligne.pilote ?? "non désigné"}</span> · Copilote :{" "}
                  <span className="font-semibold">{ligne.copilote ?? "non désigné"}</span>
                </span>
                <Link href={`/apps/saison/engagements/${ligne.engagementId}`} className={LIEN}>
                  Voir l&apos;engagement
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="affectations-titre" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="affectations-titre" className="text-lg font-semibold">
            Affectations
          </h2>
          <AffecterPersonne
            eventId={epreuve.eventId}
            personnes={donnees.personnes}
            roles={donnees.roles}
            desactive={!peutEcrire}
            raison={peutEcrire ? null : RAISON_ECRITURE}
          />
        </div>
        {donnees.affectations.length === 0 ? (
          <p className="text-sm text-texte-discret">Personne n&apos;est affecté à cette épreuve pour l&apos;instant.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {donnees.affectations.map((affectation) => (
              <li key={affectation.id} className="flex flex-col gap-3 rounded-lg border border-bordure bg-surface p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">{affectation.nom}</p>
                  <p className="text-sm text-texte-discret">{affectation.roleLibelle}</p>
                </div>
                {affectation.taches.length > 0 && (
                  <ul className="flex flex-col gap-2">
                    {affectation.taches.map((tache) => (
                      <li key={tache.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                        <span className={tache.fait ? "text-texte-discret line-through" : ""}>
                          {tache.titre} · {tache.fait ? "fait" : "à faire"}
                        </span>
                        <BasculerTache
                          id={tache.id}
                          fait={tache.fait}
                          desactive={!tache.peutChanger}
                          raison={tache.peutChanger ? null : "Seule la personne affectée, ou qui a l'écriture sur Équipe, la coche."}
                        />
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap gap-2">
                  <RetirerAffectation
                    id={affectation.id}
                    nom={affectation.nom}
                    role={affectation.roleLibelle}
                    desactive={!peutEcrire}
                    raison={peutEcrire ? null : RAISON_ECRITURE}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}
