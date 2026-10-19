import { notFound } from "next/navigation"

import { LIEN } from "@/lib/classes-formulaire"
import { aAuMoins } from "@/core/droits/niveaux"

import { lireVehicule } from "../lectures-serveur"
import { COULEUR_STATUT_PAPIER, LIBELLE_STATUT_PAPIER, dateEnToutesLettres, libelleDuPapier, type TypePapier } from "../libelles"
import { trierPapiers } from "../regles"
import { accesVoiture } from "../services-serveur"
import { FormulairePapier, SupprimerPapier, type ValeursPapier } from "./formulaire-papier"

const jourCivil = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : "")

// Onglet Papiers : expirés d'abord, puis à renouveler, puis valides. Ajout et modification s'ouvrent dans un tiroir.
export async function PanneauPapiers({ ficheId }: { ficheId: string }) {
  const { niveau } = await accesVoiture("lecture")
  const fiche = await lireVehicule(ficheId)
  if (!fiche) notFound()
  const papiers = trierPapiers(fiche.papiers)
  const peutEcrire = aAuMoins(niveau, "ecriture")

  return (
    <div className="flex flex-col gap-6">
      {peutEcrire && <FormulairePapier vehicleId={ficheId} />}

      {papiers.length === 0 ? (
        <p className="text-texte-discret">Aucun papier pour ce véhicule.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-bordure">
          {papiers.map((papier) => {
            const valeurs: ValeursPapier = {
              id: papier.id,
              type: papier.type as TypePapier,
              libelle: papier.libelle ?? "",
              numero: papier.numero ?? "",
              delivreLe: jourCivil(papier.delivreLe),
              valableJusquAu: jourCivil(papier.valableJusquAu),
              documentFileId: papier.documentFileId,
              documentNom: null,
            }
            return (
              <li key={papier.id} className="flex flex-col gap-2 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">{libelleDuPapier(papier.type as TypePapier, papier.libelle)}</p>
                  <p className={`text-sm font-medium ${COULEUR_STATUT_PAPIER[papier.statut]}`}>{LIBELLE_STATUT_PAPIER[papier.statut]}</p>
                </div>
                <p className="text-sm text-texte-discret">
                  {papier.numero ? `N° ${papier.numero} · ` : ""}
                  {papier.valableJusquAu ? `valable jusqu'au ${dateEnToutesLettres(papier.valableJusquAu)}` : "sans échéance"}
                </p>
                {papier.documentFileId && (
                  <a href={`/api/fichiers/${papier.documentFileId}`} target="_blank" rel="noopener noreferrer" className={`${LIEN} self-start`}>
                    Voir le document
                  </a>
                )}
                {peutEcrire && (
                  <div className="flex flex-col gap-3">
                    <FormulairePapier vehicleId={ficheId} papier={valeurs} />
                    <SupprimerPapier papierId={papier.id} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
