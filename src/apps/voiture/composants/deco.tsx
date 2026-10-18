import { notFound } from "next/navigation"

import { lireVehicule } from "../lectures-serveur"
import { COULEUR_STATUT_EMPLACEMENT, LIBELLE_STATUT_EMPLACEMENT, TITRE_VUE, dimensionsDe } from "../libelles"

// Ordre des groupes. La vue gauche n'a pas de groupe : ses emplacements sont les copies symétriques de la vue droite.
const GROUPES = ["droite", "avant", "arriere", "dessus", "hors_plan"] as const

// Onglet Déco, en liste en attendant le plan (lot 3.4) : pas d'édition ici.
export async function PanneauDeco({ ficheId }: { ficheId: string }) {
  const fiche = await lireVehicule(ficheId)
  if (!fiche) notFound()
  const emplacements = fiche.emplacements

  if (emplacements.length === 0) {
    return <p className="text-texte-discret">Aucun emplacement défini pour ce véhicule.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-texte-discret">Le plan de la voiture arrive bientôt. Voici la liste de ses emplacements.</p>
      {GROUPES.map((vue) => {
        const dansLeGroupe = emplacements.filter((e) => e.vue === vue)
        if (dansLeGroupe.length === 0) return null
        const toutSymetrique = vue === "droite" && dansLeGroupe.every((e) => e.symetrique)
        const titre = `${TITRE_VUE[vue]}${toutSymetrique ? " (symétrique à gauche)" : ""}`
        return (
          <section key={vue} className="flex flex-col gap-2">
            <h2 className="font-titre text-lg uppercase">{titre}</h2>
            <ul className="flex flex-col divide-y divide-bordure">
              {dansLeGroupe.map((emplacement) => {
                const occupation = emplacement.occupations[0]
                const dimensions = dimensionsDe(emplacement.largeurCm, emplacement.hauteurCm)
                return (
                  <li key={emplacement.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                    <div className="flex flex-col">
                      <p className="font-medium">{emplacement.nom}</p>
                      {dimensions && <p className="text-sm text-texte-discret">{dimensions}</p>}
                      {occupation && <p className="text-sm">{occupation.partenaireNom}</p>}
                    </div>
                    <p className={`text-sm font-medium ${COULEUR_STATUT_EMPLACEMENT[emplacement.statut]}`}>{LIBELLE_STATUT_EMPLACEMENT[emplacement.statut]}</p>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
