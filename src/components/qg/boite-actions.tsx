import Link from "next/link"

import { deciderAction, reporterAction } from "@/core/actions/formulaires"
import type { GroupeAction } from "@/core/actions/regroupement"
import type { ActionBoite } from "@/core/actions/filtrage"

// Liste de la boîte d'actions. Entièrement en formulaires : chaque décision et chaque
// report est un envoi au serveur, sans JavaScript côté client.
export function BoiteActions({ groupes }: { groupes: GroupeAction[] }) {
  if (groupes.length === 0) {
    return <p className="py-12 text-center text-lg text-texte-discret">Rien à décider. Profite de la route.</p>
  }

  return (
    <ul className="flex flex-col gap-3">
      {groupes.map((groupe) =>
        groupe.nombre === 1 ? (
          <li key={groupe.actions[0].id}>
            <CarteAction action={groupe.actions[0]} />
          </li>
        ) : (
          <li key={groupe.cleRegroupement ?? groupe.titreGroupe}>
            <details className="rounded-lg border border-bordure bg-surface">
              <summary className="cible-tactile flex cursor-pointer items-center justify-between gap-3 px-4 py-3 font-medium">
                <span>{groupe.titreGroupe}</span>
                <span className="chiffre rounded-md bg-surface-2 px-2 py-0.5 text-sm text-texte-discret">{groupe.nombre}</span>
              </summary>
              <ul className="flex flex-col gap-3 border-t border-bordure p-3">
                {groupe.actions.map((action) => (
                  <li key={action.id}>
                    <CarteAction action={action} />
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ),
      )}
    </ul>
  )
}

function CarteAction({ action }: { action: ActionBoite }) {
  const boutons = action.boutons as Array<{ cle: string; libelle: string }>
  const echeance = action.echeance
    ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(action.echeance)
    : null

  return (
    <article className="rounded-lg border border-bordure bg-surface p-4">
      <h3 className="text-lg font-semibold leading-snug">{action.titre}</h3>
      {action.contexte && <p className="mt-1 text-texte-discret">{action.contexte}</p>}
      {echeance && <p className="mt-1 text-sm text-texte-discret">Avant le {echeance}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {boutons.map((bouton) => (
          <form key={bouton.cle} action={deciderAction}>
            <input type="hidden" name="actionId" value={action.id} />
            <button
              type="submit"
              name="cleBouton"
              value={bouton.cle}
              className="cible-tactile rounded-md bg-marque px-4 py-2 font-medium text-white hover:opacity-90"
            >
              {bouton.libelle}
            </button>
          </form>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <details>
          <summary className="cible-tactile flex cursor-pointer items-center text-texte-discret underline-offset-4 hover:underline">
            Plus tard
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              { jours: 1, libelle: "Demain" },
              { jours: 3, libelle: "Dans 3 jours" },
              { jours: 7, libelle: "Dans 7 jours" },
            ].map((choix) => (
              <form key={choix.jours} action={reporterAction}>
                <input type="hidden" name="actionId" value={action.id} />
                <input type="hidden" name="jours" value={choix.jours} />
                <button type="submit" className="cible-tactile rounded-md border border-bordure px-3 py-1 hover:bg-surface-2">
                  {choix.libelle}
                </button>
              </form>
            ))}
          </div>
        </details>

        {action.ficheType && (
          <Link href={`/apps/${action.appOrigine}`} className="cible-tactile flex items-center text-marque underline-offset-4 hover:underline">
            Ouvrir
          </Link>
        )}
      </div>
    </article>
  )
}
