// Liaisons de Check-lists avec les autres apps (tâche 5.5a, brief §5). Gestionnaires enregistrés à l'import par
// src/apps/gestionnaires-serveur.ts. Check-lists ne lit que les lignes du socle (core_event, core_event_entry) et écrit
// dans ses propres tables checklist_ ; il ne modifie jamais une table d'une autre app.
//
// settings.membre_retire : une action « Réassigner les points » (motif checklist.action_requise), sans ligne
// checklist_proposal : décision de l'orchestrateur du 01/11, 956 §3 ne prévoit pas de type pour cela.

import type { ContexteTeam } from "@/core/contexte"
import { emettre } from "@/core/evenements/bus-serveur"
import { enregistrerGestionnaire, type EvenementRecu } from "@/core/evenements/gestionnaires"
import { newId } from "@/core/ids"
import { executerPourTeam, prismaPourTeam } from "@/lib/prisma"

import { chargeActionRequise, chargeDecisionAction, chargeEngagementCree, chargeMembreRetire } from "./charges"
import { disciplineDeType, doitProposerReassignation } from "./regles"
import { creerListeDepuisModeleDans } from "./services-serveur"

// Contenu d'une proposition « créer les listes » (écrit ici, lu à la décision).
type ContenuCreerListes = {
  entryId: string
  eventId: string
  vehicleId: string
  modelesEngagement: string[]
  modelesEpreuve: string[]
}

// ─── Proposition « créer les listes » (saison.engagement_cree) ───────────────

// Modèles à proposer : ceux de portée engagement, et ceux de portée épreuve tant que l'épreuve n'a pas de liste commune.
// Tout modèle transversal (sans discipline) s'applique ; un modèle de discipline ne s'applique qu'à cette discipline.
async function proposerCreationListes(ctx: ContexteTeam, evenement: EvenementRecu, donnees: { entryId: string; eventId: string; vehicleId: string }): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)

  // Une seule proposition non ignorée par engagement (index unique partiel, docs/schema-checklist.md, Q6).
  const existante = await client.checklistProposal.findFirst({
    where: {
      teamId: ctx.teamId,
      type: "creer_listes",
      statut: { not: "ignoree" },
      deletedAt: null,
      contenu: { path: ["entryId"], equals: donnees.entryId },
    },
    select: { id: true },
  })
  if (existante) return

  const epreuve = await client.coreEvent.findFirst({ where: { id: donnees.eventId, teamId: ctx.teamId, deletedAt: null }, select: { id: true, type: true } })
  if (!epreuve) return
  const discipline = disciplineDeType(epreuve.type)
  const disponibles = {
    deletedAt: null,
    AND: [
      { OR: [{ fourni: true, teamId: null }, { teamId: ctx.teamId }] },
      { OR: [{ discipline: null }, ...(discipline ? [{ discipline }] : [])] },
    ],
  }

  const modelesEngagement = await client.checklistTemplate.findMany({
    where: { ...disponibles, portee: "engagement" },
    orderBy: [{ ordre: "asc" }, { id: "asc" }],
    select: { id: true },
  })

  const communes = await client.checklistList.count({ where: { teamId: ctx.teamId, epreuveId: epreuve.id, engagementId: null, deletedAt: null } })
  const modelesEpreuve = communes === 0
    ? await client.checklistTemplate.findMany({ where: { ...disponibles, portee: "epreuve" }, orderBy: [{ ordre: "asc" }, { id: "asc" }], select: { id: true } })
    : []

  // Aucun modèle disponible : aucune proposition, donc pas d'action vide (brief §5).
  if (modelesEngagement.length === 0 && modelesEpreuve.length === 0) return

  const contenu: ContenuCreerListes = {
    entryId: donnees.entryId,
    eventId: epreuve.id,
    vehicleId: donnees.vehicleId,
    modelesEngagement: modelesEngagement.map((modele) => modele.id),
    modelesEpreuve: modelesEpreuve.map((modele) => modele.id),
  }
  const propositionId = newId()
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.checklistProposal.create({
      data: {
        id: propositionId,
        teamId: ctx.teamId,
        evenementSourceId: evenement.id,
        type: "creer_listes",
        contenu,
        statut: "proposee",
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    }),
  )

  const charge = chargeActionRequise.parse({
    type: "creer_listes",
    cleUnicite: `creer_listes:${donnees.entryId}`,
    titre: "Créer les listes de l'engagement",
    ficheType: "engagement",
    ficheId: donnees.entryId,
    eventId: epreuve.id,
    destinataires: { roles: ["responsable"] },
    boutons: [
      { cle: "accepter", libelle: "Accepter" },
      { cle: "ignorer", libelle: "Ignorer" },
    ],
    priorite: 5,
    niveauRequis: "gestion",
    cleRegroupement: "listes_checklist",
  })
  await emettre(ctx, "checklist.action_requise", charge)

  // Le socle crée la core_action : on relie la proposition à elle, si elle existe déjà.
  const action = await client.coreAction.findFirst({
    where: { teamId: ctx.teamId, cleUnicite: charge.cleUnicite },
    select: { id: true },
  })
  if (action) {
    await client.checklistProposal.update({ where: { id: propositionId }, data: { actionId: action.id } })
  }
}

enregistrerGestionnaire("checklist", "saison.engagement_cree", async (ctx: ContexteTeam, evenement: EvenementRecu) => {
  const analyse = chargeEngagementCree.safeParse(evenement.donnees)
  if (!analyse.success) return
  await proposerCreationListes(ctx, evenement, analyse.data)
})

// ─── Décision de la boîte (core.action_decidee) ──────────────────────────────

// Accepter crée les listes proposées ; Ignorer ne crée rien. La décision revient à l'app d'origine (règle 2 de CLAUDE.md).
async function appliquerDecisionChecklist(ctx: ContexteTeam, evenement: EvenementRecu): Promise<void> {
  const analyse = chargeDecisionAction.safeParse(evenement.donnees)
  if (!analyse.success || analyse.data.type !== "creer_listes" || !analyse.data.ficheId) return
  const entryId = analyse.data.ficheId
  const decision = analyse.data.decision
  if (decision !== "accepter" && decision !== "ignorer") return

  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const proposition = await client.checklistProposal.findFirst({
    where: { teamId: ctx.teamId, type: "creer_listes", statut: "proposee", deletedAt: null, contenu: { path: ["entryId"], equals: entryId } },
  })
  if (!proposition) return

  if (decision === "accepter") {
    const contenu = proposition.contenu as unknown as ContenuCreerListes
    const communes = await client.checklistList.count({ where: { teamId: ctx.teamId, epreuveId: contenu.eventId, engagementId: null, deletedAt: null } })
    if (communes === 0) {
      for (const modeleId of contenu.modelesEpreuve) {
        await creerListeDepuisModeleDans(ctx, modeleId, contenu.eventId, null)
      }
    }
    for (const modeleId of contenu.modelesEngagement) {
      await creerListeDepuisModeleDans(ctx, modeleId, contenu.eventId, contenu.entryId)
    }
  }

  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.checklistProposal.update({
      where: { id: proposition.id },
      data: {
        statut: decision === "accepter" ? "acceptee" : "ignoree",
        traiteeParId: ctx.userId,
        traiteeLe: new Date(),
        rev: { increment: 1 },
        updatedBy: ctx.userId,
      },
    }),
  )
}

enregistrerGestionnaire("checklist", "core.action_decidee", appliquerDecisionChecklist)

// ─── Réassignation (settings.membre_retire) ──────────────────────────────────

// Une action par personne retirée, seulement si elle a encore des points à faire ou en problème. Elle mène aux listes
// (le lien vers l'accueil de Check-lists suffit en 5.5a ; l'écran viendra en 5.6). Levée par checklist.action_levee
// dès qu'il ne reste plus de point en attente (services-serveur.ts, levereReassignationSiPlusDePoint).
export async function proposerReassignationDans(ctx: ContexteTeam, membershipId: string): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const membre = await client.coreMembership.findFirst({ where: { id: membershipId, teamId: ctx.teamId }, select: { personId: true } })
  if (!membre?.personId) return
  const personne = await client.corePerson.findFirst({
    where: { id: membre.personId, teamId: ctx.teamId, deletedAt: null },
    select: { id: true, prenom: true, nom: true },
  })
  if (!personne) return

  const points = await client.checklistItem.findMany({
    where: { teamId: ctx.teamId, personneId: personne.id, deletedAt: null, section: { deletedAt: null, liste: { deletedAt: null } } },
    select: { statut: true },
  })
  if (!doitProposerReassignation(points.map((point) => point.statut))) return

  await emettre(
    ctx,
    "checklist.action_requise",
    chargeActionRequise.parse({
      type: "reassigner_points",
      cleUnicite: `reassigner_points:${personne.id}`,
      titre: `Réassigner les points de ${personne.prenom} ${personne.nom}`,
      ficheType: "personne",
      ficheId: personne.id,
      destinataires: { roles: ["responsable"] },
      boutons: [{ cle: "voir", libelle: "Voir les listes" }],
      priorite: 5,
      niveauRequis: "gestion",
      cleRegroupement: "listes_checklist",
    }),
  )
}

enregistrerGestionnaire("checklist", "settings.membre_retire", async (ctx: ContexteTeam, evenement: EvenementRecu) => {
  const analyse = chargeMembreRetire.safeParse(evenement.donnees)
  if (!analyse.success) return
  await proposerReassignationDans(ctx, analyse.data.membershipId)
})
