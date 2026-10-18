import Link from "next/link"
import { Car } from "lucide-react"

import type { VehiculeListe } from "../lectures-serveur"
import { COULEUR_ETAT_PAPIERS, LIBELLE_ETAT_PAPIERS, LIBELLE_TYPE_VEHICULE, groupeEtClasse, libelleEmplacementsLibres } from "../libelles"

// Carte d'un véhicule : la carte entière est un lien vers la fiche. Le nom est le nom accessible ; l'état des
// papiers est lu en description, en toutes lettres (la couleur n'est qu'un renfort).
export function CarteVehicule({ vehicule }: { vehicule: VehiculeListe }) {
  const idNom = `vehicule-${vehicule.vehicleId}-nom`
  const idEtat = `vehicule-${vehicule.vehicleId}-etat`
  const precisions = groupeEtClasse(vehicule.groupe, vehicule.classe)

  return (
    <li>
      <Link
        href={`/apps/voiture/vehicules/${vehicule.vehicleId}`}
        aria-labelledby={idNom}
        aria-describedby={idEtat}
        className="flex h-full flex-col overflow-hidden rounded-lg border border-bordure bg-surface hover:bg-surface-2"
      >
        {vehicule.photoFileId ? (
          <img src={`/api/fichiers/${vehicule.photoFileId}`} alt="" className="aspect-video w-full object-cover" />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center bg-surface-2 text-texte-discret" aria-hidden="true">
            <Car className="h-12 w-12" />
          </div>
        )}
        <div className="flex flex-1 flex-col gap-1 p-4">
          <h2 id={idNom} className="font-titre text-lg uppercase">
            {vehicule.nom}
          </h2>
          <p className="text-sm text-texte-discret">
            {LIBELLE_TYPE_VEHICULE[vehicule.type]}
            {precisions ? ` · ${precisions}` : ""}
          </p>
          <p id={idEtat} className={`mt-auto pt-2 text-sm font-medium ${COULEUR_ETAT_PAPIERS[vehicule.etatPapiers]}`}>
            {LIBELLE_ETAT_PAPIERS[vehicule.etatPapiers]}
            {vehicule.emplacementsLibres > 0 && <span className="font-normal text-texte-discret">{` · ${libelleEmplacementsLibres(vehicule.emplacementsLibres)}`}</span>}
          </p>
        </div>
      </Link>
    </li>
  )
}
