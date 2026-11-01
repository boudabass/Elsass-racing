// Aide des scénarios Check-lists : une épreuve à venir avec un engagement, créé comme le fait Saison
// (lignes en base, puis saison.engagement_cree par le bus). La proposition « Créer les listes » vient ensuite
// de l'app Check-lists, comme en production : le test la traite dans la boîte.
import { jourParis } from "./dates"
import type { Equipe } from "./session"
import {
  ajouterEpreuveEnBase,
  ajouterModeleChecklistEnBase,
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

// Par défaut l'épreuve est à venir (année suivante). Avec « commence aujourd'hui », elle est commencée : un point créé
// maintenant est « ajouté pendant l'épreuve » (débrief), et la date est celle de Paris, comme dans l'app.
export async function preparerEngagementChecklist(equipe: Equipe, options: { commenceAujourdhui?: boolean } = {}): Promise<EngagementChecklist> {
  const annee = new Date().getFullYear() + 1
  const debut = options.commenceAujourdhui ? jourParis(0) : `${annee}-06-01`
  const fin = options.commenceAujourdhui ? jourParis(1) : `${annee}-06-02`
  const saisonId = await preparerSaison(equipe, annee)
  const eventId = await ajouterEpreuveEnBase(equipe, saisonId, `Rallye Check-lists ${equipe.horodatage}`, debut, fin)
  const vehicleId = await ajouterVoitureDeCourse(equipe, `Saxo ${equipe.horodatage}`)
  const entryId = await engagerVehiculeEnBase(equipe, eventId, vehicleId, "inscrit")
  // Le modèle de la team doit exister avant l'événement : sans modèle disponible, aucune proposition.
  await ajouterModeleChecklistEnBase(equipe, "Contrôle avant départ", ["Triangle de présentation", "Trousse de secours"])
  emettreEvenement(equipe, "saison.engagement_cree", { entryId, eventId, vehicleId })
  return { entryId, eventId, vehicleId }
}
