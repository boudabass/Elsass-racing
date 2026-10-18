// Logo de la team pour un PDF, lu par le service des fichiers (brief 3.1b, section 3), sans passer par HTTP.
// @react-pdf ne lit que le JPEG et le PNG : pour le WebP ou le SVG, on renvoie null, et le document sort sans logo.
import { readFile } from "node:fs/promises"

import { cheminFichier } from "@/core/fichiers/fichiers-serveur"
import { prismaPourTeam } from "@/lib/prisma"

import type { LogoPdf } from "./document-team"

export async function lireLogoPourPdf(teamId: string, userId: string): Promise<LogoPdf | null> {
  const client = prismaPourTeam(teamId, userId)
  const equipe = await client.coreTeam.findUnique({ where: { id: teamId }, select: { logoFileId: true } })
  if (!equipe?.logoFileId) return null

  const fichier = await client.coreFile.findFirst({
    where: { id: equipe.logoFileId, teamId, deletedAt: null },
    select: { storageKey: true, mimeType: true },
  })
  if (!fichier) return null

  const format = fichier.mimeType === "image/jpeg" ? "jpg" : fichier.mimeType === "image/png" ? "png" : null
  if (!format) return null

  try {
    return { data: await readFile(cheminFichier(fichier.storageKey)), format }
  } catch {
    // Fichier absent du disque : le PDF sort sans logo, sans faire échouer l'export.
    return null
  }
}
