// « Tous les fichiers » (tâche 5.4, brief §1) : lecture de core_attachment de la team, sans copie. Un fichier s'affiche
// seulement si son type de fiche est déclaré dans le registre (src/core/fichiers/origines.ts) et si la personne voit la fiche
// d'origine. Un type non déclaré n'est pas affiché. Liste paginée de 50, plus récent d'abord.
import { resoudreOrigines, ORIGINES } from "@/core/fichiers/origines"
import type { FicheOrigine } from "@/core/fichiers/types-origine"
import { prismaPourTeam } from "@/lib/prisma"

import { accesDocuments } from "./services-serveur"

export const TAILLE_PAGE_FICHIERS = 50

export const LIBELLE_ROLE_FICHIER: Record<"ticket" | "preuve" | "photo" | "document", string> = {
  ticket: "Justificatif",
  preuve: "Preuve",
  photo: "Photo",
  document: "Document",
}

export interface FiltresFichiers {
  app?: string
  role?: string
  // Identifiant du compte qui a ajouté le fichier.
  par?: string
  page?: number
}

export interface LigneFichier {
  id: string
  // Identifiant du fichier (core_file) : la route de lecture contrôle les droits de chaque app.
  fichierId: string
  nom: string
  app: string
  role: keyof typeof LIBELLE_ROLE_FICHIER
  ajoutePar: string
  ajouteLe: Date
  origine: FicheOrigine
  badge: string
}

export interface FichiersDonnees {
  lignes: LigneFichier[]
  // Applications proposées dans le filtre : celles qui ont au moins une origine déclarée.
  applications: Array<{ cle: string; libelle: string }>
  auteurs: Array<{ id: string; libelle: string }>
  page: number
  pagePrecedente: boolean
  pageSuivante: boolean
}

const BADGES: Record<string, string> = {
  budget: "Budget",
  documents: "Documents",
  equipe: "Équipe",
  garage: "Garage",
  partenaires: "Partenaires",
  saison: "Saison",
  settings: "Réglages",
  voiture: "Voiture",
}

export async function lireFichiers(filtres: FiltresFichiers): Promise<FichiersDonnees> {
  const { ctx } = await accesDocuments("lecture")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const page = Math.max(1, filtres.page ?? 1)
  const applicationsDeclarees = Array.from(new Set(ORIGINES.map((origine) => origine.app)))
  const applicationsAffichees = Array.from(new Set(ORIGINES.filter((origine) => !origine.masque).map((origine) => origine.app)))
  const appsFiltrees = filtres.app && applicationsDeclarees.includes(filtres.app) ? [filtres.app] : applicationsDeclarees
  const role = filtres.role && filtres.role in LIBELLE_ROLE_FICHIER ? (filtres.role as LigneFichier["role"]) : undefined

  const rattachements = await client.coreAttachment.findMany({
    where: {
      teamId: ctx.teamId,
      deletedAt: null,
      app: { in: appsFiltrees },
      ...(role ? { role } : {}),
      ...(filtres.par ? { createdBy: filtres.par } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * TAILLE_PAGE_FICHIERS,
    take: TAILLE_PAGE_FICHIERS + 1,
    select: {
      id: true,
      fileId: true,
      app: true,
      ficheType: true,
      ficheId: true,
      role: true,
      createdAt: true,
      createdBy: true,
      file: { select: { nom: true } },
    },
  })
  const pageSuivante = rattachements.length > TAILLE_PAGE_FICHIERS
  const visibles = rattachements.slice(0, TAILLE_PAGE_FICHIERS)

  const origines = await resoudreOrigines(
    ctx,
    visibles.map((r) => ({ app: r.app, ficheType: r.ficheType, ficheId: r.ficheId })),
  )
  // Auteurs de toute la team (pour le filtre « ajouté par »), et e-mails des auteurs affichés (repli de nom).
  const auteursTeam = await client.coreAttachment.groupBy({
    by: ["createdBy"],
    where: { teamId: ctx.teamId, deletedAt: null, app: { in: applicationsDeclarees } },
  })
  const auteursIds = auteursTeam.map((a) => a.createdBy).filter((id): id is string => id !== null)
  const comptes = auteursIds.length
    ? await client.coreUser.findMany({ where: { id: { in: auteursIds } }, select: { id: true, email: true } })
    : []
  const emailDe = new Map(comptes.map((c) => [c.id, c.email]))

  const lignes: LigneFichier[] = []
  for (const r of visibles) {
    const origine = origines.get(`${r.app}:${r.ficheType}:${r.ficheId}`)
    if (!origine) continue
    lignes.push({
      id: r.id,
      fichierId: r.fileId,
      nom: r.file.nom,
      app: r.app,
      role: r.role,
      ajoutePar: (r.createdBy && emailDe.get(r.createdBy)) || "Un membre",
      ajouteLe: r.createdAt,
      origine,
      badge: BADGES[r.app] ?? r.app,
    })
  }

  return {
    lignes,
    applications: applicationsAffichees.map((app) => ({ cle: app, libelle: BADGES[app] ?? app })),
    auteurs: comptes.map((c) => ({ id: c.id, libelle: c.email })),
    page,
    pagePrecedente: page > 1,
    pageSuivante,
  }
}
