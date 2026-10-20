// Gestionnaires du socle : transforment les événements *.action_requise et *.action_levee
// en lignes de la boîte d'actions (core_action). Enregistrés pour l'app « core ».

import { z } from "zod"

import { newId } from "@/core/ids"
import { NIVEAUX } from "@/core/droits/niveaux"
import { enregistrerGestionnaireTousContextes, type EvenementRecu } from "@/core/evenements/gestionnaires"
import type { ContexteEvenement } from "@/core/contexte"
import { clientPourContexte } from "@/core/client-contexte-serveur"

import type { Prisma } from "@/generated/prisma/client"

const schemaActionRequise = z.object({
  type: z.string().min(1),
  cleUnicite: z.string().min(1),
  titre: z.string().min(1),
  contexte: z.string().optional(),
  ficheType: z.string().min(1).optional(),
  ficheId: z.string().min(1).optional(),
  eventId: z.string().min(1).optional(),
  destinataires: z
    .object({
      roles: z.array(z.enum(["responsable", "equipage", "assistance", "invite"])).optional(),
      memberships: z.array(z.string().min(1)).optional(),
    })
    .refine((d) => (d.roles?.length ?? 0) + (d.memberships?.length ?? 0) > 0, {
      message: "Au moins un destinataire (rôle ou membership) est requis.",
    }),
  boutons: z.array(z.object({ cle: z.string().min(1), libelle: z.string().min(1) })).min(1).max(4),
  priorite: z.number().int().min(1).max(9),
  bloquant: z.boolean().optional(),
  echeance: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), { message: "Échéance : date ISO attendue." })
    .optional(),
  cleRegroupement: z.string().min(1).optional(),
  niveauRequis: z.enum(NIVEAUX).optional(),
  terrain: z.boolean().optional(),
})

const schemaActionLevee = z.object({ cleUnicite: z.string().min(1) })

// Ce qui décide qui voit une action, et à quel niveau. Stocké dans destinataires (Json).
function destinatairesStockes(d: z.infer<typeof schemaActionRequise>["destinataires"], niveauRequis: string, terrain: boolean) {
  return { roles: d.roles ?? [], memberships: d.memberships ?? [], niveauRequis, terrain }
}

function appDeLEvenement(nom: string): string {
  return nom.split(".")[0]
}

async function actionRequise(ctx: ContexteEvenement, evenement: EvenementRecu): Promise<void> {
  const donnees = schemaActionRequise.parse(evenement.donnees)
  const client = clientPourContexte(ctx)
  const appOrigine = appDeLEvenement(evenement.nom)
  const niveauRequis = donnees.niveauRequis ?? "ecriture"
  const terrain = donnees.terrain ?? false

  const champs = {
    appOrigine,
    type: donnees.type,
    titre: donnees.titre,
    contexte: donnees.contexte ?? null,
    ficheType: donnees.ficheType ?? null,
    ficheId: donnees.ficheId ?? null,
    eventId: donnees.eventId ?? null,
    destinataires: destinatairesStockes(donnees.destinataires, niveauRequis, terrain) as Prisma.InputJsonValue,
    boutons: donnees.boutons as Prisma.InputJsonValue,
    priorite: donnees.priorite,
    bloquant: donnees.bloquant ?? false,
    echeance: donnees.echeance ? new Date(donnees.echeance) : null,
    cleRegroupement: donnees.cleRegroupement ?? null,
  }

  const existante = await client.coreAction.findUnique({
    where: { teamId_cleUnicite: { teamId: ctx.teamId, cleUnicite: donnees.cleUnicite } },
    select: { id: true, statut: true },
  })

  if (!existante) {
    await client.coreAction.create({
      data: { id: newId(), teamId: ctx.teamId, cleUnicite: donnees.cleUnicite, statut: "en_attente", ...champs },
    })
    return
  }

  // « Jamais deux fois le même » : une action en attente est mise à jour, jamais dupliquée.
  // Une action déjà décidée, annulée ou expirée est réouverte : l'unicité de cleUnicite
  // empêche d'en créer une seconde. Choix du lot 1 : la réouverture efface la décision.
  const reouverture =
    existante.statut === "en_attente"
      ? {}
      : { statut: "en_attente" as const, decision: null, decideeParMembershipId: null, decideeAt: null, reporteeJusquAu: null, messageRefus: null }

  await client.coreAction.update({
    where: { id: existante.id },
    data: { ...champs, ...reouverture },
  })
}

async function actionLevee(ctx: ContexteEvenement, evenement: EvenementRecu): Promise<void> {
  const donnees = schemaActionLevee.parse(evenement.donnees)
  const client = clientPourContexte(ctx)
  await client.coreAction.updateMany({
    where: { teamId: ctx.teamId, cleUnicite: donnees.cleUnicite, statut: "en_attente" },
    data: { statut: "annulee" },
  })
}

// Acceptent un contexte système : la page partenaire lève une action sans utilisateur (brief 3.8, point 0.3).
enregistrerGestionnaireTousContextes("core", "*.action_requise", actionRequise)
enregistrerGestionnaireTousContextes("core", "*.action_levee", actionLevee)
