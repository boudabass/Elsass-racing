import Link from "next/link"

import { niveauDe } from "@/core/actions/actions-serveur"
import { aAuMoins } from "@/core/droits/niveaux"

import { historiqueVehicule } from "../lectures-serveur"
import { LIBELLE_STATUT_FINAL, dateEnToutesLettres, kmDeSpeciale } from "../libelles"
import { accesVoiture } from "../services-serveur"

// Onglet Historique : kilomètres de spéciale cumulés, puis les épreuves validées. Le lien vers la fiche de
// l'épreuve n'existe que si le membre a accès à Saison.
export async function PanneauHistorique({ ficheId }: { ficheId: string }) {
  const { ctx } = await accesVoiture("lecture")
  const { epreuves, kmTotal } = await historiqueVehicule(ficheId)
  const peutVoirSaison = aAuMoins(await niveauDe(ctx, "saison"), "lecture")

  return (
    <div className="flex flex-col gap-6">
      <p className="font-titre text-3xl tabular-nums">{kmDeSpeciale(kmTotal)}</p>

      {epreuves.length === 0 ? (
        <p className="text-texte-discret">Aucune épreuve validée pour ce véhicule.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-bordure">
          {epreuves.map((epreuve) => {
            const classements = [
              epreuve.classementGeneral ? `${epreuve.classementGeneral}e au général` : null,
              epreuve.classementClasse ? `${epreuve.classementClasse}e de classe` : null,
            ].filter(Boolean)
            const detail = [dateEnToutesLettres(epreuve.dateDebut), LIBELLE_STATUT_FINAL[epreuve.statutFinal], ...classements].join(" · ")
            return (
              <li key={epreuve.entryId} className="flex flex-col gap-1 py-3">
                {peutVoirSaison ? (
                  <Link href={`/apps/saison/epreuves/${epreuve.eventId}`} className="cible-tactile flex flex-col">
                    <span className="font-medium">{epreuve.epreuveNom}</span>
                    <span className="text-sm text-texte-discret">{detail}</span>
                  </Link>
                ) : (
                  <>
                    <span className="font-medium">{epreuve.epreuveNom}</span>
                    <span className="text-sm text-texte-discret">{detail}</span>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
