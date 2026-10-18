// Traitement des livraisons d'événements. Gestionnaires enregistrés en mémoire.
//
// Choix provisoire du lot 1 : pas de worker. Le traitement s'exécute dans la requête qui
// vient d'émettre l'événement (cf. bus-serveur.ts). Une livraison qui échoue est retentée
// aux appels suivants, jusqu'à MAX_TENTATIVES.
//
// Un gestionnaire peut émettre à son tour : l'émission relance traiterEnAttente, dans le même
// processus. Pour ne jamais reprendre une livraison déjà en cours (boucle infinie sinon), on note
// celles qui tournent, et on relit l'état de chaque livraison avant de la traiter.

// Tous les gestionnaires, quel que soit le point d'entrée (cf. src/apps/gestionnaires-serveur.ts).
import "@/apps/gestionnaires-serveur"

import { estContexteTeam, type ContexteEvenement } from "../contexte"
import { clientPourContexte } from "../client-contexte-serveur"

import { trouverEnregistrement, type EvenementRecu } from "./gestionnaires"

export type { EvenementRecu, Gestionnaire, GestionnaireTousContextes } from "./gestionnaires"
export { enregistrerGestionnaire, enregistrerGestionnaireTousContextes } from "./gestionnaires"

export const MAX_TENTATIVES = 5

// Livraisons en cours de traitement dans ce processus.
const enCours = new Set<string>()

// Traite les livraisons en attente de la team, dans l'ordre d'émission.
export async function traiterEnAttente(ctx: ContexteEvenement): Promise<void> {
  const client = clientPourContexte(ctx)
  const livraisons = await client.coreEventDelivery.findMany({
    where: {
      teamId: ctx.teamId,
      OR: [{ statut: "en_attente" }, { statut: "erreur", tentatives: { lt: MAX_TENTATIVES } }],
    },
    include: { domainEvent: true },
    orderBy: [{ domainEvent: { emisAt: "asc" } }, { createdAt: "asc" }],
  })

  for (const livraison of livraisons) {
    if (enCours.has(livraison.id)) continue
    // Relue : un traitement imbriqué a pu la traiter entre-temps.
    const etat = await client.coreEventDelivery.findUnique({ where: { id: livraison.id }, select: { statut: true, tentatives: true } })
    const aTraiter = etat?.statut === "en_attente" || (etat?.statut === "erreur" && etat.tentatives < MAX_TENTATIVES)
    if (!aTraiter) continue

    enCours.add(livraison.id)
    try {
      await traiterLivraison(ctx, livraison.id, livraison.appDestinataire, livraison.domainEvent)
    } finally {
      enCours.delete(livraison.id)
    }
  }
}

async function traiterLivraison(
  ctx: ContexteEvenement,
  livraisonId: string,
  appDestinataire: string,
  evenement: { id: string; nom: string; version: number; appEmettrice: string; donnees: unknown },
): Promise<void> {
  const client = clientPourContexte(ctx)
  const enregistrement = trouverEnregistrement(appDestinataire, evenement.nom)

  if (!enregistrement) {
    await client.coreEventDelivery.update({
      where: { id: livraisonId },
      data: { statut: "traite", traiteAt: new Date(), derniereErreur: "aucun gestionnaire" },
    })
    return
  }

  const recu = {
    id: evenement.id,
    nom: evenement.nom,
    version: evenement.version,
    appEmettrice: evenement.appEmettrice,
    donnees: evenement.donnees,
  } as EvenementRecu

  try {
    if (enregistrement.tousContextes) {
      await enregistrement.fn(ctx, recu)
    } else if (estContexteTeam(ctx)) {
      await enregistrement.fn(ctx, recu)
    } else {
      // Un gestionnaire d'app parle au nom d'un membre : il ne traite pas un événement sans utilisateur.
      await client.coreEventDelivery.update({
        where: { id: livraisonId },
        data: { statut: "traite", traiteAt: new Date(), derniereErreur: "contexte système : gestionnaire réservé aux utilisateurs" },
      })
      return
    }
    await client.coreEventDelivery.update({
      where: { id: livraisonId },
      data: { statut: "traite", traiteAt: new Date(), derniereErreur: null },
    })
  } catch (erreur) {
    await client.coreEventDelivery.update({
      where: { id: livraisonId },
      data: {
        statut: "erreur",
        tentatives: { increment: 1 },
        derniereErreur: erreur instanceof Error ? erreur.message : String(erreur),
      },
    })
  }
}
