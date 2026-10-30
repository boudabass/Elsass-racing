// Écran Échéances (tâche 5.4, brief §1). Trois groupes par zone : « À traiter », « Bientôt », « À jour » (replié).
// La zone se lit en texte (« Expiré depuis 3 jours »), jamais par la couleur seule. Chaque ligne renvoie vers sa fiche.

import Link from "next/link"

import { BOUTON_SECONDAIRE } from "@/lib/classes-formulaire"

import type { EcheancesDonnees, LigneEcheance } from "../lectures-echeances"
import { COULEUR_ZONE } from "../libelles"
import type { GroupeEcheance } from "../regles"

const GROUPES: Array<{ cle: GroupeEcheance; titre: string; description: string }> = [
  { cle: "a_traiter", titre: "À traiter", description: "Expirés, ou à 7 jours et moins" },
  { cle: "bientot", titre: "Bientôt", description: "Entre 8 et 60 jours" },
  { cle: "a_jour", titre: "À jour", description: "Au-delà de 60 jours" },
]

function Ligne({ item }: { item: LigneEcheance }) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-bordure bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate font-semibold">{item.titre}</span>
          <span className="rounded-full border border-bordure px-2 py-0.5 text-xs text-texte-discret">{item.badge}</span>
        </span>
        <span className={`text-sm font-medium ${COULEUR_ZONE[item.zone]}`}>{item.compteARebours}</span>
      </div>
      <Link href={item.action.href} className={`${BOUTON_SECONDAIRE} shrink-0`}>
        {item.action.libelle}
      </Link>
    </li>
  )
}

export function EcheancesEcran({ donnees }: { donnees: EcheancesDonnees }) {
  const total = GROUPES.reduce((somme, groupe) => somme + donnees.groupes[groupe.cle].length, 0)
  return (
    <section className="flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="titre-rallye text-3xl">Échéances</h1>
        <p className="text-texte-discret">
          {total === 0 ? "Aucune date de fin pour l'instant." : `${total} date${total > 1 ? "s" : ""} de fin, de toutes les apps.`}
        </p>
        {donnees.sourcesMasquees.map((texte) => (
          <p key={texte} className="text-sm text-texte-discret">
            {texte}
          </p>
        ))}
      </header>

      {GROUPES.map((groupe) => {
        const items = donnees.groupes[groupe.cle]
        const contenu = items.length === 0 ? <p className="text-texte-discret">Rien dans ce groupe.</p> : <ul className="flex flex-col gap-3">{items.map((item) => <Ligne key={item.cle} item={item} />)}</ul>
        if (groupe.cle === "a_jour") {
          return (
            <details key={groupe.cle} className="flex flex-col gap-3">
              <summary className="cursor-pointer font-semibold">
                {groupe.titre} ({items.length}) : {groupe.description}
              </summary>
              {contenu}
            </details>
          )
        }
        return (
          <section key={groupe.cle} className="flex flex-col gap-3" aria-labelledby={`groupe-${groupe.cle}`}>
            <h2 id={`groupe-${groupe.cle}`} className="font-semibold">
              {groupe.titre} ({items.length}) <span className="text-sm font-normal text-texte-discret">: {groupe.description}</span>
            </h2>
            {contenu}
          </section>
        )
      })}

      <p className="text-sm text-texte-discret">
        <Link href="/apps/documents" className={BOUTON_SECONDAIRE}>
          Retour au coffre-fort
        </Link>
      </p>
    </section>
  )
}
