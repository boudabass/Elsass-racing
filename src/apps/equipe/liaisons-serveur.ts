// Liaisons d'Équipe avec les autres apps (tâche 5.1, brief §5). Gestionnaires enregistrés à l'import, par
// src/apps/gestionnaires-serveur.ts. Un gestionnaire ne parle qu'aux services d'Équipe : il lit Saison par les lectures
// partagées, jamais ses tables saison_, et n'écrit que dans les tables equipe_.
//
// Ce qui n'a pas de gestionnaire, et pourquoi :
//   - settings.membre_invite : la personne n'existe pas encore, rien à écrire.
//   - settings.membre_retire : rien n'est effacé, l'historique reste (le statut de l'adhésion suffit).
//   - settings.ludique_modifie : le réglage se lit à l'affichage (ludiqueAfficheDansLaTeam).

import { lireEpreuvesEquipageValidees, lireRessentiDebrief } from "@/apps/saison/lectures-partagees"
import { ludiqueAfficheDansLaTeam } from "@/apps/settings/preferences-serveur"
import type { ContexteTeam } from "@/core/contexte"
import { emettre } from "@/core/evenements/bus-serveur"
import { enregistrerGestionnaire, type EvenementRecu } from "@/core/evenements/gestionnaires"
import { newId } from "@/core/ids"
import { executerPourTeam, prismaPourTeam } from "@/lib/prisma"
import { avecReprisePourConflit } from "@/lib/reprise-conflit"

import {
  chargeDebriefSaisi,
  chargeEngagementCree,
  chargeMembreRejoint,
  chargePalierAtteint,
  chargeResultatEngagement,
  cleDisponibilite,
} from "./charges"
import { epreuvesAssistanceIds, epreuvesDuPalier, palierDepuis } from "./regles"
import { assurerProfilDans } from "./services-serveur"

// --- Palier d'expérience --------------------------------------------------------------------

// Épreuves d'assistance : affectée ET « vient ». Le palier compte les épreuves, jamais les classements.
async function epreuvesAssistanceDe(ctx: ContexteTeam, personId: string): Promise<string[]> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const affectations = await client.equipeAssignment.findMany({ where: { teamId: ctx.teamId, personId, deletedAt: null }, select: { eventId: true } })
  const venues = await client.equipeAvailability.findMany({
    where: { teamId: ctx.teamId, personId, reponse: "vient", deletedAt: null },
    select: { eventId: true },
  })
  return epreuvesAssistanceIds(
    affectations.map((affectation) => affectation.eventId),
    venues.map((venue) => venue.eventId),
  )
}

// Recalcule le palier d'une personne. Il ne descend jamais (palierDepuis). Un passage de palier n'est annoncé que si la
// personne affiche ses trophées et si le ludique de la team est actif ; le palier est gardé dans tous les cas.
export async function mettreAJourPalierDans(ctx: ContexteTeam, personId: string): Promise<void> {
  const profilId = await assurerProfilDans(ctx, personId)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const profil = await client.equipeProfile.findFirst({
    where: { id: profilId, teamId: ctx.teamId, deletedAt: null },
    select: { palier: true, afficherTrophees: true },
  })
  if (!profil) return

  const equipage = await lireEpreuvesEquipageValidees(ctx, personId)
  const assistance = await epreuvesAssistanceDe(ctx, personId)
  const nouveau = palierDepuis(epreuvesDuPalier(equipage, assistance), profil.palier)
  if (nouveau === profil.palier) return

  await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
      tx.equipeProfile.update({ where: { id: profilId }, data: { palier: nouveau, rev: { increment: 1 }, updatedBy: ctx.userId } }),
    ),
  )
  if (profil.afficherTrophees && (await ludiqueAfficheDansLaTeam(ctx))) {
    await emettre(ctx, "equipe.palier_atteint", chargePalierAtteint.parse({ personId, palier: nouveau }))
  }
}

// Un résultat validé ou annulé touche l'équipage de l'engagement et les personnes affectées à l'épreuve (assistance).
async function paliersApresResultat(ctx: ContexteTeam, evenement: EvenementRecu): Promise<void> {
  const analyse = chargeResultatEngagement.safeParse(evenement.donnees)
  if (!analyse.success) return
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const engagement = await client.coreEventEntry.findFirst({
    where: { id: analyse.data.entryId, teamId: ctx.teamId, deletedAt: null },
    select: { eventId: true, piloteId: true, copiloteId: true },
  })
  if (!engagement) return
  const affectees = await client.equipeAssignment.findMany({
    where: { teamId: ctx.teamId, eventId: engagement.eventId, deletedAt: null },
    select: { personId: true },
  })
  const personnes = new Set(
    [engagement.piloteId, engagement.copiloteId, ...affectees.map((affectation) => affectation.personId)].filter(
      (personId): personId is string => personId !== null,
    ),
  )
  for (const personId of Array.from(personnes)) await mettreAJourPalierDans(ctx, personId)
}

enregistrerGestionnaire("equipe", "saison.resultat_valide", (ctx: ContexteTeam, evenement: EvenementRecu) => paliersApresResultat(ctx, evenement))
enregistrerGestionnaire("equipe", "saison.resultat_annule", (ctx: ContexteTeam, evenement: EvenementRecu) => paliersApresResultat(ctx, evenement))

// --- Humeur : ressenti du débrief ------------------------------------------------------------

// Un ressenti par personne et par engagement : le débrief de l'auteur le donne, un débrief modifié le remplace.
export async function enregistrerRessentiDans(ctx: ContexteTeam, entryId: string, auteurMembershipId: string): Promise<void> {
  const ressenti = await lireRessentiDebrief(ctx, entryId, auteurMembershipId)
  if (ressenti === null) return
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const membre = await client.coreMembership.findFirst({
    where: { id: auteurMembershipId, teamId: ctx.teamId, deletedAt: null },
    select: { personId: true },
  })
  if (!membre?.personId) return
  const personId = membre.personId
  await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
      const maj = await tx.equipeMood.updateMany({
        where: { teamId: ctx.teamId, personId, eventEntryId: entryId, deletedAt: null },
        data: { ressenti, saisiLe: new Date(), rev: { increment: 1 }, updatedBy: ctx.userId },
      })
      if (maj.count === 0) {
        await tx.equipeMood.createMany({
          skipDuplicates: true,
          data: [
            {
              id: newId(),
              teamId: ctx.teamId,
              personId,
              eventEntryId: entryId,
              ressenti,
              createdBy: ctx.userId,
              updatedBy: ctx.userId,
            },
          ],
        })
      }
    }),
  )
}

enregistrerGestionnaire("equipe", "saison.debrief_saisi", async (ctx: ContexteTeam, evenement: EvenementRecu) => {
  const analyse = chargeDebriefSaisi.safeParse(evenement.donnees)
  if (!analyse.success) return
  await enregistrerRessentiDans(ctx, analyse.data.entryId, analyse.data.auteurMembershipId)
})

// --- Demande de disponibilités ---------------------------------------------------------------

// Un engagement créé : chaque membre actif qui a un accès à Équipe reçoit une action dans sa boîte, sauf s'il a déjà
// répondu. Pas de ligne écrite à l'avance dans equipe_availability : la réponse la crée.
export async function demanderDisponibilitesDans(ctx: ContexteTeam, entryId: string): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const engagement = await client.coreEventEntry.findFirst({
    where: { id: entryId, teamId: ctx.teamId, deletedAt: null },
    select: { eventId: true, event: { select: { nom: true } } },
  })
  if (!engagement) return
  const membres = await client.coreMembership.findMany({
    where: {
      teamId: ctx.teamId,
      statut: "actif",
      deletedAt: null,
      role: { in: ["responsable", "equipage", "assistance"] },
      personId: { not: null },
    },
    select: { id: true, personId: true },
  })
  for (const membre of membres) {
    if (!membre.personId) continue
    const reponse = await client.equipeAvailability.findFirst({
      where: { teamId: ctx.teamId, personId: membre.personId, eventId: engagement.eventId, deletedAt: null },
      select: { id: true },
    })
    if (reponse) continue
    await emettre(ctx, "equipe.action_requise", {
      type: "disponibilite_a_repondre",
      cleUnicite: cleDisponibilite(membre.personId, engagement.eventId),
      titre: `Tes disponibilités : ${engagement.event.nom}`,
      contexte: engagement.event.nom,
      eventId: engagement.eventId,
      destinataires: { memberships: [membre.id] },
      boutons: [{ cle: "repondre", libelle: "Répondre" }],
      priorite: 5,
      niveauRequis: "contribution",
    })
  }
}

enregistrerGestionnaire("equipe", "saison.engagement_cree", async (ctx: ContexteTeam, evenement: EvenementRecu) => {
  const analyse = chargeEngagementCree.safeParse(evenement.donnees)
  if (!analyse.success) return
  await demanderDisponibilitesDans(ctx, analyse.data.entryId)
})

// --- Profil d'un membre rejoint --------------------------------------------------------------

enregistrerGestionnaire("equipe", "settings.membre_rejoint", async (ctx: ContexteTeam, evenement: EvenementRecu) => {
  const analyse = chargeMembreRejoint.safeParse(evenement.donnees)
  if (!analyse.success) return
  const membre = await prismaPourTeam(ctx.teamId, ctx.userId).coreMembership.findFirst({
    where: { id: analyse.data.membershipId, teamId: ctx.teamId, deletedAt: null },
    select: { personId: true },
  })
  if (membre?.personId) await assurerProfilDans(ctx, membre.personId)
})
