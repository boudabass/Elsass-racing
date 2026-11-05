// Tâches du socle (core_task) créées par les événements des apps (tâche 5.7a, article 956 §5). Le socle écrit ses propres
// tables : aucune app n'écrit core_task (règle 2 de CLAUDE.md). Gestionnaires enregistrés à l'import par
// src/apps/gestionnaires-serveur.ts.
import { z } from "zod"

import type { ContexteTeam } from "@/core/contexte"
import { enregistrerGestionnaire, type EvenementRecu } from "@/core/evenements/gestionnaires"
import { newId } from "@/core/ids"
import { executerPourTeam, prismaPourTeam } from "@/lib/prisma"

import { creerTache } from "./ecriture"
import { libelleTacheProbleme, pointTraiteParGarage } from "./regles"

// checklist.probleme_signale : le point, sa liste, la personne affectée et son lien. Lu sans relire Check-lists.
const chargeProblemeSignale = z
  .object({
    pointId: z.string().uuid(),
    epreuveId: z.string().uuid(),
    libelle: z.string().nullish(),
    listeTitre: z.string().nullish(),
    personneId: z.string().uuid().nullish(),
    lienType: z.string().nullish(),
    lienId: z.string().uuid().nullish(),
  })
  .passthrough()

// Un problème sans organe ouvre une tâche, assignée à la personne affectée au point si elle existe. Une seule tâche à faire
// par point : un problème déjà signalé et non fait ne se double pas.
async function creerTacheProbleme(ctx: ContexteTeam, evenement: EvenementRecu): Promise<void> {
  const analyse = chargeProblemeSignale.safeParse(evenement.donnees)
  if (!analyse.success) return
  const { pointId, epreuveId, libelle, listeTitre, personneId, lienType, lienId } = analyse.data
  if (pointTraiteParGarage(lienType ?? null, lienId ?? null)) return

  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const existante = await client.coreTask.findFirst({
    where: { teamId: ctx.teamId, app: "checklist", ficheType: "point", ficheId: pointId, statut: "a_faire", deletedAt: null },
    select: { id: true },
  })
  if (existante) return

  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.coreTask.create({
      data: {
        id: newId(),
        teamId: ctx.teamId,
        app: "checklist",
        ficheType: "point",
        ficheId: pointId,
        eventId: epreuveId,
        titre: libelleTacheProbleme(libelle, listeTitre),
        assigneePersonId: personneId ?? null,
        statut: "a_faire",
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    }),
  )
}

enregistrerGestionnaire("core", "checklist.probleme_signale", creerTacheProbleme)

// partenaires.relance_due : une tâche « Relancer » assignée au suivi, à la date de la relance. Une seule tâche à faire par
// partenaire : une relance déjà ouverte ne se double pas. Lu sans relire Partenaires (la charge porte le suivi).
const chargeRelanceDueLue = z
  .object({
    partnerId: z.string().min(1),
    partenaireNom: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    suiviParPersonId: z.string().min(1).nullish(),
  })
  .passthrough()

async function creerTacheRelance(ctx: ContexteTeam, evenement: EvenementRecu): Promise<void> {
  const analyse = chargeRelanceDueLue.safeParse(evenement.donnees)
  if (!analyse.success) return
  const { partnerId, partenaireNom, date, suiviParPersonId } = analyse.data

  const existante = await prismaPourTeam(ctx.teamId, ctx.userId).coreTask.findFirst({
    where: { teamId: ctx.teamId, app: "partenaires", ficheType: "partner", ficheId: partnerId, statut: "a_faire", deletedAt: null },
    select: { id: true },
  })
  if (existante) return

  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    creerTache(tx, ctx, {
      app: "partenaires",
      ficheType: "partner",
      ficheId: partnerId,
      titre: `Relancer ${partenaireNom}`,
      assigneePersonId: suiviParPersonId ?? null,
      echeance: new Date(`${date}T00:00:00Z`),
    }),
  )
}

enregistrerGestionnaire("core", "partenaires.relance_due", creerTacheRelance)
