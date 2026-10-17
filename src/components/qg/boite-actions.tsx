import Link from "next/link"

import { APPS } from "@/core/catalogue"
import { deciderAction, reporterAction } from "@/core/actions/formulaires"
import type { GroupeAction } from "@/core/actions/regroupement"
import type { ActionBoite } from "@/core/actions/filtrage"
import { LIEN } from "@/lib/classes-formulaire"

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

// Hiérarchie des boutons : le premier est plein, les suivants en contour, « Plus tard » discret.
// Tous ont la même hauteur (même padding, même police).
const BOUTON_BASE = "cible-tactile inline-flex items-center rounded-md px-4 py-2 font-medium"
const BOUTON_PRINCIPAL = `${BOUTON_BASE} bg-marque text-marque-texte hover:opacity-90`
const BOUTON_SECONDAIRE = `${BOUTON_BASE} border border-marque text-marque hover:bg-surface-2`
const BOUTON_DISCRET = `${BOUTON_BASE} border border-bordure text-texte-discret hover:bg-surface-2`

function CarteAction({ action }: { action: ActionBoite }) {
  const boutons = action.boutons as Array<{ cle: string; libelle: string }>
  const echeance = action.echeance
    ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(action.echeance)
    : null
  // Ligne discrète : l'app d'origine, puis l'échéance si elle existe.
  const nomApp = APPS.find((app) => app.cle === action.appOrigine)?.nom ?? action.appOrigine
  const ligne = [nomApp, echeance ? `avant le ${echeance}` : null].filter(Boolean).join(" · ")

  return (
    <article id={`action-${action.id}`} className="scroll-mt-24 rounded-lg border border-bordure bg-surface p-4">
      <h3 className="text-lg font-semibold leading-snug">{action.titre}</h3>
      <p className="mt-1 text-sm text-texte-discret">{ligne}</p>
      {action.contexte && <p className="mt-2 text-texte-discret">{action.contexte}</p>}
      {action.messageRefus && (
        <p role="alert" className="mt-2 rounded-md border border-etat-rouge px-3 py-2 text-sm text-etat-rouge">
          {action.messageRefus}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-start gap-2">
        {boutons.map((bouton, index) => (
          <form key={bouton.cle} action={deciderAction}>
            <input type="hidden" name="actionId" value={action.id} />
            <button type="submit" name="cleBouton" value={bouton.cle} className={index === 0 ? BOUTON_PRINCIPAL : BOUTON_SECONDAIRE}>
              {bouton.libelle}
            </button>
          </form>
        ))}

        <details className="text-sm">
          <summary className={`${BOUTON_DISCRET} cursor-pointer list-none`}>Plus tard</summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              { jours: 1, libelle: "Demain" },
              { jours: 3, libelle: "Dans 3 jours" },
              { jours: 7, libelle: "Dans 7 jours" },
            ].map((choix) => (
              <form key={choix.jours} action={reporterAction}>
                <input type="hidden" name="actionId" value={action.id} />
                <input type="hidden" name="jours" value={choix.jours} />
                <button type="submit" className={BOUTON_DISCRET}>
                  {choix.libelle}
                </button>
              </form>
            ))}
          </div>
        </details>

        {action.ficheType && (
          <Link href={`/apps/${action.appOrigine}`} className={`${LIEN} px-2 py-2`}>
            Ouvrir
          </Link>
        )}
      </div>
    </article>
  )
}
