import { notFound } from "next/navigation"

import { aAuMoins } from "@/core/droits/niveaux"

import { lirePartenairesReservablesDans } from "@/apps/partenaires/lectures-partagees"
import { lireVehicule } from "../lectures-serveur"
import { formeDeJson, type EmplacementPlan } from "../plan"
import { accesVoiture } from "../services-serveur"
import { DecoPlan } from "./deco-plan"

// Date civile (@db.Date) en AAAA-MM-JJ, pour le client.
function versJour(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null
}

// Onglet Déco : le plan de la voiture, la liste de ses emplacements et le panneau de celui qui est choisi (brief 3.4).
// Le serveur donne les données ; le client gère la vue, le choix et le déplacement. Lecture seule sous le niveau écriture.
export async function PanneauDeco({ ficheId }: { ficheId: string }) {
  const fiche = await lireVehicule(ficheId)
  if (!fiche) notFound()
  const { ctx, niveau } = await accesVoiture("lecture")
  // La liste des partenaires ne sert qu'à la réservation : elle n'est lue que pour qui peut écrire (brief 3.11, §3).
  const partenaires = aAuMoins(niveau, "ecriture") ? await lirePartenairesReservablesDans(ctx) : []

  const emplacements: EmplacementPlan[] = fiche.emplacements.map((emplacement) => {
    const occupation = emplacement.occupations[0]
    return {
      id: emplacement.id,
      nom: emplacement.nom,
      vue: emplacement.vue,
      forme: formeDeJson(emplacement.forme),
      symetrique: emplacement.symetrique,
      largeurCm: emplacement.largeurCm,
      hauteurCm: emplacement.hauteurCm,
      statut: emplacement.statut,
      occupation: occupation
        ? {
            id: occupation.id,
            statut: occupation.statut as "reserve" | "pose",
            partenaireNom: occupation.partenaireNom,
            logoFileId: occupation.logoFileId,
            du: versJour(occupation.du),
            au: versJour(occupation.au),
            photoPoseFileId: occupation.photoPoseFileId,
            poseLe: versJour(occupation.poseLe),
          }
        : null,
    }
  })

  return (
    <DecoPlan
      ficheId={ficheId}
      nomVehicule={fiche.vehicule?.nomCourt ?? "Véhicule"}
      gabarit={fiche.gabarit}
      emplacements={emplacements}
      peutEcrire={aAuMoins(niveau, "ecriture")}
      partenaires={partenaires}
    />
  )
}
