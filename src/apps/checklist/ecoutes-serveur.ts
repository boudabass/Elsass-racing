// Écoutes de Check-lists (tâche 5.7b, article 956 §5, second tableau). Chaque écoute crée une proposition
// (checklist_proposal) et son action (Accepter, Ignorer) pour les responsables. Accepter écrit dans Check-lists ; Ignorer
// ne fait rien. Check-lists ne lit une autre app que par ses lectures partagées, et n'écrit que dans ses propres tables
// (règle 2). Gestionnaires enregistrés à l'import par src/apps/gestionnaires-serveur.ts.
import * as documents from "@/apps/documents/lectures-partagees"
import * as equipe from "@/apps/equipe/lectures-partagees"
import * as garage from "@/apps/garage/lectures-partagees"
import * as partenaires from "@/apps/partenaires/lectures-partagees"
import * as voiture from "@/apps/voiture/lectures-partagees"
import { lireEngagementsAVenir } from "@/apps/saison/lectures-partagees"
import type { ContexteTeam } from "@/core/contexte"
import { emettre } from "@/core/evenements/bus-serveur"
import { enregistrerGestionnaire, type EvenementRecu } from "@/core/evenements/gestionnaires"
import { newId } from "@/core/ids"
import { avecReprisePourConflit } from "@/lib/reprise-conflit"
import { executerPourTeam, prismaPourTeam } from "@/lib/prisma"

import {
  chargeActionRequise,
  chargeContrepartieEnRetard,
  chargeDecisionAction,
  chargeDocument,
  chargeEpreuveTerminee,
  chargeAbandonDeclare,
  chargeHomologationExpireBientot,
  chargeLicenceExpireBientot,
  chargeLogoPose,
  chargePapierExpireBientot,
  chargePieceZoneRouge,
  chargeTravailTermine,
} from "./charges"
import { disciplineDeType, epreuveCommencee, jourParis, type StatutPoint } from "./regles"
import {
  engagementsSansListeRetour,
  estDoublon,
  pointCochable,
  pointDejaLie,
  titrePointPropose,
  titreRelireReglement,
  type TypeObjetPropose,
  type TypeProposition,
} from "./propositions-regles"
import type { TypeObjetLie } from "./objets-types"
import { changerStatutPointDans, emettreApresChangement, recalculerListe, creerListeDepuisModeleDans } from "./services-serveur"

const TYPES_DE_PROPOSITION: readonly string[] = ["ajouter_point", "cocher_point", "creer_liste_retour", "relire_liste"]
const STATUTS_ENGAGEMENT_A_VENIR = ["envisage", "inscrit", "paye"] as const
const STATUTS_EPREUVE_A_VENIR = ["envisagee", "en_cours"] as const
const RETOUR = "retour"

type Phase = "avant_depart" | "verifications" | "retour"

// ─── Faits : prochaines épreuves, engagements, listes, points ────────────────

// La prochaine épreuve de la team (la première non terminée, par date de début). Sert aux objets qui ne sont pas liés
// à un engagement : contreparties, documents, règlements.
async function prochaineEpreuve(ctx: ContexteTeam): Promise<{ id: string; nom: string } | null> {
  return prismaPourTeam(ctx.teamId, ctx.userId).coreEvent.findFirst({
    where: { teamId: ctx.teamId, deletedAt: null, statut: { in: [...STATUTS_EPREUVE_A_VENIR] }, dateFin: { gte: new Date(jourParis(new Date())) } },
    orderBy: [{ dateDebut: "asc" }, { id: "asc" }],
    select: { id: true, nom: true },
  })
}

// La prochaine épreuve où le véhicule est engagé (épreuve visée des écoutes qui touchent une voiture, 5.7b).
async function prochainEngagementDuVehicule(ctx: ContexteTeam, vehicleId: string): Promise<{ entryId: string; eventId: string } | null> {
  const [prochain] = await lireEngagementsAVenir(ctx, vehicleId)
  return prochain ? { entryId: prochain.entryId, eventId: prochain.eventId } : null
}

// La prochaine épreuve où la personne est pilote ou copilote (épreuve visée des licences et homologations).
async function prochainEngagementDePersonne(ctx: ContexteTeam, personId: string): Promise<{ entryId: string; eventId: string } | null> {
  const entree = await prismaPourTeam(ctx.teamId, ctx.userId).coreEventEntry.findFirst({
    where: {
      teamId: ctx.teamId,
      deletedAt: null,
      statut: { in: [...STATUTS_ENGAGEMENT_A_VENIR] },
      event: { deletedAt: null, statut: { in: [...STATUTS_EPREUVE_A_VENIR] } },
      OR: [{ piloteId: personId }, { copiloteId: personId }],
    },
    orderBy: [{ event: { dateDebut: "asc" } }, { id: "asc" }],
    select: { id: true, eventId: true },
  })
  return entree ? { entryId: entree.id, eventId: entree.eventId } : null
}

// Liste de phase donnée pour un engagement, ou commune à l'épreuve (engagementId null).
async function listeDeEngagement(ctx: ContexteTeam, entryId: string, phase: Phase): Promise<{ id: string; titre: string; epreuveId: string } | null> {
  return prismaPourTeam(ctx.teamId, ctx.userId).checklistList.findFirst({
    where: { teamId: ctx.teamId, engagementId: entryId, phase, deletedAt: null },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, titre: true, epreuveId: true },
  })
}

async function listeCommune(ctx: ContexteTeam, epreuveId: string, phase: Phase): Promise<{ id: string; titre: string; epreuveId: string } | null> {
  return prismaPourTeam(ctx.teamId, ctx.userId).checklistList.findFirst({
    where: { teamId: ctx.teamId, epreuveId, engagementId: null, phase, deletedAt: null },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, titre: true, epreuveId: true },
  })
}

// Les engagements qui ont déjà une liste de phase retour (entrée : identifiants d'engagement).
async function engagementsAvecRetour(ctx: ContexteTeam, entryIds: string[]): Promise<Set<string>> {
  if (entryIds.length === 0) return new Set()
  const listes = await prismaPourTeam(ctx.teamId, ctx.userId).checklistList.findMany({
    where: { teamId: ctx.teamId, engagementId: { in: entryIds }, phase: RETOUR, deletedAt: null },
    select: { engagementId: true },
  })
  return new Set(listes.map((liste) => liste.engagementId).filter((id): id is string => id !== null))
}

// Modèles de phase retour à appliquer : de portée engagement ou épreuve, dans la discipline de l'épreuve.
async function modelesRetour(ctx: ContexteTeam, portee: "engagement" | "epreuve", discipline: ReturnType<typeof disciplineDeType>): Promise<string[]> {
  const modeles = await prismaPourTeam(ctx.teamId, ctx.userId).checklistTemplate.findMany({
    where: {
      deletedAt: null,
      phase: RETOUR,
      portee,
      AND: [
        { OR: [{ fourni: true, teamId: null }, { teamId: ctx.teamId }] },
        { OR: [{ discipline: null }, ...(discipline ? [{ discipline }] : [])] },
      ],
    },
    orderBy: [{ ordre: "asc" }, { id: "asc" }],
    select: { id: true },
  })
  return modeles.map((modele) => modele.id)
}

// Les points liés à un objet, dans les listes données (lecture seule).
async function pointsLies(ctx: ContexteTeam, lienType: TypeObjetLie, lienId: string, listeIds: string[]) {
  if (listeIds.length === 0) return []
  const points = await prismaPourTeam(ctx.teamId, ctx.userId).checklistItem.findMany({
    where: { teamId: ctx.teamId, lienType, lienId, deletedAt: null, section: { deletedAt: null, liste: { id: { in: listeIds }, deletedAt: null } } },
    select: { id: true, libelle: true, statut: true, section: { select: { liste: { select: { id: true, titre: true } } } } },
  })
  return points.map((point) => ({
    id: point.id,
    libelle: point.libelle,
    statut: point.statut as StatutPoint,
    listeId: point.section.liste.id,
    listeTitre: point.section.liste.titre,
  }))
}

async function pointsDeListe(ctx: ContexteTeam, listeId: string): Promise<Array<{ lienType: string; lienId: string | null }>> {
  return prismaPourTeam(ctx.teamId, ctx.userId).checklistItem.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, section: { deletedAt: null, liste: { id: listeId, deletedAt: null } } },
    select: { lienType: true, lienId: true },
  })
}

// ─── Propositions : une ligne checklist_proposal et son action ───────────────

// Les propositions déjà créées pour ce même objet (toutes, quel que soit leur statut) : base du contrôle de doublon.
async function doublon(ctx: ContexteTeam, type: TypeProposition, cle: string, listeId: string | null): Promise<boolean> {
  const existantes = await prismaPourTeam(ctx.teamId, ctx.userId).checklistProposal.findMany({
    where: { teamId: ctx.teamId, type, deletedAt: null, contenu: { path: ["cle"], equals: cle } },
    select: { type: true, contenu: true },
  })
  return estDoublon(
    existantes.map((existante) => ({ type: existante.type as TypeProposition, cle, listeId: (existante.contenu as { listeId?: string | null }).listeId ?? null })),
    { type, cle, listeId },
  )
}

// Contenu écrit en JSON : des valeurs simples, et des listes d'identifiants.
type ContenuProposition = { [cle: string]: string | number | boolean | string[] | null }

async function creerProposition(ctx: ContexteTeam, evenement: EvenementRecu, type: TypeProposition, contenu: ContenuProposition): Promise<string> {
  const id = newId()
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.checklistProposal.create({
      data: {
        id,
        teamId: ctx.teamId,
        evenementSourceId: evenement.id,
        type,
        contenu,
        statut: "proposee",
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    }),
  )
  return id
}

// Le reste de la charge d'action (le type est écrit à chaque émission, pour que la garde de libellés le lise).
function corpsAction(propositionId: string, titre: string, contexte: string, epreuveId: string, cleRegroupement: string) {
  return {
    cleUnicite: `proposition:${propositionId}`,
    titre,
    contexte,
    ficheType: "proposition",
    ficheId: propositionId,
    eventId: epreuveId,
    destinataires: { roles: ["responsable" as const] },
    boutons: [
      { cle: "accepter", libelle: "Accepter" },
      { cle: "ignorer", libelle: "Ignorer" },
    ],
    priorite: 5,
    niveauRequis: "gestion" as const,
    cleRegroupement,
  }
}

async function relierAction(ctx: ContexteTeam, propositionId: string): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const action = await client.coreAction.findFirst({ where: { teamId: ctx.teamId, cleUnicite: `proposition:${propositionId}` }, select: { id: true } })
  if (action) await client.checklistProposal.update({ where: { id: propositionId }, data: { actionId: action.id } })
}

interface AjoutPoint {
  epreuveId: string
  listeId: string
  listeTitre: string
  cle: string
  lienType: TypeObjetPropose
  lienId: string
  libelle: string
  critique: boolean
  titre: string
}

// Un point à ajouter à une liste, lié à un objet. Pas de proposition si la liste a déjà un point lié à cet objet.
async function proposerAjoutPoint(ctx: ContexteTeam, evenement: EvenementRecu, ajout: AjoutPoint): Promise<void> {
  if (pointDejaLie(await pointsDeListe(ctx, ajout.listeId), ajout.lienType, ajout.lienId)) return
  if (await doublon(ctx, "ajouter_point", ajout.cle, ajout.listeId)) return
  const propositionId = await creerProposition(ctx, evenement, "ajouter_point", {
    cle: ajout.cle,
    listeId: ajout.listeId,
    lienType: ajout.lienType,
    lienId: ajout.lienId,
    libelle: ajout.titre,
    critique: ajout.critique,
  })
  await emettre(
    ctx,
    "checklist.action_requise",
    chargeActionRequise.parse({ type: "ajouter_point", ...corpsAction(propositionId, ajout.titre, `${ajout.listeTitre} · ${ajout.libelle}`, ajout.epreuveId, "propositions_ajouter_point") }),
  )
  await relierAction(ctx, propositionId)
}

// Un point lié à un objet déjà coché côté Garage ou Voiture : proposé à cocher, un par point à faire ou en problème.
async function proposerCochage(ctx: ContexteTeam, evenement: EvenementRecu, epreuveId: string, point: { id: string; libelle: string; listeId: string; listeTitre: string }): Promise<void> {
  if (await doublon(ctx, "cocher_point", `point:${point.id}`, point.listeId)) return
  const propositionId = await creerProposition(ctx, evenement, "cocher_point", { cle: `point:${point.id}`, listeId: point.listeId, pointId: point.id })
  await emettre(
    ctx,
    "checklist.action_requise",
    chargeActionRequise.parse({ type: "cocher_point", ...corpsAction(propositionId, `Cocher : ${point.libelle}`, point.listeTitre, epreuveId, "propositions_cocher_point") }),
  )
  await relierAction(ctx, propositionId)
}

interface ListesRetour {
  epreuveId: string
  cle: string
  titre: string
  contexte: string
  entryIds: string[]
  communeCible: boolean
  modelesEngagement: string[]
  modelesEpreuve: string[]
}

async function proposerListesRetour(ctx: ContexteTeam, evenement: EvenementRecu, retour: ListesRetour): Promise<void> {
  if (await doublon(ctx, "creer_liste_retour", retour.cle, null)) return
  const propositionId = await creerProposition(ctx, evenement, "creer_liste_retour", {
    cle: retour.cle,
    listeId: null,
    entryIds: retour.entryIds,
    communeCible: retour.communeCible,
    modelesEngagement: retour.modelesEngagement,
    modelesEpreuve: retour.modelesEpreuve,
  })
  await emettre(
    ctx,
    "checklist.action_requise",
    chargeActionRequise.parse({ type: "creer_liste_retour", ...corpsAction(propositionId, retour.titre, retour.contexte, retour.epreuveId, "propositions_creer_liste_retour") }),
  )
  await relierAction(ctx, propositionId)
}

// Relire un règlement : une seule proposition par règlement (pas une par liste, décision de l'orchestrateur, 02/11).
async function proposerRelireReglement(ctx: ContexteTeam, evenement: EvenementRecu, reglement: { epreuveId: string; documentId: string; titre: string; listeCibleId: string; listeTitre: string }): Promise<void> {
  const cle = `reglement:${reglement.documentId}`
  if (await doublon(ctx, "relire_liste", cle, null)) return
  const propositionId = await creerProposition(ctx, evenement, "relire_liste", {
    cle,
    listeId: null,
    listeCibleId: reglement.listeCibleId,
    documentId: reglement.documentId,
    titre: reglement.titre,
  })
  await emettre(
    ctx,
    "checklist.action_requise",
    chargeActionRequise.parse({ type: "relire_liste", ...corpsAction(propositionId, titreRelireReglement(reglement.titre), reglement.listeTitre, reglement.epreuveId, "propositions_relire_liste") }),
  )
  await relierAction(ctx, propositionId)
}

// ─── Écoutes ─────────────────────────────────────────────────────────────────

// saison.epreuve_terminee : une liste retour par engagement qui n'en a pas, et une commune à l'épreuve si elle manque.
// Une proposition par épreuve. Rien si aucun modèle de phase retour n'existe.
enregistrerGestionnaire("checklist", "saison.epreuve_terminee", async (ctx: ContexteTeam, evenement: EvenementRecu) => {
  const analyse = chargeEpreuveTerminee.safeParse(evenement.donnees)
  if (!analyse.success) return
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const epreuve = await client.coreEvent.findFirst({ where: { id: analyse.data.eventId, teamId: ctx.teamId, deletedAt: null }, select: { id: true, nom: true, type: true } })
  if (!epreuve) return
  const engagements = await client.coreEventEntry.findMany({
    where: { teamId: ctx.teamId, eventId: epreuve.id, deletedAt: null, statut: { notIn: ["abandon", "forfait"] } },
    select: { id: true },
  })
  const sansRetour = engagementsSansListeRetour(engagements.map((entree) => entree.id), await engagementsAvecRetour(ctx, engagements.map((entree) => entree.id)))
  const discipline = disciplineDeType(epreuve.type)
  const modelesEngagement = sansRetour.length > 0 ? await modelesRetour(ctx, "engagement", discipline) : []
  const communeManquante = (await listeCommune(ctx, epreuve.id, RETOUR)) === null
  const modelesEpreuve = communeManquante ? await modelesRetour(ctx, "epreuve", discipline) : []
  const communeCible = communeManquante && modelesEpreuve.length > 0
  const entryIds = modelesEngagement.length > 0 ? sansRetour : []
  if (entryIds.length === 0 && !communeCible) return
  await proposerListesRetour(ctx, evenement, {
    epreuveId: epreuve.id,
    cle: `epreuve:${epreuve.id}`,
    titre: `Créer les listes retour de ${epreuve.nom}`,
    contexte: `${entryIds.length} engagement${entryIds.length > 1 ? "s" : ""} sans liste retour`,
    entryIds,
    communeCible,
    modelesEngagement,
    modelesEpreuve: communeCible ? modelesEpreuve : [],
  })
})

// saison.abandon_declare : la variante après abandon, avec les modèles de phase retour (pas de modèle spécial, décision
// de l'orchestrateur du 02/11). Rien si l'engagement a déjà sa liste retour, ou si aucun modèle n'existe.
enregistrerGestionnaire("checklist", "saison.abandon_declare", async (ctx: ContexteTeam, evenement: EvenementRecu) => {
  const analyse = chargeAbandonDeclare.safeParse(evenement.donnees)
  if (!analyse.success || !analyse.data.eventId) return
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const epreuve = await client.coreEvent.findFirst({ where: { id: analyse.data.eventId, teamId: ctx.teamId, deletedAt: null }, select: { id: true, nom: true, type: true } })
  if (!epreuve) return
  const entryId = analyse.data.entryId
  if ((await engagementsAvecRetour(ctx, [entryId])).has(entryId)) return
  const modelesEngagement = await modelesRetour(ctx, "engagement", disciplineDeType(epreuve.type))
  if (modelesEngagement.length === 0) return
  await proposerListesRetour(ctx, evenement, {
    epreuveId: epreuve.id,
    cle: `engagement:${entryId}`,
    titre: `Liste retour après abandon : ${epreuve.nom}`,
    contexte: "Abandon déclaré",
    entryIds: [entryId],
    communeCible: false,
    modelesEngagement,
    modelesEpreuve: [],
  })
})

// garage.piece_zone_rouge : un point critique « Remplacer la pièce » dans la liste avant départ de l'engagement du véhicule.
enregistrerGestionnaire("checklist", "garage.piece_zone_rouge", async (ctx: ContexteTeam, evenement: EvenementRecu) => {
  const analyse = chargePieceZoneRouge.safeParse(evenement.donnees)
  if (!analyse.success) return
  const engagement = await prochainEngagementDuVehicule(ctx, analyse.data.vehicleId)
  if (!engagement) return
  const liste = await listeDeEngagement(ctx, engagement.entryId, "avant_depart")
  if (!liste) return
  const organe = await garage.lireObjetPourChecklist(ctx, "organe_garage", analyse.data.vehicleComponentId)
  if (!organe) return
  await proposerAjoutPoint(ctx, evenement, {
    epreuveId: engagement.eventId,
    listeId: liste.id,
    listeTitre: liste.titre,
    cle: `organe:${organe.id}`,
    lienType: "organe_garage",
    lienId: organe.id,
    libelle: organe.libelle,
    critique: true,
    titre: titrePointPropose("organe_garage", organe.libelle),
  })
})

// garage.travail_termine : cocher le point lié à l'organe de l'ordre, dans les listes du véhicule pour sa prochaine épreuve.
enregistrerGestionnaire("checklist", "garage.travail_termine", async (ctx: ContexteTeam, evenement: EvenementRecu) => {
  const analyse = chargeTravailTermine.safeParse(evenement.donnees)
  if (!analyse.success) return
  const organeId = await garage.organeDeOrdrePourChecklist(ctx, analyse.data.workOrderId)
  if (!organeId) return
  await proposerCochagePourObjet(ctx, evenement, analyse.data.vehicleId, "organe_garage", organeId)
})

// voiture.logo_pose : cocher le point lié à ce logo (lienId = emplacement, comme le choix d'objet de 5.7a).
enregistrerGestionnaire("checklist", "voiture.logo_pose", async (ctx: ContexteTeam, evenement: EvenementRecu) => {
  const analyse = chargeLogoPose.safeParse(evenement.donnees)
  if (!analyse.success) return
  await proposerCochagePourObjet(ctx, evenement, analyse.data.vehicleId, "logo_voiture", analyse.data.slotId)
})

async function proposerCochagePourObjet(ctx: ContexteTeam, evenement: EvenementRecu, vehicleId: string, lienType: TypeObjetLie, lienId: string): Promise<void> {
  const engagement = await prochainEngagementDuVehicule(ctx, vehicleId)
  if (!engagement) return
  const listes = await prismaPourTeam(ctx.teamId, ctx.userId).checklistList.findMany({
    where: { teamId: ctx.teamId, engagementId: engagement.entryId, deletedAt: null },
    select: { id: true },
  })
  for (const point of await pointsLies(ctx, lienType, lienId, listes.map((liste) => liste.id))) {
    if (!pointCochable(point.statut)) continue
    await proposerCochage(ctx, evenement, engagement.eventId, point)
  }
}

// voiture.papier_expire_bientot : un point critique dans la liste des vérifications de l'engagement du véhicule.
enregistrerGestionnaire("checklist", "voiture.papier_expire_bientot", async (ctx: ContexteTeam, evenement: EvenementRecu) => {
  const analyse = chargePapierExpireBientot.safeParse(evenement.donnees)
  if (!analyse.success) return
  const engagement = await prochainEngagementDuVehicule(ctx, analyse.data.vehicleId)
  if (!engagement) return
  const liste = await listeDeEngagement(ctx, engagement.entryId, "verifications")
  if (!liste) return
  const papier = await voiture.lireObjetPourChecklist(ctx, "papier_voiture", analyse.data.paperId)
  if (!papier) return
  await proposerAjoutPoint(ctx, evenement, {
    epreuveId: engagement.eventId,
    listeId: liste.id,
    listeTitre: liste.titre,
    cle: `papier:${papier.id}`,
    lienType: "papier_voiture",
    lienId: papier.id,
    libelle: papier.libelle,
    critique: true,
    titre: titrePointPropose("papier_voiture", papier.libelle),
  })
})

// equipe.licence_expire_bientot et equipe.homologation_expire_bientot : la liste des vérifications de l'engagement où la
// personne est pilote ou copilote. Sans un tel engagement, pas de proposition (pas de repli sur la liste commune).
enregistrerGestionnaire("checklist", "equipe.licence_expire_bientot", async (ctx: ContexteTeam, evenement: EvenementRecu) => {
  const analyse = chargeLicenceExpireBientot.safeParse(evenement.donnees)
  if (!analyse.success) return
  const engagement = await prochainEngagementDePersonne(ctx, analyse.data.personId)
  if (!engagement) return
  const liste = await listeDeEngagement(ctx, engagement.entryId, "verifications")
  if (!liste) return
  const licence = await equipe.lireObjetPourChecklist(ctx, "licence_equipe", analyse.data.licenceId)
  if (!licence) return
  await proposerAjoutPoint(ctx, evenement, {
    epreuveId: engagement.eventId,
    listeId: liste.id,
    listeTitre: liste.titre,
    cle: `licence:${licence.id}`,
    lienType: "licence_equipe",
    lienId: licence.id,
    libelle: licence.libelle,
    critique: true,
    titre: titrePointPropose("licence_equipe", licence.libelle),
  })
})

enregistrerGestionnaire("checklist", "equipe.homologation_expire_bientot", async (ctx: ContexteTeam, evenement: EvenementRecu) => {
  const analyse = chargeHomologationExpireBientot.safeParse(evenement.donnees)
  if (!analyse.success) return
  const engagement = await prochainEngagementDePersonne(ctx, analyse.data.personId)
  if (!engagement) return
  const liste = await listeDeEngagement(ctx, engagement.entryId, "verifications")
  if (!liste) return
  const homologation = await equipe.lireObjetPourChecklist(ctx, "homologation_equipe", analyse.data.equipementId)
  if (!homologation) return
  await proposerAjoutPoint(ctx, evenement, {
    epreuveId: engagement.eventId,
    listeId: liste.id,
    listeTitre: liste.titre,
    cle: `homologation:${homologation.id}`,
    lienType: "homologation_equipe",
    lienId: homologation.id,
    libelle: homologation.libelle,
    critique: true,
    titre: titrePointPropose("homologation_equipe", homologation.libelle),
  })
})

// documents.document_expire_bientot : un point critique dans la liste commune des vérifications de la prochaine épreuve.
enregistrerGestionnaire("checklist", "documents.document_expire_bientot", async (ctx: ContexteTeam, evenement: EvenementRecu) => {
  const analyse = chargeDocument.safeParse(evenement.donnees)
  if (!analyse.success) return
  const epreuve = await prochaineEpreuve(ctx)
  if (!epreuve) return
  const liste = await listeCommune(ctx, epreuve.id, "verifications")
  if (!liste) return
  const document = await documents.lireObjetPourChecklist(ctx, analyse.data.documentId)
  if (!document) return
  await proposerAjoutPoint(ctx, evenement, {
    epreuveId: epreuve.id,
    listeId: liste.id,
    listeTitre: liste.titre,
    cle: `document:${document.id}`,
    lienType: "document_documents",
    lienId: document.id,
    libelle: document.libelle,
    critique: true,
    titre: titrePointPropose("document_documents", document.libelle),
  })
})

// documents.reglement_publie : une proposition, à l'acceptation un point « Relire le règlement » dans la liste commune
// avant départ de la prochaine épreuve. Pas de liste, pas de proposition.
enregistrerGestionnaire("checklist", "documents.reglement_publie", async (ctx: ContexteTeam, evenement: EvenementRecu) => {
  const analyse = chargeDocument.safeParse(evenement.donnees)
  if (!analyse.success) return
  const epreuve = await prochaineEpreuve(ctx)
  if (!epreuve) return
  const liste = await listeCommune(ctx, epreuve.id, "avant_depart")
  if (!liste) return
  const reglement = await documents.lireObjetPourChecklist(ctx, analyse.data.documentId)
  if (!reglement) return
  await proposerRelireReglement(ctx, evenement, {
    epreuveId: epreuve.id,
    documentId: reglement.id,
    titre: reglement.libelle,
    listeCibleId: liste.id,
    listeTitre: liste.titre,
  })
})

// partenaires.contrepartie_en_retard : un point critique dans la liste commune avant départ de la prochaine épreuve.
enregistrerGestionnaire("checklist", "partenaires.contrepartie_en_retard", async (ctx: ContexteTeam, evenement: EvenementRecu) => {
  const analyse = chargeContrepartieEnRetard.safeParse(evenement.donnees)
  if (!analyse.success) return
  const epreuve = await prochaineEpreuve(ctx)
  if (!epreuve) return
  const liste = await listeCommune(ctx, epreuve.id, "avant_depart")
  if (!liste) return
  const contrepartie = await partenaires.lireObjetPourChecklist(ctx, analyse.data.benefitId)
  if (!contrepartie) return
  await proposerAjoutPoint(ctx, evenement, {
    epreuveId: epreuve.id,
    listeId: liste.id,
    listeTitre: liste.titre,
    cle: `contrepartie:${contrepartie.id}`,
    lienType: "contrepartie_partenaires",
    lienId: contrepartie.id,
    libelle: contrepartie.libelle,
    critique: true,
    titre: titrePointPropose("contrepartie_partenaires", contrepartie.libelle),
  })
})

// ─── Décision (core.action_decidee) ──────────────────────────────────────────

// Une proposition de 5.7b, décidée par la boîte. Accepter écrit dans Check-lists ; Ignorer ne fait rien. La proposition
// passe à acceptée ou ignorée dans les deux cas. Une proposition déjà décidée n'est pas rejouée.
export async function appliquerDecisionProposition(ctx: ContexteTeam, evenement: EvenementRecu): Promise<void> {
  const analyse = chargeDecisionAction.safeParse(evenement.donnees)
  if (!analyse.success || !analyse.data.ficheId || !TYPES_DE_PROPOSITION.includes(analyse.data.type)) return
  const decision = analyse.data.decision
  if (decision !== "accepter" && decision !== "ignorer") return

  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const proposition = await client.checklistProposal.findFirst({ where: { id: analyse.data.ficheId, teamId: ctx.teamId, statut: "proposee", deletedAt: null } })
  if (!proposition) return
  const contenu = proposition.contenu as Record<string, unknown>

  if (decision === "accepter") await appliquerProposition(ctx, proposition.type as TypeProposition, contenu)

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

async function appliquerProposition(ctx: ContexteTeam, type: TypeProposition, contenu: Record<string, unknown>): Promise<void> {
  if (type === "cocher_point") {
    await cocherSiCochable(ctx, contenu.pointId as string)
  } else if (type === "ajouter_point") {
    await ajouterPointLie(ctx, contenu.listeId as string, {
      libelle: contenu.libelle as string,
      critique: contenu.critique as boolean,
      lienType: contenu.lienType as TypeObjetLie,
      lienId: contenu.lienId as string,
    })
  } else if (type === "relire_liste") {
    await ajouterPointLie(ctx, contenu.listeCibleId as string, {
      libelle: contenu.titre ? titreRelireReglement(contenu.titre as string) : "",
      critique: false,
      lienType: "document_documents",
      lienId: contenu.documentId as string,
    })
  } else {
    await creerListesRetour(ctx, contenu)
  }
}

// Ne repasse jamais un point déjà fait ou sans objet (décision de l'orchestrateur, 01/11).
async function cocherSiCochable(ctx: ContexteTeam, pointId: string): Promise<void> {
  const point = await prismaPourTeam(ctx.teamId, ctx.userId).checklistItem.findFirst({ where: { id: pointId, teamId: ctx.teamId, deletedAt: null }, select: { statut: true } })
  if (!point || !pointCochable(point.statut as StatutPoint)) return
  await changerStatutPointDans(ctx, "gestion", pointId, "fait")
}

// Crée les listes retour encore absentes : une par engagement sans liste retour, puis la commune si elle manque.
async function creerListesRetour(ctx: ContexteTeam, contenu: Record<string, unknown>): Promise<void> {
  const eventId = contenu.eventId as string
  const entryIds = (contenu.entryIds as string[]) ?? []
  const modelesEngagement = (contenu.modelesEngagement as string[]) ?? []
  const modelesEpreuve = (contenu.modelesEpreuve as string[]) ?? []
  const sansRetour = engagementsSansListeRetour(entryIds, await engagementsAvecRetour(ctx, entryIds))
  for (const entryId of sansRetour) {
    for (const modeleId of modelesEngagement) {
      await creerListeDepuisModeleDans(ctx, modeleId, eventId, entryId)
    }
  }
  if (contenu.communeCible === true && (await listeCommune(ctx, eventId, RETOUR)) === null) {
    for (const modeleId of modelesEpreuve) {
      await creerListeDepuisModeleDans(ctx, modeleId, eventId, null)
    }
  }
}

// Ajoute un point à la liste, dans sa première section (une section « Points ajoutés » si la liste n'en a pas). Rien si
// la liste n'existe plus ou si elle a déjà un point lié à cet objet. Écrit dans Check-lists seulement.
async function ajouterPointLie(ctx: ContexteTeam, listeId: string, point: { libelle: string; critique: boolean; lienType: TypeObjetLie; lienId: string }): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const liste = await client.checklistList.findFirst({ where: { id: listeId, teamId: ctx.teamId, deletedAt: null }, select: { id: true, epreuveId: true, titre: true, echeance: true } })
  if (!liste) return
  if (pointDejaLie(await pointsDeListe(ctx, listeId), point.lienType, point.lienId)) return
  const epreuve = await client.coreEvent.findFirst({ where: { id: liste.epreuveId, teamId: ctx.teamId }, select: { dateDebut: true } })
  const ajoutePendantEpreuve = epreuve ? epreuveCommencee(epreuve.dateDebut.toISOString().slice(0, 10), jourParis(new Date())) : false
  const section = await client.checklistSection.findFirst({
    where: { listeId, teamId: ctx.teamId, deletedAt: null },
    orderBy: [{ ordre: "asc" }, { id: "asc" }],
    select: { id: true },
  })
  const sectionId = section?.id ?? (await creerSectionAjout(ctx, listeId))
  const pointId = newId()
  const resultat = await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
      await tx.checklistItem.create({
        data: {
          id: pointId,
          teamId: ctx.teamId,
          sectionId,
          libelle: point.libelle,
          critique: point.critique,
          lienType: point.lienType,
          lienId: point.lienId,
          ajoutePendantEpreuve,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      })
      return recalculerListe(tx, ctx, listeId)
    }),
  )
  await emettreApresChangement(ctx, { id: liste.id, epreuveId: liste.epreuveId, echeance: liste.echeance, titre: liste.titre }, resultat, {
    ancien: null,
    nouveau: "a_faire",
    critique: point.critique,
    ajoute: true,
    pointId,
    libelle: point.libelle,
    lienType: point.lienType,
    lienId: point.lienId,
  })
}

async function creerSectionAjout(ctx: ContexteTeam, listeId: string): Promise<string> {
  const id = newId()
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.checklistSection.create({
      data: { id, teamId: ctx.teamId, listeId, titre: "Points ajoutés", ordre: 0, createdBy: ctx.userId, updatedBy: ctx.userId },
    }),
  )
  return id
}
