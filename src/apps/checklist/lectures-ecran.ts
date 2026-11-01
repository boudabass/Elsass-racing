// Lectures des écrans de Check-lists (tâche 5.6, §1). Une lecture n'écrit jamais. Chaque lecture passe par accesChecklist
// et filtre selon le rôle (listeVisiblePour, modelesVisiblesPour) : l'assistance ne voit que ses listes ouvertes.
import { modeTerrainDuMembre } from "@/apps/settings/preferences-serveur"
import { notesEtPhotos } from "@/core/notes/notes-serveur"
import { prismaPourTeam } from "@/lib/prisma"

import { historiquePoint, listeComplete, listesDeEpreuve, modelesVisibles } from "./lectures-serveur"
import { cleLien, libelleEtatLien } from "./objets-lies"
import { choixTousObjetsLies, porteeDeListe, resoudreObjetsLies } from "./objets-lies-serveur"
import type { TypeObjetLie } from "./objets-types"
import {
  avancementPourcent,
  avertissementAvantPhase,
  jourParis,
  listeVisiblePour,
  modelesVisiblesPour,
  phaseEnCours,
  pointsCritiquesOuverts,
  zoneDeListe,
  type ListePhasee,
  type PhaseEpreuve,
  type PointRegle,
  type Zone,
} from "./regles"
import { accesChecklist } from "./services-serveur"
import { controlePoint } from "./photos-serveur"
import { prochaineEtapeEpreuve } from "./widgets-serveur"

// Une liste avec le détail de ses points, pour la jauge, la phase en cours et les avertissements.
export interface ListeAvecPoints extends ListePhasee {
  titre: string
  points: Array<PointRegle & { id: string; libelle: string }>
}

// Listes visibles d'une épreuve, avec leurs points. Une seule lecture pour toute la préparation.
export async function listesAvecPoints(epreuveId: string): Promise<ListeAvecPoints[]> {
  const { ctx } = await accesChecklist("lecture")
  const visibles = await listesDeEpreuve(epreuveId)
  if (visibles.length === 0) return []
  const items = await prismaPourTeam(ctx.teamId, ctx.userId).checklistItem.findMany({
    where: {
      teamId: ctx.teamId,
      deletedAt: null,
      section: { deletedAt: null, liste: { deletedAt: null, epreuveId, id: { in: visibles.map((liste) => liste.id) } } },
    },
    select: { id: true, libelle: true, statut: true, critique: true, section: { select: { listeId: true } } },
    orderBy: [{ ordre: "asc" }, { id: "asc" }],
  })
  return visibles.map((liste) => ({
    id: liste.id,
    titre: liste.titre,
    phase: liste.phase as PhaseEpreuve,
    points: items.filter((item) => item.section.listeId === liste.id).map(({ id, libelle, statut, critique }) => ({ id, libelle, statut, critique })),
  }))
}

// Prochaines épreuves (envisagées ou en cours) et épreuve affichée : celle demandée si elle est dans la liste, sinon la
// prochaine. Null s'il n'y a aucune épreuve à venir.
export async function pagePreparation(epreuveDemandee: string | undefined) {
  const { ctx, niveau } = await accesChecklist("lecture")
  const debut = new Date(`${jourParis(new Date())}T00:00:00Z`)
  const aVenir = await prismaPourTeam(ctx.teamId, ctx.userId).coreEvent.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, statut: { in: ["envisagee", "en_cours"] }, dateDebut: { gte: debut } },
    orderBy: { dateDebut: "asc" },
    take: 8,
    select: { id: true, nom: true, dateDebut: true },
  })
  const epreuve = aVenir.find((e) => e.id === epreuveDemandee) ?? aVenir[0] ?? null
  if (!epreuve) return { niveau, epreuves: aVenir, epreuve: null, listes: [], phaseEnCours: "avant_depart" as PhaseEpreuve, avancement: 0, zone: "orange" as Zone, critiquesOuverts: 0, prochaine: null }

  const listes = await listesAvecPoints(epreuve.id)
  const tous = listes.flatMap((liste) => liste.points)
  const listesDeEpreuveVisibles = await listesDeEpreuve(epreuve.id)
  const meta = new Map(listesDeEpreuveVisibles.map((liste) => [liste.id, liste]))
  return {
    niveau,
    epreuves: aVenir,
    epreuve,
    phaseEnCours: phaseEnCours(listes),
    avancement: avancementPourcent(tous),
    // La zone de l'épreuve suit la règle des listes (ratio exact), pas l'avancement arrondi.
    zone: zoneDeListe(tous),
    critiquesOuverts: pointsCritiquesOuverts(tous).length,
    prochaine: await prochaineEtapeEpreuve(ctx, epreuve.id),
    // Communes d'abord, puis une par engagement (déjà triées par listesDeEpreuve).
    listes: listes.map((liste) => ({
      ...meta.get(liste.id)!,
      titre: liste.titre,
    })),
  }
}

// Une liste et son avertissement avant phase. Null si la liste n'existe pas ou n'est pas visible.
export async function pageListe(listeId: string, avertir: boolean) {
  const { ctx, niveau } = await accesChecklist("lecture")
  const liste = await listeComplete(listeId)
  if (!liste) return null
  const epreuve = await listesAvecPoints(liste.epreuveId)
  const ouverts = avertir ? avertissementAvantPhase(liste.phase as PhaseEpreuve, epreuve) : []
  const titres = new Map(epreuve.map((l) => [l.id, l.titre]))
  const libelles = new Map(epreuve.flatMap((l) => l.points.map((p) => [p.id, p.libelle] as const)))
  // État du lien de chaque point de la liste (5.7a) : une résolution en lot, pour ne pas lire point par point.
  const portee = await porteeDeListe(ctx, liste.id)
  const liens = liste.sections
    .flatMap((section) => section.items)
    .filter((point) => point.lienId && point.lienType !== "aucun")
    .map((point) => ({ pointId: point.id, lienType: point.lienType as TypeObjetLie, lienId: point.lienId as string }))
  const resolus = await resoudreObjetsLies(ctx, portee, liens)
  const etatsLiens = Object.fromEntries(
    liens.map((lien) => [lien.pointId, libelleEtatLien(resolus.get(cleLien(lien.lienType, lien.lienId)) ?? { statut: "introuvable" })]),
  )
  return {
    niveau,
    terrain: await modeTerrainDuMembre(ctx),
    etatsLiens,
    liste,
    phaseEnCours: phaseEnCours(epreuve),
    avertissement: ouverts.map((o) => ({ listeTitre: titres.get(o.listeId) ?? "", libelle: libelles.get(o.pointId) ?? "" })),
  }
}

// Fiche d'un point : le point, son historique, les personnes qu'on peut lui affecter (écriture et plus) et ses photos.
// Null si le point n'existe pas ou si sa liste n'est pas visible pour ce rôle.
export async function pagePoint(pointId: string) {
  const { ctx, niveau } = await accesChecklist("lecture")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const point = await client.checklistItem.findFirst({
    where: { id: pointId, teamId: ctx.teamId, deletedAt: null },
    select: {
      id: true,
      libelle: true,
      critique: true,
      statut: true,
      note: true,
      lienType: true,
      lienId: true,
      ajoutePendantEpreuve: true,
      personneId: true,
      personne: { select: { prenom: true, nom: true } },
      section: { select: { liste: { select: { id: true, titre: true, ouverteAssistance: true } } } },
    },
  })
  if (!point || !listeVisiblePour(ctx.membership.role, point.section.liste)) return null
  const peutAffecter = niveau === "ecriture" || niveau === "gestion"
  const portee = await porteeDeListe(ctx, point.section.liste.id)
  const lienActuel = point.lienId && point.lienType !== "aucun" ? [{ lienType: point.lienType as TypeObjetLie, lienId: point.lienId }] : []
  const [historique, personnes, { photos }, resolus, choixLiens] = await Promise.all([
    historiquePoint(pointId),
    peutAffecter
      ? client.corePerson.findMany({ where: { teamId: ctx.teamId, deletedAt: null }, select: { id: true, prenom: true, nom: true }, orderBy: [{ nom: "asc" }, { prenom: "asc" }] })
      : Promise.resolve([]),
    notesEtPhotos(ctx, controlePoint(pointId)),
    resoudreObjetsLies(ctx, portee, lienActuel),
    // Le choix d'un lien ne se propose qu'à l'écriture : la fiche en lecture n'affiche que l'état du lien posé.
    peutAffecter ? choixTousObjetsLies(ctx, portee) : Promise.resolve([]),
  ])
  const lien = lienActuel[0] ? (resolus.get(cleLien(lienActuel[0].lienType, lienActuel[0].lienId)) ?? null) : null
  return { niveau, point, historique, personnes, photos, lien, choixLiens }
}

// Modèles visibles et niveau de lecture (pour le bouton Copier et le lien de modification).
export async function pageModeles() {
  const { niveau } = await accesChecklist("lecture")
  return { niveau, modeles: await modelesVisibles() }
}

// Débrief : une épreuve (celle demandée, sinon la plus récente déjà commencée), ses points non cochés, ses problèmes,
// et les points ajoutés pendant l'épreuve, à reporter dans le modèle d'origine.
export async function pageDebrief(epreuveDemandee: string | undefined) {
  const { ctx, niveau } = await accesChecklist("lecture")
  const debut = new Date(`${jourParis(new Date())}T00:00:00Z`)
  const passees = await prismaPourTeam(ctx.teamId, ctx.userId).coreEvent.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, dateDebut: { lt: debut } },
    orderBy: { dateDebut: "desc" },
    take: 8,
    select: { id: true, nom: true, dateDebut: true },
  })
  const epreuve = passees.find((e) => e.id === epreuveDemandee) ?? passees[0] ?? null
  if (!epreuve) return { niveau, epreuves: passees, epreuve: null, lignes: [] as DebriefLigne[] }

  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const listes = await listesDeEpreuve(epreuve.id)
  const ids = new Set(listes.map((liste) => liste.id))
  const items = await client.checklistItem.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, section: { deletedAt: null, liste: { deletedAt: null, epreuveId: epreuve.id } } },
    select: {
      id: true,
      libelle: true,
      critique: true,
      statut: true,
      ajoutePendantEpreuve: true,
      section: { select: { liste: { select: { id: true, titre: true, modeleSourceId: true } } } },
    },
    orderBy: [{ ordre: "asc" }, { id: "asc" }],
  })
  const lignes: DebriefLigne[] = items
    .filter((item) => ids.has(item.section.liste.id) && (item.statut === "a_faire" || item.statut === "probleme" || item.ajoutePendantEpreuve))
    .map((item) => ({
      pointId: item.id,
      libelle: item.libelle,
      critique: item.critique,
      statut: item.statut,
      ajoute: item.ajoutePendantEpreuve,
      listeTitre: item.section.liste.titre,
      peutAjouterAuModele: item.ajoutePendantEpreuve && item.section.liste.modeleSourceId !== null,
    }))
  return { niveau, epreuves: passees, epreuve, lignes }
}

export interface DebriefLigne {
  pointId: string
  libelle: string
  critique: boolean
  statut: string
  ajoute: boolean
  listeTitre: string
  peutAjouterAuModele: boolean
}

// Un modèle avec ses sections et points, pour l'écran d'édition. Null si le modèle n'est pas visible pour ce rôle
// (fourni ou de la team, et jamais pour l'assistance ou l'invité).
export async function pageModele(modeleId: string) {
  const { ctx, niveau } = await accesChecklist("lecture")
  if (!modelesVisiblesPour(ctx.membership.role)) return null
  const modele = await prismaPourTeam(ctx.teamId, ctx.userId).checklistTemplate.findFirst({
    where: { id: modeleId, deletedAt: null, OR: [{ fourni: true, teamId: null }, { teamId: ctx.teamId }] },
    select: {
      id: true,
      nom: true,
      portee: true,
      phase: true,
      discipline: true,
      fourni: true,
      sections: {
        where: { deletedAt: null },
        orderBy: { ordre: "asc" },
        select: {
          id: true,
          titre: true,
          items: {
            where: { deletedAt: null },
            orderBy: { ordre: "asc" },
            select: { id: true, libelle: true, critique: true, roleSuggere: true, echeanceRelative: true, lienType: true },
          },
        },
      },
    },
  })
  if (!modele) return null
  return { niveau, modele }
}
