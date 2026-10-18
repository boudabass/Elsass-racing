// Bilans de partenariat (brief 3.7, §5). Serveur seulement. Un bilan est un PDF de la team pour un partenaire, sur une
// période : il est enregistré comme fichier (app partenaires, fiche « report », rôle « document ») et tracé dans
// partenaires_report. Les données viennent de construireBilan, qui retire les preuves masquées et hors période.
import "server-only"

import { readFile } from "node:fs/promises"
import { createElement } from "react"
import { z } from "zod"

import { listerCalendrierPourPartenaires, listerResultatsPublicsPourPartenaires } from "@/apps/saison/lectures-partagees"
import type { ContexteTeam } from "@/core/contexte"
import { enregistrerFichier, cheminFichier, rattacherFichier } from "@/core/fichiers/fichiers-serveur"
import type { LogoPdf } from "@/core/pdf/document-team"
import { lireLogoPourPdf } from "@/core/pdf/logo-serveur"
import { nomFichierPdf } from "@/core/pdf/nom-fichier"
import { rendrePdf } from "@/core/pdf/rendu-serveur"
import { newId } from "@/core/ids"
import { executerPourTeam, prismaPourTeam } from "@/lib/prisma"

import { construireBilan, type BilanPartenaire, type ContrepartieBilan, type PreuveBilan, type ResultatBilan } from "./bilan"
import { LIBELLES_STATUT_RESULTAT, LIBELLES_TYPE_PREUVE } from "./affichage"
import { refus } from "./erreurs"
import { BilanPartenairePdf } from "./pdf/bilan-partenaire"
import { accesPartenaires } from "./services-serveur"
import { enRetard, jourParis, STATUTS_CONVENTION_VISIBLES, statutContrepartie } from "./regles"

const schemaJour = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ.")

const schemaBilan = z.object({
  partnerId: z.string().min(1),
  debut: schemaJour,
  fin: schemaJour,
  // Une convention précise, ou toutes les conventions affichables du partenaire.
  agreementId: z.string().min(1).nullable(),
})

export type EntreeBilan = z.input<typeof schemaBilan>

// Date civile (colonne @db.Date) en AAAA-MM-JJ, sans décalage de fuseau.
function jourDe(date: Date): string {
  return date.toISOString().slice(0, 10)
}

// Un jour civil « AAAA-MM-JJ » devient minuit UTC : la colonne @db.Date le relit sans décalage.
function instantDuJour(jour: string): Date {
  return new Date(`${jour}T00:00:00.000Z`)
}

const FORMATS_IMAGE: Record<string, "jpg" | "png"> = { "image/jpeg": "jpg", "image/png": "png" }

export async function genererBilan(entree: EntreeBilan): Promise<string> {
  const { ctx } = await accesPartenaires("ecriture")
  return genererBilanDans(ctx, entree)
}

export async function genererBilanDans(ctx: ContexteTeam, entree: EntreeBilan): Promise<string> {
  const donnees = schemaBilan.parse(entree)
  if (donnees.debut > donnees.fin) refus("La fin de la période est avant son début.")

  const aujourdhui = jourParis(new Date())
  const lecture = await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    const partenaire = await tx.partenairesPartner.findFirst({
      where: { id: donnees.partnerId, teamId: ctx.teamId, deletedAt: null },
      select: { contact: { select: { nom: true } } },
    })
    if (!partenaire) refus("Partenaire introuvable.")

    const conventions = await tx.partenairesAgreement.findMany({
      where: {
        teamId: ctx.teamId,
        partnerId: donnees.partnerId,
        deletedAt: null,
        statut: { in: [...STATUTS_CONVENTION_VISIBLES] },
        ...(donnees.agreementId ? { id: donnees.agreementId } : {}),
      },
      select: { id: true, seasonId: true },
    })
    if (donnees.agreementId && conventions.length === 0) refus("Convention introuvable, ou pas encore signée.")
    const idsConventions = conventions.map((c) => c.id)
    const saisonIds = conventions.map((c) => c.seasonId).filter((id): id is string => id !== null)

    const contrepartiesBrutes = idsConventions.length
      ? await tx.partenairesBenefit.findMany({
          where: { teamId: ctx.teamId, agreementId: { in: idsConventions }, deletedAt: null },
          orderBy: [{ echeance: "asc" }],
          select: { libelle: true, quantitePromise: true, quantiteTenue: true, statut: true, echeance: true },
        })
      : []

    const preuvesBrutes = contrepartiesBrutes.length
      ? await tx.partenairesProof.findMany({
          where: {
            teamId: ctx.teamId,
            benefit: { agreementId: { in: idsConventions } },
            visiblePartenaire: true,
            deletedAt: null,
            date: { gte: instantDuJour(donnees.debut), lte: instantDuJour(donnees.fin) },
          },
          orderBy: { date: "asc" },
          select: {
            id: true,
            date: true,
            type: true,
            lien: true,
            commentaire: true,
            fileId: true,
            event: { select: { nom: true } },
            file: { select: { mimeType: true, storageKey: true } },
          },
        })
      : []

    // Épreuves terminées pendant la période : leur date de fin est passée, et tombe dans la période.
    const epreuves = await listerCalendrierPourPartenaires(tx, ctx.teamId, saisonIds)
    const epreuvesCourues = epreuves.filter((e) => {
      const fin = jourDe(e.dateFin)
      return fin >= donnees.debut && fin <= donnees.fin && fin <= aujourdhui
    }).length

    const resultats = await listerResultatsPublicsPourPartenaires(tx, ctx.teamId, saisonIds)
    const equipe = await tx.coreTeam.findFirst({ where: { id: ctx.teamId }, select: { nom: true, couleurPrincipale: true } })
    if (!equipe) refus("Team introuvable.")

    return { partenaire, contrepartiesBrutes, preuvesBrutes, epreuvesCourues, resultats, equipe }
  })

  const { partenaire, contrepartiesBrutes, preuvesBrutes, epreuvesCourues, resultats, equipe } = lecture

  const contreparties: ContrepartieBilan[] = contrepartiesBrutes.map((c) => {
    const echeance = c.echeance ? jourDe(c.echeance) : null
    const base = { statut: c.statut, quantitePromise: c.quantitePromise, quantiteTenue: c.quantiteTenue, echeance }
    const statut = enRetard(base, aujourdhui) ? "en_retard" : statutContrepartie(base)
    return { libelle: c.libelle, quantitePromise: c.quantitePromise, quantiteTenue: c.quantiteTenue, statut, echeance }
  })

  // Les photos JPEG et PNG sont lues une fois ici : une photo absente du disque reste une ligne de texte.
  const images = new Map<string, LogoPdf>()
  const preuves: PreuveBilan[] = preuvesBrutes.map((p) => {
    const format = p.file ? FORMATS_IMAGE[p.file.mimeType] : undefined
    return {
      id: p.id,
      date: jourDe(p.date),
      type: LIBELLES_TYPE_PREUVE[p.type] ?? p.type,
      epreuve: p.event?.nom ?? null,
      visiblePartenaire: true,
      estImage: format !== undefined,
      fileId: p.fileId,
      lien: p.lien,
      commentaire: p.commentaire,
    }
  })
  for (const p of preuvesBrutes) {
    const format = p.file ? FORMATS_IMAGE[p.file.mimeType] : undefined
    if (!p.fileId || !p.file || !format || images.has(p.fileId)) continue
    try {
      images.set(p.fileId, { data: await readFile(cheminFichier(p.file.storageKey)), format })
    } catch {
      // Fichier absent du disque : la preuve reste citée par sa date.
    }
  }

  const resultatsBilan: ResultatBilan[] = resultats.map((r) => ({
    epreuve: r.epreuve,
    date: jourDe(r.dateDebut),
    statut: LIBELLES_STATUT_RESULTAT[r.statutFinal] ?? r.statutFinal,
    classementGeneral: r.classementGeneral,
    nbClasses: r.nbClasses,
    classementClasse: r.classementClasse,
    nbPartantsClasse: r.nbPartantsClasse,
  }))

  const bilan: BilanPartenaire = construireBilan({
    debut: donnees.debut,
    fin: donnees.fin,
    contreparties,
    preuves,
    resultats: resultatsBilan,
    epreuvesCourues,
  })

  const logo = await lireLogoPourPdf(ctx.teamId, ctx.userId)
  const entreprise = partenaire.contact.nom
  const octets = await rendrePdf(
    createElement(BilanPartenairePdf, {
      bilan,
      entreprise,
      team: { nom: equipe.nom, couleur: equipe.couleurPrincipale, logo },
      images,
    }),
  )
  const fichier = await enregistrerFichier(ctx, {
    octets: new Uint8Array(octets),
    nomOrigine: nomFichierPdf(["bilan", entreprise, donnees.debut, donnees.fin]),
  })

  const id = newId()
  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    await tx.partenairesReport.create({
      data: {
        id,
        teamId: ctx.teamId,
        partnerId: donnees.partnerId,
        agreementId: donnees.agreementId,
        periodeDebut: instantDuJour(donnees.debut),
        periodeFin: instantDuJour(donnees.fin),
        fileId: fichier.id,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
    await rattacherFichier(tx, ctx, { fileId: fichier.id, app: "partenaires", ficheType: "report", ficheId: id, role: "document" })
  })
  return id
}

// Marque un bilan comme envoyé au partenaire, à la date du jour (Europe/Paris).
export async function marquerBilanEnvoye(reportId: string): Promise<void> {
  const { ctx } = await accesPartenaires("ecriture")
  return marquerBilanEnvoyeDans(ctx, reportId)
}

export async function marquerBilanEnvoyeDans(ctx: ContexteTeam, reportId: string): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const rapport = await client.partenairesReport.findFirst({
    where: { id: reportId, teamId: ctx.teamId, deletedAt: null },
    select: { id: true },
  })
  if (!rapport) refus("Bilan introuvable.")

  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    await tx.partenairesReport.update({
      where: { id: reportId },
      data: { envoyeLe: instantDuJour(jourParis(new Date())), rev: { increment: 1 }, updatedBy: ctx.userId },
    })
  })
}

export interface BilanListe {
  id: string
  agreementId: string | null
  periodeDebut: string
  periodeFin: string
  genereLe: string
  envoyeLe: string | null
  fileId: string | null
}

export async function lireBilansDe(partnerId: string): Promise<BilanListe[]> {
  const { ctx } = await accesPartenaires("ecriture")
  return lireBilansDeDans(ctx, partnerId)
}

export async function lireBilansDeDans(ctx: ContexteTeam, partnerId: string): Promise<BilanListe[]> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const bilans = await client.partenairesReport.findMany({
    where: { teamId: ctx.teamId, partnerId, deletedAt: null },
    orderBy: [{ periodeDebut: "desc" }, { genereLe: "desc" }],
    select: { id: true, agreementId: true, periodeDebut: true, periodeFin: true, genereLe: true, envoyeLe: true, fileId: true },
  })
  return bilans.map((b) => ({
    id: b.id,
    agreementId: b.agreementId,
    periodeDebut: jourDe(b.periodeDebut),
    periodeFin: jourDe(b.periodeFin),
    genereLe: b.genereLe.toISOString(),
    envoyeLe: b.envoyeLe ? jourDe(b.envoyeLe) : null,
    fileId: b.fileId,
  }))
}
