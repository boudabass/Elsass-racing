// Objets liés à un point (tâche 5.7a, article 956 §4) : choix, lecture unitaire et résolution en lot. Chaque type passe par la
// lecture partagée de son app propriétaire ; Check-lists ne touche jamais à leurs tables. Lecture seule. Un type dont l'app
// n'est pas ouverte au membre ne fournit aucun objet : son état ne s'affiche pas.
import * as documents from "@/apps/documents/lectures-partagees"
import * as equipe from "@/apps/equipe/lectures-partagees"
import * as garage from "@/apps/garage/lectures-partagees"
import * as partenaires from "@/apps/partenaires/lectures-partagees"
import * as voiture from "@/apps/voiture/lectures-partagees"
import { niveauDe } from "@/core/actions/actions-serveur"
import type { ContexteTeam } from "@/core/contexte"
import { prismaPourTeam } from "@/lib/prisma"

import { APP_DU_TYPE, cleLien, dansPortee, type ResolutionLien } from "./objets-lies"
import { TYPES_OBJET_LIE, type ObjetLieLu, type PorteeListe, type TypeObjetLie } from "./objets-types"

// Véhicule et personnes de l'engagement d'une liste. Une liste commune n'en a aucun.
export async function porteeDeListe(ctx: ContexteTeam, listeId: string): Promise<PorteeListe> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const liste = await client.checklistList.findFirst({
    where: { id: listeId, teamId: ctx.teamId, deletedAt: null },
    select: { engagementId: true },
  })
  if (!liste?.engagementId) return { vehicleId: null, personIds: [] }
  const engagement = await client.coreEventEntry.findFirst({
    where: { id: liste.engagementId, teamId: ctx.teamId, deletedAt: null },
    select: { vehicleId: true, piloteId: true, copiloteId: true },
  })
  if (!engagement) return { vehicleId: null, personIds: [] }
  return {
    vehicleId: engagement.vehicleId,
    personIds: [engagement.piloteId, engagement.copiloteId].filter((id): id is string => id !== null),
  }
}

// Les types d'objets dont l'app est ouverte au membre (niveau autre que « aucun »). Une app lue une seule fois.
export async function typesAccessibles(ctx: ContexteTeam, types: readonly TypeObjetLie[]): Promise<Set<TypeObjetLie>> {
  const parApp = new Map<string, boolean>()
  const accessibles = new Set<TypeObjetLie>()
  for (const type of types) {
    const cle = APP_DU_TYPE[type].cle
    if (!parApp.has(cle)) parApp.set(cle, (await niveauDe(ctx, cle)) !== "aucun")
    if (parApp.get(cle)) accessibles.add(type)
  }
  return accessibles
}

// Objets qu'un point de cette liste peut lier, pour un type. L'appelant a déjà contrôlé l'accès à l'app du type.
export async function choixObjetsLies(ctx: ContexteTeam, type: TypeObjetLie, portee: PorteeListe): Promise<ObjetLieLu[]> {
  switch (type) {
    case "organe_garage":
    case "train_pneus": {
      if (!portee.vehicleId) return []
      return (await garage.listerObjetsPourChecklist(ctx, portee.vehicleId)).filter((objet) => objet.type === type)
    }
    case "papier_voiture":
    case "logo_voiture": {
      if (!portee.vehicleId) return []
      return (await voiture.listerObjetsPourChecklist(ctx, portee.vehicleId)).filter((objet) => objet.type === type)
    }
    case "licence_equipe":
    case "homologation_equipe":
      return (await equipe.listerObjetsPourChecklist(ctx, portee.personIds)).filter((objet) => objet.type === type)
    case "contrepartie_partenaires":
      return partenaires.listerObjetsPourChecklist(ctx)
    case "document_documents":
      return documents.listerObjetsPourChecklist(ctx)
  }
}

// Tous les objets proposables sur une liste, tous types confondus et accessibles (choix d'un lien dans la fiche).
export async function choixTousObjetsLies(ctx: ContexteTeam, portee: PorteeListe): Promise<ObjetLieLu[]> {
  const accessibles = await typesAccessibles(ctx, TYPES_OBJET_LIE)
  const objets: ObjetLieLu[] = []
  for (const type of TYPES_OBJET_LIE) {
    if (accessibles.has(type)) objets.push(...(await choixObjetsLies(ctx, type, portee)))
  }
  return objets
}

// Un objet relu par son identifiant, et seulement s'il est dans la portée de la liste. Null : introuvable, supprimé,
// masqué, ou hors de la portée. Sert à valider un lien avant de l'écrire.
export async function lireObjetLie(ctx: ContexteTeam, type: TypeObjetLie, id: string, portee: PorteeListe): Promise<ObjetLieLu | null> {
  const objet = await lireObjetBrut(ctx, type, id)
  if (!objet || !dansPortee(objet, portee)) return null
  return objet
}

async function lireObjetBrut(ctx: ContexteTeam, type: TypeObjetLie, id: string): Promise<ObjetLieLu | null> {
  switch (type) {
    case "organe_garage":
    case "train_pneus":
      return garage.lireObjetPourChecklist(ctx, type, id)
    case "papier_voiture":
    case "logo_voiture":
      return voiture.lireObjetPourChecklist(ctx, type, id)
    case "licence_equipe":
    case "homologation_equipe":
      return equipe.lireObjetPourChecklist(ctx, type, id)
    case "contrepartie_partenaires":
      return partenaires.lireObjetPourChecklist(ctx, id)
    case "document_documents":
      return documents.lireObjetPourChecklist(ctx, id)
  }
}

// Résout en lot les liens d'une liste (une lecture par type accessible). Clé : cleLien(type, id). Un type non accessible
// donne « acces_refuse » ; un lien absent de la liste d'objets donne « introuvable ». Jamais de plantage.
export async function resoudreObjetsLies(
  ctx: ContexteTeam,
  portee: PorteeListe,
  liens: ReadonlyArray<{ lienType: TypeObjetLie; lienId: string }>,
): Promise<Map<string, ResolutionLien>> {
  const types = Array.from(new Set(liens.map((lien) => lien.lienType)))
  const accessibles = await typesAccessibles(ctx, types)
  const objets = new Map<string, ObjetLieLu>()
  for (const type of types) {
    if (!accessibles.has(type)) continue
    for (const objet of await choixObjetsLies(ctx, type, portee)) {
      objets.set(cleLien(objet.type, objet.id), objet)
    }
  }
  const resultat = new Map<string, ResolutionLien>()
  for (const { lienType, lienId } of liens) {
    const cle = cleLien(lienType, lienId)
    if (!accessibles.has(lienType)) {
      resultat.set(cle, { statut: "acces_refuse", appLibelle: APP_DU_TYPE[lienType].libelle })
      continue
    }
    const objet = objets.get(cle)
    resultat.set(cle, objet && dansPortee(objet, portee) ? { statut: "objet", objet } : { statut: "introuvable" })
  }
  return resultat
}
