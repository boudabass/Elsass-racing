// Services serveur de Check-lists (tâche 5.5a, brief §4). Chaque fonction publique contrôle elle-même la session et le
// niveau d'accès (accesChecklist). Les droits de l'assistance (956 §6) passent par assistancePeut, pas par le niveau.
// Une lecture n'écrit jamais. Les écritures concurrentes passent par avecReprisePourConflit. Les événements sont émis
// après la transaction, jamais dedans. Avancement, zone et statut d'une liste sont recalculés à chaque changement de
// points, dans la même transaction, et jamais saisis (règles pures dans regles.ts).

import type { ContexteTeam } from "@/core/contexte"
import { exigerAcces } from "@/core/droits/garde-serveur"
import { aAuMoins, type Niveau } from "@/core/droits/niveaux"
import { emettre } from "@/core/evenements/bus-serveur"
import { newId } from "@/core/ids"
import { executerPourTeam, prismaPourTeam } from "@/lib/prisma"
import { avecReprisePourConflit } from "@/lib/reprise-conflit"

import {
  chargeAvancementChange,
  chargeListeTerminee,
  chargePointCritiqueOuvert,
  chargeProblemeSignale,
} from "./charges"
import { ErreurChecklist, refus } from "./erreurs"
import { cleOrdreDePoint, cleTacheDeProbleme } from "./objets-lies"
import { cleActionPointCritique, leverActionSiEnAttente, proposerActionPointCritique, proposerActionTacheProbleme } from "./points-critiques-serveur"
import { pointTraiteParGarage } from "@/core/taches/regles"
import {
  assistancePeut,
  calculerListe,
  echeanceDeListe,
  epreuveCommencee,
  fautSignalerPointCritique,
  actionPointCritiqueDue,
  actionPointCritiqueLevee,
  fautSignalerProbleme,
  jourParis,
  liensDuPointCopie,
  listeTermineeAEmettre,
  listeVisiblePour,
  modelesVisiblesPour,
  reassignationLevee,
  type ActionSurPoint,
  type EcheanceRelative,
  type StatutPoint,
} from "./regles"

export { ErreurChecklist }

export type Portee = "engagement" | "epreuve"
export type Phase = "avant_depart" | "verifications" | "reconnaissances" | "epreuve" | "retour"
export type Discipline = "rallye" | "course_de_cote" | "slalom" | "circuit"
export type RoleSuggere = "equipage" | "assistance"
export type TypeLien =
  | "aucun"
  | "organe_garage"
  | "train_pneus"
  | "papier_voiture"
  | "logo_voiture"
  | "licence_equipe"
  | "homologation_equipe"
  | "contrepartie_partenaires"
  | "document_documents"

// ─── Accès ───────────────────────────────────────────────────────────────────

export async function accesChecklist(requis: Niveau): Promise<{ ctx: ContexteTeam; niveau: Niveau }> {
  const { session, team, membership, niveau } = await exigerAcces("checklist", requis)
  const ctx = { teamId: team.id, userId: session.userId, membership: { id: membership.id, role: membership.role } }
  return { ctx, niveau }
}

type Client = ReturnType<typeof prismaPourTeam>
type Tx = Parameters<Parameters<typeof executerPourTeam>[2]>[0]

// Texte saisi : non vide, borné. Une saisie vide est un refus, jamais une ligne vide en base.
function texte(valeur: string, nom: string, max = 200): string {
  const propre = valeur.trim()
  if (propre.length === 0) refus(`${nom} ne peut pas être vide.`)
  if (propre.length > max) refus(`${nom} dépasse ${max} caractères.`)
  return propre
}

// « AAAA-MM-JJ » d'une date de calendrier (minuit UTC, comme les dates de @db.Date).
function jourCivil(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function dateDeJour(jour: string | null): Date | null {
  return jour === null ? null : new Date(jour)
}

// Lit une épreuve de la team, ou refuse.
async function epreuveDe(client: Client, teamId: string, epreuveId: string) {
  const epreuve = await client.coreEvent.findFirst({ where: { id: epreuveId, teamId, deletedAt: null }, select: { id: true, dateDebut: true } })
  if (!epreuve) refus("Cette épreuve n'existe pas dans la team.")
  return epreuve
}

// Lit un engagement de la team, et vérifie qu'il appartient bien à l'épreuve donnée.
async function engagementDe(client: Client, teamId: string, engagementId: string, epreuveId: string) {
  const engagement = await client.coreEventEntry.findFirst({
    where: { id: engagementId, teamId, deletedAt: null },
    select: { id: true, eventId: true, vehicleId: true },
  })
  if (!engagement || engagement.eventId !== epreuveId) refus("Cet engagement ne fait pas partie de cette épreuve.")
  return engagement
}

// Un point avec sa section et sa liste (pour les droits et les événements).
export async function pointAvecListe(client: Client, teamId: string, pointId: string) {
  const point = await client.checklistItem.findFirst({
    where: { id: pointId, teamId, deletedAt: null },
    include: { section: { include: { liste: true } } },
  })
  if (!point || point.section.deletedAt !== null) refus("Ce point n'existe plus.")
  return point
}

// Liste visible pour ce rôle : l'assistance ne voit que les listes ouvertes à elle.
export function exigerListeVisible(role: string, liste: { ouverteAssistance: boolean }): void {
  if (!listeVisiblePour(role as Parameters<typeof listeVisiblePour>[0], liste)) {
    refus("Cette liste n'est pas ouverte à l'assistance.")
  }
}

// Droit sur un point : l'assistance passe par assistancePeut, les autres rôles ont besoin du niveau écriture.
export function exigerDroitPoint(ctx: ContexteTeam, niveau: Niveau, action: ActionSurPoint, liste: { ouverteAssistance: boolean }, point: { createdBy: string | null } | null): void {
  if (ctx.membership.role === "assistance") {
    const decision = assistancePeut(action, liste, point ? { creePar: point.createdBy } : null, ctx.userId)
    if (!decision.autorise) refus(decision.raison)
    return
  }
  if (!aAuMoins(niveau, "ecriture")) refus("Cette action demande le niveau écriture sur Check-lists.")
}

// ─── Recalcul ────────────────────────────────────────────────────────────────

// Relit les points de la liste, recalcule avancement, zone et statut, et écrit le résultat. Renvoie l'avant et l'après.
export async function recalculerListe(tx: Tx, ctx: ContexteTeam, listeId: string) {
  const liste = await tx.checklistList.findFirst({ where: { id: listeId, teamId: ctx.teamId, deletedAt: null } })
  if (!liste) refus("Cette liste n'existe plus.")
  const points = await tx.checklistItem.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, section: { listeId, deletedAt: null } },
    select: { statut: true, critique: true },
  })
  const apres = calculerListe(points)
  const avant = { avancement: liste.avancement, zone: liste.zone, statut: liste.statut }
  await tx.checklistList.update({
    where: { id: listeId },
    data: { avancement: apres.avancement, zone: apres.zone, statut: apres.statut, rev: { increment: 1 }, updatedBy: ctx.userId },
  })
  return { liste, avant, apres }
}

// Jours (Paris) où une liste_terminee a déjà été émise pour cette liste (Q3).
async function joursListeTerminee(ctx: ContexteTeam, listeId: string): Promise<string[]> {
  const emis = await prismaPourTeam(ctx.teamId, ctx.userId).coreDomainEvent.findMany({
    where: { teamId: ctx.teamId, nom: "checklist.liste_terminee", donnees: { path: ["listeId"], equals: listeId } },
    select: { emisAt: true },
  })
  return emis.map((evenement) => jourParis(evenement.emisAt))
}

export interface ChangementPoint {
  ancien: StatutPoint | null
  nouveau: StatutPoint
  critique: boolean
  ajoute: boolean
  pointId: string
  // Contexte du point, émis avec checklist.probleme_signale et l'action point critique (5.7a). Le libellé donne le titre.
  libelle: string
  lienType?: string | null
  lienId?: string | null
  personneId?: string | null
}

// Émet ce qui découle d'un changement, après la transaction. Jamais de rouge : ce sont des informations.
export async function emettreApresChangement(
  ctx: ContexteTeam,
  liste: { id: string; epreuveId: string; echeance: Date | null; titre: string },
  resultat: { avant: { avancement: number; zone: string; statut: string }; apres: { avancement: number; zone: "vert" | "orange"; statut: "a_faire" | "en_cours" | "terminee" } },
  changement: ChangementPoint | null,
): Promise<void> {
  const aujourdhui = jourParis(new Date())
  const echeance = liste.echeance ? jourCivil(liste.echeance) : null

  if (resultat.avant.avancement !== resultat.apres.avancement || resultat.avant.zone !== resultat.apres.zone) {
    await emettre(
      ctx,
      "checklist.avancement_change",
      chargeAvancementChange.parse({
        listeId: liste.id,
        epreuveId: liste.epreuveId,
        avancement: resultat.apres.avancement,
        zone: resultat.apres.zone,
        statut: resultat.apres.statut,
      }),
    )
  }

  if (changement && fautSignalerProbleme(changement.ancien, changement.nouveau)) {
    await emettre(
      ctx,
      "checklist.probleme_signale",
      chargeProblemeSignale.parse({
        listeId: liste.id,
        epreuveId: liste.epreuveId,
        pointId: changement.pointId,
        libelle: changement.libelle ?? null,
        listeTitre: liste.titre,
        lienType: changement.lienType ?? null,
        lienId: changement.lienId ?? null,
        personneId: changement.personneId ?? null,
      }),
    )
  }

  if (changement && actionPointCritiqueDue({ critique: changement.critique, statut: changement.nouveau }, echeance, aujourdhui)) {
    await proposerActionPointCritique(ctx, liste, { id: changement.pointId, libelle: changement.libelle })
  }
  if (changement && actionPointCritiqueLevee(changement.nouveau)) {
    await leverActionSiEnAttente(ctx, cleActionPointCritique(changement.pointId))
  }

  // Problème sans organe : l'action de tâche (5.8, §3.3) ; le point qui sort de problème la lève, et la tâche se termine avec elle.
  if (changement && fautSignalerProbleme(changement.ancien, changement.nouveau) && !pointTraiteParGarage(changement.lienType ?? null, changement.lienId ?? null)) {
    await proposerActionTacheProbleme(ctx, liste, { id: changement.pointId, libelle: changement.libelle, personneId: changement.personneId ?? null })
  }

  if (changement && changement.ancien === "probleme" && changement.nouveau !== "probleme") {
    await leverActionSiEnAttente(ctx, cleOrdreDePoint(changement.pointId))
    await leverActionSiEnAttente(ctx, cleTacheDeProbleme(changement.pointId))
  }

  if (changement && fautSignalerPointCritique({ ancien: changement.ancien, nouveau: changement.nouveau, critique: changement.critique, ajoute: changement.ajoute }, echeance, aujourdhui)) {
    await emettre(ctx, "checklist.point_critique_ouvert", chargePointCritiqueOuvert.parse({ listeId: liste.id, epreuveId: liste.epreuveId, pointId: changement.pointId }))
  }

  if (resultat.apres.statut === "terminee" && resultat.avant.statut !== "terminee") {
    if (listeTermineeAEmettre(await joursListeTerminee(ctx, liste.id), aujourdhui)) {
      await emettre(ctx, "checklist.liste_terminee", chargeListeTerminee.parse({ listeId: liste.id, epreuveId: liste.epreuveId }))
    }
  }
}

// Réassignation (settings.membre_retire, décision de l'orchestrateur du 01/11) : quand la personne n'a plus aucun point à
// faire ou en problème, l'action « Réassigner les points » créée pour elle est levée (action_levee, même cleUnicite).
// Sans action en attente, rien n'est émis.
export async function levereReassignationSiPlusDePoint(ctx: ContexteTeam, personneId: string): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const enAttente = await client.checklistItem.count({
    where: {
      teamId: ctx.teamId,
      personneId,
      deletedAt: null,
      statut: { in: ["a_faire", "probleme"] },
      section: { deletedAt: null, liste: { deletedAt: null } },
    },
  })
  if (!reassignationLevee(enAttente)) return
  const cleUnicite = `reassigner_points:${personneId}`
  const action = await client.coreAction.findFirst({ where: { teamId: ctx.teamId, cleUnicite, statut: "en_attente" }, select: { id: true } })
  if (!action) return
  await emettre(ctx, "checklist.action_levee", { cleUnicite })
}

// ─── Modèles de la team (gestion) ────────────────────────────────────────────

export interface SaisieModele {
  nom: string
  icone?: string | null
  portee: Portee
  phase?: Phase | null
  discipline?: Discipline | null
  ordre?: number
}

export async function creerModele(saisie: SaisieModele): Promise<string> {
  const { ctx } = await accesChecklist("gestion")
  const id = newId()
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.checklistTemplate.create({
      data: {
        id,
        teamId: ctx.teamId,
        nom: texte(saisie.nom, "Le nom du modèle"),
        icone: saisie.icone ?? null,
        portee: saisie.portee,
        phase: saisie.phase ?? null,
        discipline: saisie.discipline ?? null,
        fourni: false,
        version: 1,
        ordre: saisie.ordre ?? 0,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    }),
  )
  return id
}

// Copie un modèle visible (fourni ou de la team), avec ses sections et ses points. La copie garde modele_origine.
export async function copierModele(modeleSourceId: string): Promise<string> {
  const { ctx } = await accesChecklist("ecriture")
  if (!modelesVisiblesPour(ctx.membership.role as Parameters<typeof modelesVisiblesPour>[0])) {
    refus("Ton rôle ne donne pas accès aux modèles de Check-lists.")
  }
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const source = await client.checklistTemplate.findFirst({
    where: { id: modeleSourceId, deletedAt: null, OR: [{ fourni: true, teamId: null }, { teamId: ctx.teamId }] },
    include: { sections: { where: { deletedAt: null }, include: { items: { where: { deletedAt: null } } } } },
  })
  if (!source) refus("Ce modèle n'existe pas ou n'est plus disponible.")

  const copieId = newId()
  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    await tx.checklistTemplate.create({
      data: {
        id: copieId,
        teamId: ctx.teamId,
        nom: source.nom,
        icone: source.icone,
        portee: source.portee,
        phase: source.phase,
        discipline: source.discipline,
        fourni: false,
        modeleOrigineId: source.id,
        version: 1,
        ordre: source.ordre,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
    for (const section of source.sections) {
      const sectionId = newId()
      await tx.checklistTemplateSection.create({
        data: { id: sectionId, teamId: ctx.teamId, modeleId: copieId, titre: section.titre, ordre: section.ordre, createdBy: ctx.userId, updatedBy: ctx.userId },
      })
      for (const item of section.items) {
        await tx.checklistTemplateItem.create({
          data: {
            id: newId(),
            teamId: ctx.teamId,
            sectionId,
            libelle: item.libelle,
            aide: item.aide,
            critique: item.critique,
            roleSuggere: item.roleSuggere,
            lienType: item.lienType,
            echeanceRelative: item.echeanceRelative,
            ordre: item.ordre,
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          },
        })
      }
    }
  })
  return copieId
}

export interface ChangementsModele {
  nom?: string
  icone?: string | null
  portee?: Portee
  phase?: Phase | null
  discipline?: Discipline | null
  ordre?: number
}

// Seul un modèle de la team se modifie. Un modèle fourni se copie d'abord (règle du brief §1).
export async function modifierModele(modeleId: string, changements: ChangementsModele): Promise<void> {
  const { ctx } = await accesChecklist("gestion")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const modele = await client.checklistTemplate.findFirst({ where: { id: modeleId, teamId: ctx.teamId, fourni: false, deletedAt: null } })
  if (!modele) refus("Ce modèle est fourni par la plateforme : copie-le pour le modifier.")
  await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
      tx.checklistTemplate.update({
        where: { id: modeleId },
        data: {
          ...(changements.nom !== undefined ? { nom: texte(changements.nom, "Le nom du modèle") } : {}),
          ...(changements.icone !== undefined ? { icone: changements.icone } : {}),
          ...(changements.portee !== undefined ? { portee: changements.portee } : {}),
          ...(changements.phase !== undefined ? { phase: changements.phase } : {}),
          ...(changements.discipline !== undefined ? { discipline: changements.discipline } : {}),
          ...(changements.ordre !== undefined ? { ordre: changements.ordre } : {}),
          version: { increment: 1 },
          rev: { increment: 1 },
          updatedBy: ctx.userId,
        },
      }),
    ),
  )
}

export async function retirerModele(modeleId: string): Promise<void> {
  const { ctx } = await accesChecklist("gestion")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const modele = await client.checklistTemplate.findFirst({ where: { id: modeleId, teamId: ctx.teamId, fourni: false, deletedAt: null } })
  if (!modele) refus("Ce modèle est fourni par la plateforme, ou il n'existe plus.")
  await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
      tx.checklistTemplate.update({ where: { id: modeleId }, data: { deletedAt: new Date(), rev: { increment: 1 }, updatedBy: ctx.userId } }),
    ),
  )
}

export async function ajouterSectionModele(modeleId: string, titre: string, ordre = 0): Promise<string> {
  const { ctx } = await accesChecklist("gestion")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const modele = await client.checklistTemplate.findFirst({ where: { id: modeleId, teamId: ctx.teamId, fourni: false, deletedAt: null } })
  if (!modele) refus("Ce modèle est fourni par la plateforme : copie-le pour le modifier.")
  const id = newId()
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.checklistTemplateSection.create({
      data: { id, teamId: ctx.teamId, modeleId, titre: texte(titre, "Le titre de la section"), ordre, createdBy: ctx.userId, updatedBy: ctx.userId },
    }),
  )
  return id
}

export interface SaisiePointModele {
  libelle: string
  aide?: string | null
  critique?: boolean
  roleSuggere?: RoleSuggere | null
  lienType?: TypeLien
  echeanceRelative?: EcheanceRelative | null
  ordre?: number
}

export async function ajouterPointModele(sectionId: string, saisie: SaisiePointModele): Promise<string> {
  const { ctx } = await accesChecklist("gestion")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const section = await client.checklistTemplateSection.findFirst({ where: { id: sectionId, teamId: ctx.teamId, deletedAt: null } })
  if (!section) refus("Cette section n'appartient pas à un modèle de la team.")
  const id = newId()
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.checklistTemplateItem.create({
      data: {
        id,
        teamId: ctx.teamId,
        sectionId,
        libelle: texte(saisie.libelle, "Le libellé du point"),
        aide: saisie.aide ?? null,
        critique: saisie.critique ?? false,
        roleSuggere: saisie.roleSuggere ?? null,
        lienType: saisie.lienType ?? "aucun",
        echeanceRelative: saisie.echeanceRelative ?? null,
        ordre: saisie.ordre ?? 0,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    }),
  )
  return id
}

export async function modifierPointModele(pointId: string, changements: Partial<SaisiePointModele>): Promise<void> {
  const { ctx } = await accesChecklist("gestion")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const point = await client.checklistTemplateItem.findFirst({ where: { id: pointId, teamId: ctx.teamId, deletedAt: null } })
  if (!point) refus("Ce point n'appartient pas à un modèle de la team.")
  await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
      tx.checklistTemplateItem.update({
        where: { id: pointId },
        data: {
          ...(changements.libelle !== undefined ? { libelle: texte(changements.libelle, "Le libellé du point") } : {}),
          ...(changements.aide !== undefined ? { aide: changements.aide } : {}),
          ...(changements.critique !== undefined ? { critique: changements.critique } : {}),
          ...(changements.roleSuggere !== undefined ? { roleSuggere: changements.roleSuggere } : {}),
          ...(changements.lienType !== undefined ? { lienType: changements.lienType } : {}),
          ...(changements.echeanceRelative !== undefined ? { echeanceRelative: changements.echeanceRelative } : {}),
          ...(changements.ordre !== undefined ? { ordre: changements.ordre } : {}),
          rev: { increment: 1 },
          updatedBy: ctx.userId,
        },
      }),
    ),
  )
}

export async function retirerPointModele(pointId: string): Promise<void> {
  const { ctx } = await accesChecklist("gestion")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const point = await client.checklistTemplateItem.findFirst({ where: { id: pointId, teamId: ctx.teamId, deletedAt: null } })
  if (!point) refus("Ce point n'appartient pas à un modèle de la team.")
  await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
      tx.checklistTemplateItem.update({ where: { id: pointId }, data: { deletedAt: new Date(), rev: { increment: 1 }, updatedBy: ctx.userId } }),
    ),
  )
}

// ─── Listes ──────────────────────────────────────────────────────────────────

export interface SaisieListe {
  titre: string
  phase: Phase
  echeance?: string | null
  ouverteAssistance?: boolean
}

// Liste vierge pour l'épreuve (commune) ou pour un engagement (véhicule repris de l'engagement).
export async function creerListeVierge(epreuveId: string, engagementId: string | null, saisie: SaisieListe): Promise<string> {
  const { ctx } = await accesChecklist("ecriture")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  await epreuveDe(client, ctx.teamId, epreuveId)
  const entry = engagementId ? await engagementDe(client, ctx.teamId, engagementId, epreuveId) : null
  const id = newId()
  // Une section « Points » par défaut : sans elle, on ne pourrait pas ajouter de point à une liste vierge.
  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    await tx.checklistList.create({
      data: {
        id,
        teamId: ctx.teamId,
        epreuveId,
        engagementId,
        vehiculeId: entry?.vehicleId ?? null,
        titre: texte(saisie.titre, "Le titre de la liste"),
        phase: saisie.phase,
        echeance: dateDeJour(saisie.echeance ?? null),
        ouverteAssistance: saisie.ouverteAssistance ?? false,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
    await tx.checklistSection.create({
      data: { id: newId(), teamId: ctx.teamId, listeId: id, titre: "Points", ordre: 0, createdBy: ctx.userId, updatedBy: ctx.userId },
    })
  })
  return id
}

// Liste créée depuis un modèle : sections et points copiés, point_modele_origine renseigné, échéance calculée.
export async function creerListeDepuisModele(modeleId: string, epreuveId: string, engagementId: string | null): Promise<string> {
  const { ctx } = await accesChecklist("ecriture")
  return creerListeDepuisModeleDans(ctx, modeleId, epreuveId, engagementId)
}

// Sans garde de session : appelée par la décision de la boîte (liaisons-serveur.ts), dont le droit est déjà contrôlé.
export async function creerListeDepuisModeleDans(ctx: ContexteTeam, modeleId: string, epreuveId: string, engagementId: string | null): Promise<string> {
  if (!modelesVisiblesPour(ctx.membership.role as Parameters<typeof modelesVisiblesPour>[0])) {
    refus("Ton rôle ne donne pas accès aux modèles de Check-lists.")
  }
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const modele = await client.checklistTemplate.findFirst({
    where: { id: modeleId, deletedAt: null, OR: [{ fourni: true, teamId: null }, { teamId: ctx.teamId }] },
    include: { sections: { where: { deletedAt: null }, orderBy: { ordre: "asc" }, include: { items: { where: { deletedAt: null }, orderBy: { ordre: "asc" } } } } },
  })
  if (!modele) refus("Ce modèle n'existe pas ou n'est plus disponible.")
  const epreuve = await epreuveDe(client, ctx.teamId, epreuveId)
  const entry = engagementId ? await engagementDe(client, ctx.teamId, engagementId, epreuveId) : null
  const echeance = echeanceDeListe(
    jourCivil(epreuve.dateDebut),
    modele.sections.flatMap((section) => section.items.map((item) => item.echeanceRelative)),
  )

  const listeId = newId()
  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    await tx.checklistList.create({
      data: {
        id: listeId,
        teamId: ctx.teamId,
        epreuveId,
        engagementId,
        vehiculeId: entry?.vehicleId ?? null,
        modeleSourceId: modele.id,
        titre: modele.nom,
        phase: modele.phase ?? "avant_depart",
        echeance: dateDeJour(echeance),
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
    for (const section of modele.sections) {
      const sectionId = newId()
      await tx.checklistSection.create({
        data: { id: sectionId, teamId: ctx.teamId, listeId, titre: section.titre, ordre: section.ordre, createdBy: ctx.userId, updatedBy: ctx.userId },
      })
      for (const item of section.items) {
        await tx.checklistItem.create({
          data: {
            id: newId(),
            teamId: ctx.teamId,
            sectionId,
            libelle: item.libelle,
            critique: item.critique,
            ...liensDuPointCopie(item.lienType),
            pointModeleOrigineId: item.id,
            ajoutePendantEpreuve: false,
            ordre: item.ordre,
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          },
        })
      }
    }
    await recalculerListe(tx, ctx, listeId)
  })
  return listeId
}

export async function ajouterSectionListe(listeId: string, titre: string, ordre = 0): Promise<string> {
  const { ctx, niveau } = await accesChecklist("ecriture")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const liste = await client.checklistList.findFirst({ where: { id: listeId, teamId: ctx.teamId, deletedAt: null } })
  if (!liste) refus("Cette liste n'existe plus.")
  exigerListeVisible(ctx.membership.role, liste)
  if (!aAuMoins(niveau, "ecriture")) refus("Cette action demande le niveau écriture sur Check-lists.")
  const id = newId()
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.checklistSection.create({
      data: { id, teamId: ctx.teamId, listeId, titre: texte(titre, "Le titre de la section"), ordre, createdBy: ctx.userId, updatedBy: ctx.userId },
    }),
  )
  return id
}

export interface ChangementsListe {
  titre?: string
  phase?: Phase
  echeance?: string | null
  ouverteAssistance?: boolean
}

// Titre, phase et échéance : écriture. L'ouverture à l'assistance : gestion (956 §6).
export async function modifierListe(listeId: string, changements: ChangementsListe): Promise<void> {
  const { ctx, niveau } = await accesChecklist("ecriture")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const liste = await client.checklistList.findFirst({ where: { id: listeId, teamId: ctx.teamId, deletedAt: null } })
  if (!liste) refus("Cette liste n'existe plus.")
  if (changements.ouverteAssistance !== undefined && !aAuMoins(niveau, "gestion")) {
    refus("Seule la gestion ouvre une liste à l'assistance.")
  }
  await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
      tx.checklistList.update({
        where: { id: listeId },
        data: {
          ...(changements.titre !== undefined ? { titre: texte(changements.titre, "Le titre de la liste") } : {}),
          ...(changements.phase !== undefined ? { phase: changements.phase } : {}),
          ...(changements.echeance !== undefined ? { echeance: dateDeJour(changements.echeance) } : {}),
          ...(changements.ouverteAssistance !== undefined ? { ouverteAssistance: changements.ouverteAssistance } : {}),
          rev: { increment: 1 },
          updatedBy: ctx.userId,
        },
      }),
    ),
  )
}

export async function retirerListe(listeId: string): Promise<void> {
  const { ctx } = await accesChecklist("gestion")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const liste = await client.checklistList.findFirst({ where: { id: listeId, teamId: ctx.teamId, deletedAt: null } })
  if (!liste) refus("Cette liste n'existe plus.")
  await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
      tx.checklistList.update({ where: { id: listeId }, data: { deletedAt: new Date(), rev: { increment: 1 }, updatedBy: ctx.userId } }),
    ),
  )
}

// ─── Points ──────────────────────────────────────────────────────────────────

export interface SaisiePoint {
  libelle: string
  critique?: boolean
  personneId?: string | null
}

async function exigerPersonne(client: Client, teamId: string, personneId: string | null | undefined): Promise<void> {
  if (!personneId) return
  const personne = await client.corePerson.findFirst({ where: { id: personneId, teamId, deletedAt: null }, select: { id: true } })
  if (!personne) refus("Cette personne n'appartient pas à la team.")
}

// Ajoute un point à une section. L'assistance n'ajoute que dans une liste ouverte à elle, et le point lui appartient.
export async function ajouterPoint(sectionId: string, saisie: SaisiePoint): Promise<string> {
  const { ctx, niveau } = await accesChecklist("contribution")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const section = await client.checklistSection.findFirst({
    where: { id: sectionId, teamId: ctx.teamId, deletedAt: null },
    include: { liste: true },
  })
  if (!section) refus("Cette section n'existe plus.")
  const liste = section.liste
  exigerListeVisible(ctx.membership.role, liste)
  exigerDroitPoint(ctx, niveau, "ajouter", liste, null)
  await exigerPersonne(client, ctx.teamId, saisie.personneId)

  const epreuve = await epreuveDe(client, ctx.teamId, liste.epreuveId)
  const ajoutePendantEpreuve = epreuveCommencee(jourCivil(epreuve.dateDebut), jourParis(new Date()))
  const critique = saisie.critique ?? false
  const id = newId()
  const resultat = await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
      await tx.checklistItem.create({
        data: {
          id,
          teamId: ctx.teamId,
          sectionId,
          libelle: texte(saisie.libelle, "Le libellé du point"),
          critique,
          personneId: saisie.personneId ?? null,
          lienType: "aucun",
          ajoutePendantEpreuve,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      })
      return recalculerListe(tx, ctx, liste.id)
    }),
  )
  await emettreApresChangement(ctx, { id: liste.id, epreuveId: liste.epreuveId, echeance: liste.echeance, titre: liste.titre }, resultat, {
    ancien: null,
    nouveau: "a_faire",
    critique,
    ajoute: true,
    pointId: id,
    libelle: saisie.libelle,
  })
  return id
}

export interface ChangementsPoint {
  libelle?: string
  critique?: boolean
  personneId?: string | null
  note?: string | null
}

// Une note seule est une annotation (ouverte à l'assistance sur tout point). Le reste modifie le point.
export async function modifierPoint(pointId: string, changements: ChangementsPoint): Promise<void> {
  const { ctx, niveau } = await accesChecklist("contribution")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const point = await pointAvecListe(client, ctx.teamId, pointId)
  const liste = point.section.liste
  exigerListeVisible(ctx.membership.role, liste)
  const action: ActionSurPoint = Object.keys(changements).every((cle) => cle === "note") ? "annoter" : "modifier"
  exigerDroitPoint(ctx, niveau, action, liste, point)
  await exigerPersonne(client, ctx.teamId, changements.personneId)

  const resultat = await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
      await tx.checklistItem.update({
        where: { id: pointId },
        data: {
          ...(changements.libelle !== undefined ? { libelle: texte(changements.libelle, "Le libellé du point") } : {}),
          ...(changements.critique !== undefined ? { critique: changements.critique } : {}),
          ...(changements.personneId !== undefined ? { personneId: changements.personneId } : {}),
          ...(changements.note !== undefined ? { note: changements.note } : {}),
          rev: { increment: 1 },
          updatedBy: ctx.userId,
        },
      })
      return recalculerListe(tx, ctx, liste.id)
    }),
  )
  await emettreApresChangement(ctx, { id: liste.id, epreuveId: liste.epreuveId, echeance: liste.echeance, titre: liste.titre }, resultat, null)
  if (point.personneId) await levereReassignationSiPlusDePoint(ctx, point.personneId)
}

export interface OptionsStatut {
  horsLigne?: boolean
  appareilId?: string | null
}

// Chaque changement de statut écrit une ligne du journal et recalcule la liste (brief §4).
export async function changerStatutPoint(pointId: string, nouveau: StatutPoint, options: OptionsStatut = {}): Promise<void> {
  const { ctx, niveau } = await accesChecklist("contribution")
  return changerStatutPointDans(ctx, niveau, pointId, nouveau, options)
}

// Sans garde de session : le vérificateur (scripts/verifier-checklist.ts) passe par ici avec son propre contexte. Les
// droits restent contrôlés (assistancePeut, niveau écriture).
export async function changerStatutPointDans(ctx: ContexteTeam, niveau: Niveau, pointId: string, nouveau: StatutPoint, options: OptionsStatut = {}): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const point = await pointAvecListe(client, ctx.teamId, pointId)
  const liste = point.section.liste
  exigerListeVisible(ctx.membership.role, liste)
  exigerDroitPoint(ctx, niveau, "cocher", liste, point)
  if (point.statut === nouveau) return

  const ancien = point.statut
  const maintenant = new Date()
  const resultat = await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
      await tx.checklistItem.update({
        where: { id: pointId },
        data: { statut: nouveau, cocheParId: ctx.userId, cocheLe: maintenant, rev: { increment: 1 }, updatedBy: ctx.userId },
      })
      await tx.checklistCheckLog.create({
        data: {
          id: newId(),
          teamId: ctx.teamId,
          pointId,
          ancienStatut: ancien,
          nouveauStatut: nouveau,
          parId: ctx.userId,
          le: maintenant,
          appareilId: options.appareilId ?? null,
          horsLigne: options.horsLigne ?? false,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      })
      return recalculerListe(tx, ctx, liste.id)
    }),
  )
  await emettreApresChangement(ctx, { id: liste.id, epreuveId: liste.epreuveId, echeance: liste.echeance, titre: liste.titre }, resultat, {
    ancien,
    nouveau,
    critique: point.critique,
    ajoute: false,
    pointId,
    libelle: point.libelle,
    lienType: point.lienType,
    lienId: point.lienId,
    personneId: point.personneId,
  })
  if (point.personneId) await levereReassignationSiPlusDePoint(ctx, point.personneId)
}

export async function retirerPoint(pointId: string): Promise<void> {
  const { ctx, niveau } = await accesChecklist("contribution")
  return retirerPointDans(ctx, niveau, pointId)
}

// Sans garde de session (voir changerStatutPointDans). L'assistance ne retire que ses propres points.
export async function retirerPointDans(ctx: ContexteTeam, niveau: Niveau, pointId: string): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const point = await pointAvecListe(client, ctx.teamId, pointId)
  const liste = point.section.liste
  exigerListeVisible(ctx.membership.role, liste)
  exigerDroitPoint(ctx, niveau, "retirer", liste, point)

  const resultat = await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
      await tx.checklistItem.update({ where: { id: pointId }, data: { deletedAt: new Date(), rev: { increment: 1 }, updatedBy: ctx.userId } })
      return recalculerListe(tx, ctx, liste.id)
    }),
  )
  await emettreApresChangement(ctx, { id: liste.id, epreuveId: liste.epreuveId, echeance: liste.echeance, titre: liste.titre }, resultat, null)
  if (point.statut === "probleme") {
    await leverActionSiEnAttente(ctx, cleOrdreDePoint(pointId))
    await leverActionSiEnAttente(ctx, cleTacheDeProbleme(pointId))
  }
  if (point.critique) await leverActionSiEnAttente(ctx, cleActionPointCritique(pointId))
  if (point.personneId) await levereReassignationSiPlusDePoint(ctx, point.personneId)
}

// « Ajouter au modèle » (débrief, 5.6 §1.6) : copie un point ajouté pendant l'épreuve dans le modèle d'origine de sa
// liste. Gestion seulement. Un modèle fourni ne se modifie pas : il faut le copier d'abord (refus avec la raison).
export async function ajouterPointAuModele(pointId: string): Promise<string> {
  const { ctx } = await accesChecklist("gestion")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const point = await client.checklistItem.findFirst({
    where: { id: pointId, teamId: ctx.teamId, deletedAt: null },
    select: { libelle: true, critique: true, section: { select: { titre: true, liste: { select: { modeleSourceId: true } } } } },
  })
  if (!point) refus("Ce point n'existe plus.")
  const modeleId = point.section.liste.modeleSourceId
  if (!modeleId) refus("Cette liste ne vient pas d'un modèle : il n'y a rien à ajouter au modèle.")
  const modele = await client.checklistTemplate.findFirst({ where: { id: modeleId, teamId: ctx.teamId, deletedAt: null }, select: { id: true, fourni: true } })
  if (!modele) refus("Le modèle d'origine n'existe plus dans la team.")
  if (modele.fourni) refus("Ce modèle est fourni par la plateforme. Copie-le d'abord, puis ajoute le point à ta copie.")

  const deja = await client.checklistTemplateItem.findFirst({
    where: { teamId: ctx.teamId, deletedAt: null, libelle: point.libelle, section: { modeleId: modele.id, deletedAt: null } },
    select: { id: true },
  })
  if (deja) refus("Ce point est déjà dans le modèle.")

  // Section du modèle de même titre que celle du point, sinon la première section, sinon une nouvelle.
  const section =
    (await client.checklistTemplateSection.findFirst({ where: { modeleId: modele.id, teamId: ctx.teamId, titre: point.section.titre, deletedAt: null } })) ??
    (await client.checklistTemplateSection.findFirst({ where: { modeleId: modele.id, teamId: ctx.teamId, deletedAt: null }, orderBy: { ordre: "asc" } }))
  const sectionId = section?.id ?? (await ajouterSectionModele(modele.id, point.section.titre))
  return ajouterPointModele(sectionId, { libelle: point.libelle, critique: point.critique })
}
