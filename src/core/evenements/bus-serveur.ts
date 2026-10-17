import type { Prisma } from "@/generated/prisma/client"
import { prismaPourTeam } from "@/lib/prisma"
import { newId } from "@/core/ids"

import type { ContexteTeam } from "../contexte"

import { EVENEMENTS } from "./catalogue"
import { emetteurDe, estNomValide } from "./evenements"
import { traiterEnAttente } from "./traitement-serveur"

export class ErreurEvenement extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ErreurEvenement"
  }
}

export interface OptionsEmission {
  // Destinataires fixés par l'appelant. Sert au seul cas dynamique : core.action_decidee.
  destinataires?: string[]
}

// Destinataires d'un nom : les apps écrites dans le catalogue, plus les apps activées
// de la team si le catalogue dit « * » (toutes les apps sauf l'émetteur).
async function resoudreDestinataires(ctx: ContexteTeam, nom: string, emetteur: string): Promise<string[]> {
  const evenement = EVENEMENTS.find((e) => e.nom === nom)
  // Motif générique <app>.action_requise ou action_levee : destinataire unique, le socle.
  if (!evenement) return ["core"]

  const explicites = evenement.ecoutePar.filter((d) => d !== "*") as string[]
  if (!evenement.ecoutePar.includes("*")) return Array.from(new Set(explicites))

  const activees = await prismaPourTeam(ctx.teamId, ctx.userId).coreTeamApp.findMany({
    where: { teamId: ctx.teamId, activee: true, deletedAt: null },
    select: { appCle: true },
  })
  const etoiles = activees.map((a) => a.appCle).filter((cle) => cle !== emetteur)
  return Array.from(new Set([...explicites, ...etoiles]))
}

// Émet un événement : l'app émettrice est le préfixe du nom. Écrit l'événement et une
// livraison par destinataire, puis traite les livraisons en attente de la team.
// Renvoie l'identifiant de l'événement.
export async function emettre(
  ctx: ContexteTeam,
  nom: string,
  donnees: Record<string, unknown>,
  version = 1,
  options: OptionsEmission = {},
): Promise<string> {
  if (!estNomValide(nom)) {
    throw new ErreurEvenement(`Nom d'événement inconnu : « ${nom} ». Aucun événement n'a été émis.`)
  }

  const emetteur = emetteurDe(nom) as string
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const destinataires = options.destinataires ?? (await resoudreDestinataires(ctx, nom, emetteur))

  const id = newId()
  await client.coreDomainEvent.create({
    data: {
      id,
      teamId: ctx.teamId,
      appEmettrice: emetteur,
      nom,
      version,
      donnees: donnees as Prisma.InputJsonValue,
    },
  })

  if (destinataires.length > 0) {
    await client.coreEventDelivery.createMany({
      data: destinataires.map((appDestinataire) => ({
        id: newId(),
        teamId: ctx.teamId,
        domainEventId: id,
        appDestinataire,
      })),
    })
  }

  // Choix provisoire du lot 1 : traitement immédiat, dans la même requête.
  await traiterEnAttente(ctx)
  return id
}
