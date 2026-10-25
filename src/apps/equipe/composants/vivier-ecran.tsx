import { jourEnFrancais } from "@/core/dates"

import { AjouterVivier, ModifierVivier, RetirerVivier } from "./formulaires-vivier-epreuve"
import { LIBELLE_INTERET } from "../libelles"
import type { PageVivier } from "../lectures-ecran"
import { LIBELLES_ROLE_EPREUVE, ROLES_EPREUVE, type RoleEpreuve } from "../regles"

// Vivier (tâche 5.2, écriture et plus) : des personnes qu'on pourrait appeler pour une épreuve. Ce n'est pas une
// affectation : rien ici ne donne de droit, et rien n'est lu par les autres apps.

const RAISON_ECRITURE = "Il faut le niveau écriture sur Équipe pour gérer le vivier."

export function PageVivierEcran({ donnees, peutEcrire }: { donnees: PageVivier; peutEcrire: boolean }) {
  const roles = ROLES_EPREUVE.map((role: RoleEpreuve) => ({ role, libelle: LIBELLES_ROLE_EPREUVE[role] }))
  return (
    <section className="flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="titre-rallye text-3xl">Vivier</h1>
          <p className="text-sm text-texte-discret">Des personnes qu&apos;on pourrait appeler. Ce n&apos;est pas l&apos;équipe : rien ici ne donne de droit.</p>
        </div>
        <AjouterVivier personnes={donnees.personnes} roles={roles} desactive={!peutEcrire} raison={peutEcrire ? null : RAISON_ECRITURE} />
      </header>

      {donnees.entrees.length === 0 ? (
        <p className="text-texte-discret">Le vivier est vide pour l&apos;instant.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {donnees.entrees.map((entree) => (
            <li key={entree.id} className="flex flex-col gap-3 rounded-lg border border-bordure bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">{entree.nom}</p>
                <p className="text-sm">
                  Recherché : {LIBELLES_ROLE_EPREUVE[entree.roleRecherche]} · Intérêt : {LIBELLE_INTERET[entree.interet]}
                </p>
              </div>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-texte-discret">Source</dt>
                  <dd>{entree.source ?? "Non renseignée"}</dd>
                </div>
                <div>
                  <dt className="text-texte-discret">Dernier contact</dt>
                  <dd>{entree.dernierContact ? jourEnFrancais(entree.dernierContact) : "Jamais"}</dd>
                </div>
              </dl>
              {entree.notes && <p className="text-sm">{entree.notes}</p>}
              <div className="flex flex-wrap gap-2">
                <ModifierVivier
                  valeurs={{
                    id: entree.id,
                    personId: entree.personId,
                    roleRecherche: entree.roleRecherche,
                    source: entree.source,
                    dernierContact: entree.dernierContact,
                    interet: entree.interet,
                    notes: entree.notes,
                  }}
                  roles={roles}
                  desactive={!peutEcrire}
                  raison={peutEcrire ? null : RAISON_ECRITURE}
                />
                <RetirerVivier id={entree.id} nom={entree.nom} desactive={!peutEcrire} raison={peutEcrire ? null : RAISON_ECRITURE} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
