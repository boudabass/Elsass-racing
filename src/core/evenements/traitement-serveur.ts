// Traitement des livraisons d'événements. Gestionnaires enregistrés en mémoire.
//
// Choix provisoire du lot 1 : pas de worker. Le traitement s'exécute dans la requête qui
// vient d'émettre l'événement (cf. bus-serveur.ts). Une livraison qui échoue est retentée
// aux appels suivants, jusqu'à MAX_TENTATIVES.

import { prismaPourTeam } from "@/lib/prisma"

import type { ContexteTeam } from "../contexte"

import { trouverGestionnaire, type EvenementRecu } from "./gestionnaires"

export type { EvenementRecu, Gestionnaire } from "./gestionnaires"
export { enregistrerGestionnaire } from "./gestionnaires"

export const MAX_TENTATIVES = 5

// Traite les livraisons en attente de la team, dans l'ordre d'émission.
export async function traiterEnAttente(ctx: ContexteTeam): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const livraisons = await client.coreEventDelivery.findMany({
    where: {
      teamId: ctx.teamId,
      OR: [{ statut: "en_attente" }, { statut: "erreur", tentatives: { lt: MAX_TENTATIVES } }],
    },
    include: { domainEvent: true },
    orderBy: [{ domainEvent: { emisAt: "asc" } }, { createdAt: "asc" }],
  })

  for (const livraison of livraisons) {
    const evenement = livraison.domainEvent
    const fn = trouverGestionnaire(livraison.appDestinataire, evenement.nom)

    if (!fn) {
      await client.coreEventDelivery.update({
        where: { id: livraison.id },
        data: { statut: "traite", traiteAt: new Date(), derniereErreur: "aucun gestionnaire" },
      })
      continue
    }

    try {
      await fn(ctx, {
        id: evenement.id,
        nom: evenement.nom,
        version: evenement.version,
        appEmettrice: evenement.appEmettrice,
        donnees: evenement.donnees,
      })
      await client.coreEventDelivery.update({
        where: { id: livraison.id },
        data: { statut: "traite", traiteAt: new Date(), derniereErreur: null },
      })
    } catch (erreur) {
      await client.coreEventDelivery.update({
        where: { id: livraison.id },
        data: {
          statut: "erreur",
          tentatives: { increment: 1 },
          derniereErreur: erreur instanceof Error ? erreur.message : String(erreur),
        },
      })
    }
  }
}
