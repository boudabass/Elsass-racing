// Fiche organe (tâche 4.2, §2) : la pièce montée, les rechanges du même type sur la voiture, les réglages de l'organe,
// l'historique (poses, déposes avec leur motif, usures avec leur source) et la zone de retrait. Rendu serveur ; les
// tiroirs sont dans formulaires-organe.tsx.

import Link from "next/link"

import { aAuMoins, type Niveau } from "@/core/droits/niveaux"
import { BOUTON_SECONDAIRE, LIEN } from "@/lib/classes-formulaire"

import type { FicheOrgane, PoseOrgane, UsureOrgane } from "../lectures-serveur"
import {
  LIBELLE_MODE_USURE,
  LIBELLE_MOTIF_DEPOSE,
  LIBELLE_QUALITE,
  LIBELLE_SOURCE_USURE,
} from "../libelles"
import { dateAtelier, kmAtelier, libelleZone, phraseKmRestants, pourcentage } from "../mise-en-forme"

import { FormulaireRegler, FormulaireRemplacer, FormulaireRetirer } from "./formulaires-organe"

const libelleQualite = (qualite: string) => LIBELLE_QUALITE[qualite as keyof typeof LIBELLE_QUALITE] ?? qualite

function Historique({ poses, usures }: { poses: PoseOrgane[]; usures: UsureOrgane[] }) {
  if (poses.length === 0 && usures.length === 0) {
    return <p className="text-sm text-texte-discret">Aucun historique pour cet organe.</p>
  }
  return (
    <div className="flex flex-col gap-4 text-sm">
      {poses.length > 0 && (
        <ul className="flex flex-col gap-2">
          {poses.map((pose) => (
            <li key={pose.id} className="flex flex-col">
              <span className="font-medium">{pose.designation}</span>
              <span className="text-texte-discret">
                Posée le {dateAtelier(pose.poseLe)} à {kmAtelier(pose.kmPose)}
                {pose.deposeeLe &&
                  ` · déposée le ${dateAtelier(pose.deposeeLe)}${pose.motifDepose ? `, motif : ${LIBELLE_MOTIF_DEPOSE[pose.motifDepose as keyof typeof LIBELLE_MOTIF_DEPOSE] ?? pose.motifDepose}` : ""}`}
              </span>
            </li>
          ))}
        </ul>
      )}
      {usures.length > 0 && (
        <ul className="flex flex-col gap-2">
          {usures.map((usure) => (
            <li key={usure.id} className="flex flex-col">
              <span className="font-medium">
                {dateAtelier(usure.date)} · +{kmAtelier(usure.kmAjoutes)}
                {usure.epreuveComptee ? " · épreuve comptée" : " · sans épreuve"}
              </span>
              <span className="text-texte-discret">
                {usure.designation} · {LIBELLE_SOURCE_USURE[usure.source as keyof typeof LIBELLE_SOURCE_USURE] ?? usure.source}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function FicheOrganeEcran({ fiche, niveau }: { fiche: FicheOrgane; niveau: Niveau }) {
  const { organe } = fiche
  const peutEcrire = aAuMoins(niveau, "ecriture")
  const piece = organe.piece
  const pct = pourcentage(organe.etat)
  const km = phraseKmRestants(organe.kmRestants)
  const titreVoiture = fiche.vehiculeNomCourt ? ` · ${fiche.vehiculeNomCourt}` : ""

  return (
    <section className="flex max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <Link href={`/apps/garage?vehicule=${fiche.vehicleId}`} className={LIEN}>
          Atelier{titreVoiture}
        </Link>
        <h1 className="titre-rallye text-3xl">{organe.nom}</h1>
        {organe.position && <p className="text-texte-discret">{organe.position}</p>}
      </header>

      <section aria-labelledby="piece-montee" className="flex flex-col gap-3">
        <h2 id="piece-montee" className="text-lg font-semibold">
          Pièce montée
        </h2>
        {piece ? (
          <>
            <div>
              <p className="font-medium">{piece.designation}</p>
              <p className="text-sm text-texte-discret">{[piece.marque, piece.reference].filter(Boolean).join(" · ")}</p>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-texte-discret">Qualité</dt>
              <dd>{libelleQualite(piece.qualite)}</dd>
              <dt className="text-texte-discret">Posée le</dt>
              <dd>{dateAtelier(piece.poseLe)}</dd>
              <dt className="text-texte-discret">Km cumulés</dt>
              <dd>{kmAtelier(piece.kmCumules)}</dd>
              <dt className="text-texte-discret">Épreuves cumulées</dt>
              <dd>{piece.epreuvesCumulees}</dd>
              <dt className="text-texte-discret">État</dt>
              <dd>{pct ? `${pct} · ${libelleZone(organe.zone)}` : libelleZone(organe.zone)}</dd>
              {km && (
                <>
                  <dt className="text-texte-discret">Marge</dt>
                  <dd>{km}</dd>
                </>
              )}
            </dl>
          </>
        ) : organe.trainMonte ? (
          <p className="text-sm">Train monté : {organe.trainMonte.marque}</p>
        ) : (
          <p className="text-sm text-texte-discret">Aucune pièce montée.</p>
        )}

        {!organe.trainMonte &&
          (peutEcrire ? (
            <FormulaireRemplacer organeId={organe.id} nom={organe.nom} pieceEnPlace={Boolean(piece)} rechanges={organe.rechanges} />
          ) : (
            <div className="flex flex-col items-start gap-2">
              <button type="button" disabled className="cible-tactile inline-flex items-center rounded-md border border-bordure px-4 opacity-60">
                {piece ? "Remplacer" : "Poser une pièce"}
              </button>
              <p className="text-sm text-texte-discret">Seul l&apos;équipage peut remplacer une pièce.</p>
            </div>
          ))}
      </section>

      <section aria-labelledby="rechanges" className="flex flex-col gap-3">
        <h2 id="rechanges" className="text-lg font-semibold">
          Rechanges disponibles
        </h2>
        {organe.rechanges.length === 0 ? (
          <p className="text-sm text-texte-discret">Aucune pièce de rechange en stock pour cet organe.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {organe.rechanges.map((rechange) => (
              <li key={rechange.id}>
                <span className="font-medium">{rechange.designation}</span>
                <span className="text-texte-discret">
                  {" "}
                  · {[rechange.marque, libelleQualite(rechange.qualite)].filter(Boolean).join(" · ")} · {kmAtelier(rechange.kmCumules)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="reglages" className="flex flex-col gap-3">
        <h2 id="reglages" className="text-lg font-semibold">
          Réglages de l&apos;organe
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-texte-discret">Mode d&apos;usure</dt>
          <dd>{LIBELLE_MODE_USURE[organe.mode]}</dd>
          <dt className="text-texte-discret">Durée de référence</dt>
          <dd>
            {[
              organe.dureeReferenceKm !== null ? kmAtelier(organe.dureeReferenceKm) : null,
              organe.dureeReferenceEpreuves !== null ? `${organe.dureeReferenceEpreuves} épreuves` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "À renseigner"}
          </dd>
          <dt className="text-texte-discret">Seuils</dt>
          <dd>
            Orange {organe.seuilOrange} % · rouge {organe.seuilRouge} %
          </dd>
        </dl>
        {peutEcrire ? (
          <FormulaireRegler
            valeurs={{
              organeId: organe.id,
              nom: organe.nom,
              mode: organe.mode,
              dureeKm: organe.dureeReferenceKm,
              dureeEpreuves: organe.dureeReferenceEpreuves,
              seuilOrange: organe.seuilOrange,
              seuilRouge: organe.seuilRouge,
              position: organe.position,
            }}
          />
        ) : (
          <div className="flex flex-col items-start gap-2">
            <button type="button" disabled className={`${BOUTON_SECONDAIRE} opacity-60`}>
              Régler l&apos;organe
            </button>
            <p className="text-sm text-texte-discret">Seul l&apos;équipage peut régler un organe.</p>
          </div>
        )}
      </section>

      <section aria-labelledby="historique" className="flex flex-col gap-3">
        <h2 id="historique" className="text-lg font-semibold">
          Historique
        </h2>
        <Historique poses={fiche.poses} usures={fiche.usures} />
      </section>

      <section aria-labelledby="retirer" className="flex flex-col gap-3 border-t border-bordure pt-6">
        <h2 id="retirer" className="text-lg font-semibold">
          Retirer l&apos;organe
        </h2>
        <FormulaireRetirer
          organeId={organe.id}
          vehicleId={fiche.vehicleId}
          piece={Boolean(piece || organe.trainMonte)}
          peutEcrire={peutEcrire}
        />
      </section>
    </section>
  )
}
