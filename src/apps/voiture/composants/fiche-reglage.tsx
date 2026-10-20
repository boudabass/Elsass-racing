import type { ReactNode } from "react"

import { CHAMPS_REGLAGE } from "../regles"
import { LIBELLE_CONDITIONS, LIBELLE_REVETEMENT, dateEnToutesLettres, noteSur5, valeurDeReglageEnTexte } from "../libelles"
import { EnregistrerReference, SupprimerReglage } from "./actions-reglage"

export interface DetailReglage {
  date: Date
  epreuve: string | null
  conditions: string | null
  revetement: string | null
  note: number | null
  auteur: string
  remarques: string
  valeurs: Record<string, string | number>
}

// Fiche de réglage en lecture : valeurs avec unités. Les champs vides ne s'affichent pas, ni les champs masqués.
// « Modifier la fiche » est fourni par la page (un tiroir), seulement si le membre peut modifier.
export function FicheReglageLecture({
  vehicleId,
  reglageId,
  detail,
  masques,
  actionModifier,
  peutEcrire,
}: {
  vehicleId: string
  reglageId: string
  detail: DetailReglage
  masques: string[]
  actionModifier: ReactNode
  peutEcrire: boolean
}) {
  const visibles = (groupe: "essentiel" | "avance") =>
    CHAMPS_REGLAGE.filter((c) => c.groupe === groupe && !masques.includes(c.cle) && detail.valeurs[c.cle] !== undefined && detail.valeurs[c.cle] !== null)
  const essentiels = visibles("essentiel")
  const avances = visibles("avance")
  const conditions = detail.conditions ? LIBELLE_CONDITIONS[detail.conditions as keyof typeof LIBELLE_CONDITIONS] : null
  const revetement = detail.revetement ? LIBELLE_REVETEMENT[detail.revetement as keyof typeof LIBELLE_REVETEMENT] : null
  const precisions = [detail.epreuve ?? "Sans épreuve", conditions, revetement].filter(Boolean).join(" · ")

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-texte-discret">
          {precisions} · {detail.auteur}
        </p>
        <p className="text-sm text-texte-discret">{detail.note ? `Comportement : ${noteSur5(detail.note)}` : "Sans note de comportement"}</p>
        <p className="text-sm text-texte-discret">Fiche du {dateEnToutesLettres(detail.date)}.</p>
      </header>

      {essentiels.length === 0 && avances.length === 0 ? (
        <p className="text-texte-discret">Aucune valeur saisie dans cette fiche.</p>
      ) : (
        <>
          {essentiels.length > 0 && <Groupe titre="Pressions et hauteur de caisse" champs={essentiels} valeurs={detail.valeurs} />}
          {avances.length > 0 && <Groupe titre="Plus de réglages" champs={avances} valeurs={detail.valeurs} />}
        </>
      )}

      {detail.remarques && (
        <section className="flex flex-col gap-2">
          <h2 className="font-titre text-lg uppercase">Remarques du pilote</h2>
          <p className="whitespace-pre-line">{detail.remarques}</p>
        </section>
      )}

      <div className="flex flex-col gap-4 border-t border-bordure pt-6">
        {actionModifier}
        {peutEcrire && (
          <>
            <EnregistrerReference reglageId={reglageId} />
            <SupprimerReglage reglageId={reglageId} vehicleId={vehicleId} />
          </>
        )}
      </div>
    </div>
  )
}

function Groupe({ titre, champs, valeurs }: { titre: string; champs: typeof CHAMPS_REGLAGE; valeurs: Record<string, string | number> }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-titre text-lg uppercase">{titre}</h2>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {champs.map((champ) => (
          <div key={champ.cle} className="flex justify-between gap-3 border-b border-bordure pb-2 sm:border-0 sm:pb-0">
            <dt className="text-sm text-texte-discret">{champ.libelle}</dt>
            <dd className="tabular-nums">
              {valeurDeReglageEnTexte(champ.cle, valeurs[champ.cle])}
              {champ.unite ? ` ${champ.unite}` : ""}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
