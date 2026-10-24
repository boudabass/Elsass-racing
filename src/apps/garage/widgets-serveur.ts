// Lectures des widgets du Garage (tâche 4.5, §4). Elles prennent le contexte de l'appelant : pas de garde d'écran
// ici, le QG est déjà gardé. Aucun prix ne sort de ces lectures.

import type { ContexteTeam } from "@/core/contexte"
import { prismaPourTeam } from "@/lib/prisma"

import { lirePlanAvantEpreuve, lireEtatsAtelier } from "./lectures-partagees"
import { libelleFiabilite, libelleLivraisons, libelleTravaux, libelleZonesRouges } from "./widgets"

// Voitures de la team dont l'atelier est préparé (au moins un organe).
async function voituresPreparees(ctx: ContexteTeam) {
  const vehicules = await prismaPourTeam(ctx.teamId, ctx.userId).coreVehicle.findMany({
    where: { teamId: ctx.teamId, deletedAt: null },
    select: { id: true, nomCourt: true },
    orderBy: { nomCourt: "asc" },
  })
  const etats = await Promise.all(vehicules.map((vehicule) => lireEtatsAtelier(ctx, vehicule.id)))
  return vehicules.flatMap((vehicule, rang) => {
    const etat = etats[rang]
    return etat && etat.organes.length > 0 ? [{ id: vehicule.id, nom: vehicule.nomCourt, indice: etat.indice.indice }] : []
  })
}

// Fiabilité de chaque voiture préparée.
export async function widgetFiabiliteGarage(ctx: ContexteTeam) {
  const voitures = await voituresPreparees(ctx)
  return voitures.map((voiture) => ({
    vehicleId: voiture.id,
    nom: voiture.nom,
    indice: voiture.indice,
    libelle: libelleFiabilite(voiture.indice),
  }))
}

// Organes en zone rouge par voiture, avant la prochaine épreuve engagée. Après l'épreuve seulement si l'estimation existe.
export async function widgetPiecesZoneRouge(ctx: ContexteTeam) {
  const voitures = await voituresPreparees(ctx)
  const plans = await Promise.all(voitures.map((voiture) => lirePlanAvantEpreuve(ctx, voiture.id, null, false)))
  return voitures.map((voiture, rang) => {
    const plan = plans[rang]
    const rougeApres = plan?.epreuve ? plan.apres.rouge : null
    const rouge = plan?.maintenant.rouge ?? 0
    return {
      vehicleId: voiture.id,
      nom: voiture.nom,
      rouge,
      rougeApres,
      epreuveNom: plan?.epreuve?.epreuveNom ?? null,
      libelle: libelleZonesRouges(rouge, rougeApres),
    }
  })
}

// Travaux et livraisons de la team : ordres en cours et prévus, commandes attendues et prochaine date prévue.
export async function widgetTravauxLivraisons(ctx: ContexteTeam) {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const [enCours, prevus, attendues] = await Promise.all([
    client.garageWorkOrder.count({ where: { teamId: ctx.teamId, statut: "en_cours", deletedAt: null } }),
    client.garageWorkOrder.count({ where: { teamId: ctx.teamId, statut: "prevu", deletedAt: null } }),
    client.garagePurchase.findMany({
      where: { teamId: ctx.teamId, statut: { in: ["commandee", "expediee"] }, deletedAt: null },
      select: { livraisonPrevueLe: true },
    }),
  ])
  const dates = attendues.flatMap((achat) => (achat.livraisonPrevueLe ? [achat.livraisonPrevueLe] : []))
  const prochaine = dates.length > 0 ? new Date(Math.min(...dates.map((date) => date.getTime()))) : null
  return {
    enCours,
    prevus,
    livraisonsAttendues: attendues.length,
    prochaineLivraison: prochaine,
    libelleTravaux: libelleTravaux(enCours, prevus),
    libelleLivraisons: libelleLivraisons(attendues.length, prochaine),
  }
}
