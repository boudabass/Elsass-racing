// Fiche pièce (tâche 4.2, §3) : les informations, l'historique (lecture 4.1 : poses, déposes, usures) et le changement de
// statut. Le prix et le fournisseur n'apparaissent qu'au niveau écriture. Une pièce montée ne change pas de statut ici.

import Link from "next/link"

import { aAuMoins, type Niveau } from "@/core/droits/niveaux"
import { formatEuros } from "@/lib/euros"
import { BOUTON_SECONDAIRE, LIEN } from "@/lib/classes-formulaire"

import type { FichePiece } from "../lectures-serveur"
import {
  LIBELLE_MOTIF_DEPOSE,
  LIBELLE_QUALITE,
  LIBELLE_SOURCE_USURE,
  LIBELLE_STATUT_PIECE,
} from "../libelles"
import { dateAtelier, kmAtelier } from "../mise-en-forme"

import { FormulaireStatut } from "./formulaires-stock"

const libelleDe = <T extends Record<string, string>>(table: T, cle: string | null): string => (cle && table[cle]) || cle || ""

export function FichePieceEcran({ fiche, niveau }: { fiche: FichePiece; niveau: Niveau }) {
  const { historique } = fiche
  const piece = historique.piece
  const peutEcrire = aAuMoins(niveau, "ecriture")
  const titreVoiture = fiche.vehiculeNomCourt ? ` · ${fiche.vehiculeNomCourt}` : ""
  const duree = [
    fiche.dureeVieKm !== null ? kmAtelier(fiche.dureeVieKm) : null,
    fiche.dureeVieEpreuves !== null ? `${fiche.dureeVieEpreuves} épreuves` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <section className="flex max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <Link href={`/apps/garage/stock?vehicule=${fiche.vehicleId}`} className={LIEN}>
          Stock{titreVoiture}
        </Link>
        <h1 className="titre-rallye text-3xl">{piece.designation}</h1>
        <p className="text-texte-discret">{[piece.marque, piece.reference].filter(Boolean).join(" · ") || "Sans marque ni référence"}</p>
      </header>

      <section aria-labelledby="informations" className="flex flex-col gap-3">
        <h2 id="informations" className="text-lg font-semibold">
          Informations
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-texte-discret">Statut</dt>
          <dd>{libelleDe(LIBELLE_STATUT_PIECE, piece.statut)}</dd>
          <dt className="text-texte-discret">Organe</dt>
          <dd>
            {fiche.organeId ? (
              <Link href={`/apps/garage/organes/${fiche.organeId}`} className={LIEN}>
                {fiche.organeNom}
              </Link>
            ) : (
              fiche.organeNom
            )}
          </dd>
          <dt className="text-texte-discret">Qualité</dt>
          <dd>{libelleDe(LIBELLE_QUALITE, piece.qualite)}</dd>
          <dt className="text-texte-discret">Emplacement</dt>
          <dd>{fiche.emplacement ?? "Non renseigné"}</dd>
          <dt className="text-texte-discret">Numéro de série</dt>
          <dd>{fiche.numeroSerie ?? "Non renseigné"}</dd>
          <dt className="text-texte-discret">Durée de vie</dt>
          <dd>{duree || "Celle de l'organe"}</dd>
          <dt className="text-texte-discret">Km cumulés</dt>
          <dd>{kmAtelier(piece.kmCumules)}</dd>
          <dt className="text-texte-discret">Épreuves cumulées</dt>
          <dd>{piece.epreuvesCumulees}</dd>
          {fiche.acheteeLe && (
            <>
              <dt className="text-texte-discret">Achetée le</dt>
              <dd>{dateAtelier(fiche.acheteeLe)}</dd>
            </>
          )}
          {peutEcrire && (
            <>
              <dt className="text-texte-discret">Fournisseur</dt>
              <dd>{fiche.fournisseurNom ?? "Non renseigné"}</dd>
              <dt className="text-texte-discret">Prix</dt>
              <dd>{piece.prixCents !== null && piece.prixCents !== undefined ? formatEuros(piece.prixCents) : "Non renseigné"}</dd>
            </>
          )}
        </dl>
      </section>

      <section aria-labelledby="statut" className="flex flex-col gap-3">
        <h2 id="statut" className="text-lg font-semibold">
          Statut
        </h2>
        {fiche.montee ? (
          <p className="text-sm text-texte-discret">
            Montée sur {fiche.organeNom}. Pour la changer de place, déposez-la depuis la fiche de l&apos;organe.
          </p>
        ) : peutEcrire ? (
          <FormulaireStatut partId={piece.id} statut={piece.statut} />
        ) : (
          <div className="flex flex-col items-start gap-2">
            <button type="button" disabled className={`${BOUTON_SECONDAIRE} opacity-60`}>
              Changer le statut
            </button>
            <p className="text-sm text-texte-discret">Seul l&apos;équipage peut changer le statut d&apos;une pièce.</p>
          </div>
        )}
      </section>

      <section aria-labelledby="historique" className="flex flex-col gap-3">
        <h2 id="historique" className="text-lg font-semibold">
          Historique
        </h2>
        {historique.montages.length === 0 && historique.usures.length === 0 ? (
          <p className="text-sm text-texte-discret">Aucun historique pour cette pièce.</p>
        ) : (
          <div className="flex flex-col gap-4 text-sm">
            {historique.montages.length > 0 && (
              <ul className="flex flex-col gap-2">
                {historique.montages.map((pose) => (
                  <li key={pose.id}>
                    Posée le {dateAtelier(pose.poseLe)} à {kmAtelier(pose.kmPose)}
                    {pose.deposeeLe &&
                      ` · déposée le ${dateAtelier(pose.deposeeLe)}${pose.motifDepose ? `, motif : ${libelleDe(LIBELLE_MOTIF_DEPOSE, pose.motifDepose)}` : ""}`}
                  </li>
                ))}
              </ul>
            )}
            {historique.usures.length > 0 && (
              <ul className="flex flex-col gap-2">
                {historique.usures.map((usure) => (
                  <li key={usure.id}>
                    {dateAtelier(usure.date)} · +{kmAtelier(usure.kmAjoutes)}
                    {usure.epreuveComptee ? " · épreuve comptée" : " · sans épreuve"} · {libelleDe(LIBELLE_SOURCE_USURE, usure.source)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </section>
  )
}
