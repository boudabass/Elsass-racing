// Lectures de Voiture partagées avec les autres apps (tâche 3.6, brief section 5). Comme celles de Saison :
// pas de garde, l'app appelante contrôle son propre accès. Ces fonctions ne renvoient que des données de
// résultat, jamais les fiches d'écriture de Voiture. Partenaires s'en sert pour choisir un emplacement.

import type { ContexteTeam } from "@/core/contexte"
import { prismaPourTeam } from "@/lib/prisma"

import { statutEmplacement, type StatutEmplacement } from "./regles"

export type EmplacementPourPartenaire = {
  id: string
  nom: string
  vehicleId: string
  vehicleNom: string
  // « libre », « réservé », « occupé » ou « indisponible » : même règle que le plan de déco.
  statut: StatutEmplacement
}

// Emplacements de tous les véhicules de la team, avec leur statut courant. Le choix d'une contrepartie
// logo les propose ; un emplacement réservé ou occupé reste choisissable, avec la mention affichée à côté.
export async function listerEmplacementsPourPartenaires(ctx: ContexteTeam): Promise<EmplacementPourPartenaire[]> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const emplacements = await client.voitureSlot.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, vehicle: { deletedAt: null } },
    select: {
      id: true,
      nom: true,
      vehicleId: true,
      statut: true,
      vehicle: { select: { nomCourt: true } },
      occupations: { where: { deletedAt: null, statut: { not: "retire" } }, take: 1, select: { statut: true } },
    },
    orderBy: [{ vehicleId: "asc" }, { vue: "asc" }, { ordre: "asc" }],
  })
  return emplacements.map((e) => ({
    id: e.id,
    nom: e.nom,
    vehicleId: e.vehicleId,
    vehicleNom: e.vehicle.nomCourt,
    statut: statutEmplacement(e.occupations[0] ?? null, e.statut === "indisponible"),
  }))
}
