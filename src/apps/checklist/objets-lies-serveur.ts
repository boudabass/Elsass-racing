// Objets liés à un point (tâche 5.7a, 956 §4) : choix, lecture unitaire et résolution en lot. Chaque type passe par la
// lecture partagée de son app propriétaire ; Check-lists ne touche jamais à leurs tables. Lecture seule.
import * as documents from "@/apps/documents/lectures-partagees"
import * as equipe from "@/apps/equipe/lectures-partagees"
import * as garage from "@/apps/garage/lectures-partagees"
import * as partenaires from "@/apps/partenaires/lectures-partagees"
import * as voiture from "@/apps/voiture/lectures-partagees"
import type { ContexteTeam } from "@/core/contexte"
import { prismaPourTeam } from "@/lib/prisma"

import { cleLien, dansPortee } from "./objets-lies"
import type { ObjetLieLu, PorteeListe, TypeObjetLie } from "./objets-types"

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

// Objets qu'un point de cette liste peut lier, pour le choix d'un type de lien. Une liste commune n'a que les objets de
// la team (contreparties, documents).
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

// Résout en lot les liens d'une liste (une lecture par type). Clé : « type:id ». Un lien absent de la table est un objet
// introuvable : l'appelant l'affiche sans planter.
export async function resoudreObjetsLies(
  ctx: ContexteTeam,
  portee: PorteeListe,
  liens: ReadonlyArray<{ lienType: TypeObjetLie; lienId: string }>,
): Promise<Map<string, ObjetLieLu>> {
  const resultat = new Map<string, ObjetLieLu>()
  const types = Array.from(new Set(liens.map((lien) => lien.lienType)))
  for (const type of types) {
    for (const objet of await choixObjetsLies(ctx, type, portee)) {
      resultat.set(cleLien(objet.type, objet.id), objet)
    }
  }
  return resultat
}

