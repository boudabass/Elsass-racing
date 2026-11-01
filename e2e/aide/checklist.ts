// Aide des scénarios Check-lists : une épreuve à venir avec un engagement, créé comme le fait Saison
// (lignes en base, puis saison.engagement_cree par le bus). La proposition « Créer les listes » vient ensuite
// de l'app Check-lists, comme en production : le test la traite dans la boîte.
import type { Equipe } from "./session"
import {
  ajouterEpreuveEnBase,
  ajouterVoitureDeCourse,
  emettreEvenement,
  engagerVehiculeEnBase,
  preparerSaison,
} from "./session"

export interface EngagementChecklist {
  entryId: string
  eventId: string
  vehicleId: string
}

export async function preparerEngagementChecklist(equipe: Equipe): Promise<EngagementChecklist> {
  // Année suivante : l'épreuve est à venir, donc prochaine épreuve de la team pour Check-lists.
  const annee = new Date().getFullYear() + 1
  const saisonId = await preparerSaison(equipe, annee)
  const eventId = await ajouterEpreuveEnBase(equipe, saisonId, `Rallye Check-lists ${equipe.horodatage}`, `${annee}-06-01`, `${annee}-06-02`)
  const vehicleId = await ajouterVoitureDeCourse(equipe, `Saxo ${equipe.horodatage}`)
  const entryId = await engagerVehiculeEnBase(equipe, eventId, vehicleId, "inscrit")
  emettreEvenement(equipe, "saison.engagement_cree", { entryId, eventId, vehicleId })
  return { entryId, eventId, vehicleId }
}
