// Génération du PDF de la convention (brief 3.6, §5). Le texte vient de genererDocumentDans ; le PDF passe par
// DocumentTeam (3.1b), est enregistré comme fichier de la team, rattaché à la convention (rôle « document ») et
// devient document_genere_file_id. Une nouvelle génération remplace la précédente (son fichier est retiré de la fiche).
import { createElement } from "react"

import { enregistrerFichier, rattacherFichier, remplacerFichier } from "@/core/fichiers/fichiers-serveur"
import { nomFichierPdf } from "@/core/pdf/nom-fichier"
import { lireLogoPourPdf } from "@/core/pdf/logo-serveur"
import { rendrePdf } from "@/core/pdf/rendu-serveur"
import type { ContexteTeam } from "@/core/contexte"
import { executerPourTeam, prismaPourTeam } from "@/lib/prisma"

import { ConventionPdf } from "./pdf/convention-pdf"
import { refus } from "./erreurs"
import { accesPartenaires, genererDocumentDans } from "./services-serveur"

export async function genererDocumentPdf(agreementId: string): Promise<string> {
  const { ctx } = await accesPartenaires("ecriture")
  return genererDocumentPdfDans(ctx, agreementId)
}

export async function genererDocumentPdfDans(ctx: ContexteTeam, agreementId: string): Promise<string> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const convention = await client.partenairesAgreement.findFirst({
    where: { id: agreementId, teamId: ctx.teamId, deletedAt: null },
    select: { documentGenereFileId: true, seasonId: true, partner: { select: { contact: { select: { nom: true } } } } },
  })
  if (!convention) refus("Convention introuvable.")

  // Les refus de genererDocumentDans (pas de modèle, par exemple) remontent tels quels.
  const { texte } = await genererDocumentDans(ctx, agreementId)
  const equipe = await client.coreTeam.findFirst({ where: { id: ctx.teamId }, select: { nom: true, couleurPrincipale: true } })
  if (!equipe) refus("Team introuvable.")
  const saison = convention.seasonId
    ? await client.coreSeason.findFirst({ where: { id: convention.seasonId, teamId: ctx.teamId, deletedAt: null }, select: { nom: true } })
    : null
  const partenaire = convention.partner.contact.nom
  const logo = await lireLogoPourPdf(ctx.teamId, ctx.userId)

  const octets = await rendrePdf(
    createElement(ConventionPdf, {
      texte,
      sousTitre: [partenaire, saison?.nom].filter(Boolean).join(" · "),
      team: { nom: equipe.nom, couleur: equipe.couleurPrincipale, logo },
    }),
  )
  const fichier = await enregistrerFichier(ctx, {
    octets: new Uint8Array(octets),
    nomOrigine: nomFichierPdf(["convention", partenaire, saison?.nom ?? ""]),
  })

  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    await rattacherFichier(tx, ctx, { fileId: fichier.id, app: "partenaires", ficheType: "agreement", ficheId: agreementId, role: "document" })
    await tx.partenairesAgreement.update({
      where: { id: agreementId },
      data: { documentGenereFileId: fichier.id, rev: { increment: 1 }, updatedBy: ctx.userId },
    })
    await remplacerFichier(tx, ctx, { ancienId: convention.documentGenereFileId, nouveauId: fichier.id })
  })
  return fichier.id
}
