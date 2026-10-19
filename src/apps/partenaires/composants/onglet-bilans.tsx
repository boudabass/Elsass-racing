"use client"

// Onglet Bilans de la fiche partenaire (brief 3.7, §5) : générer un bilan sur une période, le télécharger, le marquer
// envoyé. La génération et la liste passent par bilan-serveur.ts ; le PDF se lit par /api/fichiers, comme les autres
// fichiers de la team.

import { CHAMP, LIEN } from "@/lib/classes-formulaire"

import { dateFrancaise, instantFrancais } from "../affichage"
import { genererBilanAction, marquerBilanEnvoyeAction } from "../actions"

import { TiroirAction } from "@/components/formulaire/tiroir"

import { BoutonEnvoi, Champ, FormulaireAction } from "./formulaire"

// Conventions proposées pour le bilan : seulement celles qui ont dépassé le brouillon et l'envoi.
export interface ConventionPourBilan {
  id: string
  libelle: string
  debut: string
  fin: string
}

export interface BilanAffiche {
  id: string
  periodeDebut: string
  periodeFin: string
  genereLe: string
  envoyeLe: string | null
  fileId: string | null
}

export function OngletBilans({
  partenaireId,
  conventions,
  bilans,
  aujourdhui,
}: {
  partenaireId: string
  conventions: ConventionPourBilan[]
  bilans: BilanAffiche[]
  aujourdhui: string
}) {
  // Par défaut, la période de la convention la plus récente ; sans convention, l'année en cours.
  const annee = aujourdhui.slice(0, 4)
  const debutDefaut = conventions[0]?.debut ?? `${annee}-01-01`
  const finDefaut = conventions[0]?.fin ?? `${annee}-12-31`

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Générer un bilan</h2>
        {conventions.length === 0 ? (
          <p className="text-texte-discret">Aucune convention signée ou en cours : il n&apos;y a pas encore de bilan à faire.</p>
        ) : (
          <>
            <p className="text-sm text-texte-discret">
              Le bilan rassemble les contreparties, les preuves visibles par le partenaire, les épreuves courues et les résultats publics de la période.
            </p>
            <div>
              <TiroirAction libelle="Générer un bilan" titre="Générer un bilan" action={genererBilanAction} libelleBouton="Générer le bilan" libelleEnCours="Génération…" secondaire={false}>
                <input type="hidden" name="partnerId" value={partenaireId} />
                <Champ id="bilan-debut" libelle="Du">
                  <input id="bilan-debut" name="debut" type="date" required defaultValue={debutDefaut} className={CHAMP} />
                </Champ>
                <Champ id="bilan-fin" libelle="Au">
                  <input id="bilan-fin" name="fin" type="date" required defaultValue={finDefaut} className={CHAMP} />
                </Champ>
                <Champ id="bilan-convention" libelle="Convention" aide="Toutes les conventions du partenaire, ou une seule.">
                  <select id="bilan-convention" name="agreementId" defaultValue="" className={CHAMP}>
                    <option value="">Toutes les conventions</option>
                    {conventions.map((convention) => (
                      <option key={convention.id} value={convention.id}>
                        {convention.libelle}
                      </option>
                    ))}
                  </select>
                </Champ>
              </TiroirAction>
            </div>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Bilans générés</h2>
        {bilans.length === 0 ? (
          <p className="text-texte-discret">Aucun bilan pour l&apos;instant.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {bilans.map((bilan) => (
              <li key={bilan.id} className="flex flex-col gap-2 rounded-md border border-bordure bg-surface p-4">
                <span className="font-medium">
                  Du {dateFrancaise(bilan.periodeDebut)} au {dateFrancaise(bilan.periodeFin)}
                </span>
                <span className="text-sm text-texte-discret">
                  Généré le {instantFrancais(new Date(bilan.genereLe))}
                  {bilan.envoyeLe ? ` · envoyé le ${dateFrancaise(bilan.envoyeLe)}` : " · pas encore envoyé"}
                </span>
                <div className="flex flex-wrap items-center gap-4">
                  {bilan.fileId && (
                    <a href={`/api/fichiers/${bilan.fileId}`} className={LIEN}>
                      Télécharger le PDF
                    </a>
                  )}
                  {!bilan.envoyeLe && (
                    <FormulaireAction action={marquerBilanEnvoyeAction} nom="Marquer comme envoyé" className="flex">
                      <input type="hidden" name="reportId" value={bilan.id} />
                      <BoutonEnvoi libelle="Marquer comme envoyé" secondaire />
                    </FormulaireAction>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
