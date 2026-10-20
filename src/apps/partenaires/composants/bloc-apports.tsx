// Bloc de l'apport d'une convention (brief 3.14, point 4, phase A) : ce que le partenaire nous doit (attendu, reçu,
// reste, versements), séparé de ce que nous devons (contreparties, en quantités : pas d'euros). Rendu serveur, sans état.

import Link from "next/link"

import { LIEN } from "@/lib/classes-formulaire"

import type { BilanApport, EtatVersement } from "../apport"
import { dateFrancaise } from "../affichage"
import { formaterMontant } from "../regles"

export interface ContrepartieBilan {
  id: string
  libelle: string
  quantitePromise: number
  quantiteTenue: number
}

// « 1 tenue », « 3 tenues » : l'accord du nom suit la quantité.
function quantite(nombre: number, mot: string): string {
  return `${nombre} ${mot}${nombre > 1 ? "s" : ""}`
}

const LIBELLE_ETAT: Record<EtatVersement, string> = {
  encaisse: "encaissé",
  prevu: "pas encore encaissé",
  en_retard: "en retard, pas encore encaissé",
}

export function BlocApports({
  apport,
  statut,
  apportNature,
  contreparties,
  detaille,
}: {
  apport: BilanApport
  // Libellé de l'apport reçu (« Apport partiel »…) : affiché seulement quand il est donné.
  statut?: string
  apportNature: string | null
  contreparties: ContrepartieBilan[]
  // Détail : la liste des versements, avec leurs liens vers Budget. Absent sur la fiche partenaire (carte cliquable).
  detaille: boolean
}) {
  return (
    <div className="flex flex-col gap-5 text-sm">
      <section aria-label="Ce que le partenaire nous doit" className="flex flex-col gap-2">
        <h3 className="font-medium">Ce que le partenaire nous doit</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-texte-discret">Attendu</dt>
          <dd>{formaterMontant(apport.attenduCentimes)}</dd>
          <dt className="text-texte-discret">Reçu</dt>
          <dd>{formaterMontant(apport.recuCentimes)}</dd>
          <dt className="text-texte-discret">Reste</dt>
          <dd>{formaterMontant(apport.resteCentimes)}</dd>
        </dl>
        {statut && (
          <p className="font-medium" data-testid="apport-recu">
            {statut}
          </p>
        )}
        {apport.tropCentimes > 0 && <p>Trop perçu : {formaterMontant(apport.tropCentimes)} au-delà de l&apos;apport attendu.</p>}
        {apport.sansVersement && <p className="text-texte-discret">Aucun versement n&apos;est prévu : le reste est l&apos;apport entier.</p>}
        {apportNature && <p>Apport en nature : {apportNature}</p>}
        {detaille && apport.versements.length > 0 && (
          <ul aria-label="Versements prévus" className="flex flex-col gap-1">
            {apport.versements.map((versement) => (
              <li key={versement.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>
                  {formaterMontant(versement.montantCentimes)}, prévu le {dateFrancaise(versement.date)} ·{" "}
                  {versement.etat === "encaisse" && versement.encaisseeLe
                    ? `encaissé le ${dateFrancaise(versement.encaisseeLe)}`
                    : LIBELLE_ETAT[versement.etat]}
                </span>
                {versement.statut === "prevue" && (
                  <Link href={`/apps/budget/mouvement/${versement.id}`} className={LIEN}>
                    Encaisser dans Budget
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-label="Ce que nous devons" className="flex flex-col gap-2">
        <h3 className="font-medium">Ce que nous devons</h3>
        {contreparties.length === 0 ? (
          <p className="text-texte-discret">Aucune contrepartie pour l&apos;instant.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {contreparties.map((contrepartie) => (
              <li key={contrepartie.id}>
                {contrepartie.libelle} : {quantite(contrepartie.quantiteTenue, "tenue")} sur {quantite(contrepartie.quantitePromise, "promise")}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
