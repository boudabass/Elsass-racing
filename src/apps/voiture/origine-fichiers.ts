// Origines des fichiers de Voiture pour « Tous les fichiers » (tâche 5.4). Voiture ne se voit qu'au niveau lecture ou plus ;
// les papiers portent le type et le nom du véhicule. Les photos de pose (emplacements) ne sont pas affichées en 5.4.
import { niveauDe } from "@/core/actions/actions-serveur"
import type { FicheOrigine, OrigineFichier } from "@/core/fichiers/types-origine"
import { aAuMoins } from "@/core/droits/niveaux"
import { prismaPourTeam } from "@/lib/prisma"

import { libelleDuPapier } from "./libelles"

export const origineVehicule: OrigineFichier = {
  app: "voiture",
  ficheType: "vehicle",

  async fichesVisibles(ctx, ids) {
    if (ids.length === 0 || !aAuMoins(await niveauDe(ctx, "voiture"), "lecture")) return []
    const vehicules = await prismaPourTeam(ctx.teamId, ctx.userId).coreVehicle.findMany({
      where: { teamId: ctx.teamId, id: { in: [...ids] }, deletedAt: null },
      select: { id: true, nomCourt: true },
    })
    return vehicules.map((v): FicheOrigine => ({ id: v.id, libelle: v.nomCourt, chemin: `/apps/voiture/vehicules/${v.id}` }))
  },
}

export const originePapier: OrigineFichier = {
  app: "voiture",
  ficheType: "paper",

  async fichesVisibles(ctx, ids) {
    if (ids.length === 0 || !aAuMoins(await niveauDe(ctx, "voiture"), "lecture")) return []
    const papiers = await prismaPourTeam(ctx.teamId, ctx.userId).voiturePaper.findMany({
      where: { teamId: ctx.teamId, id: { in: [...ids] }, deletedAt: null },
      select: { id: true, type: true, libelle: true, vehicleId: true, vehicle: { select: { nomCourt: true } } },
    })
    return papiers.map((p): FicheOrigine => ({
      id: p.id,
      libelle: `${libelleDuPapier(p.type, p.libelle)} : ${p.vehicle.nomCourt}`,
      chemin: `/apps/voiture/vehicules/${p.vehicleId}`,
    }))
  },
}

export const origineAffectationPhoto: OrigineFichier = {
  app: "voiture",
  ficheType: "slot_assignment",
  masque: "Photo de pose : affichage après le plan de déco (non branché en 5.4)",
  async fichesVisibles() {
    return []
  },
}
