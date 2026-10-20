// Données de la page partenaire (brief 3.7, §3). Serveur seulement. Tout passe par avecContextePublic : une seule
// team, sans utilisateur, et chaque lecture filtre par le partenaire du lien.
//
// Ce que la page ne montre jamais, et que ce fichier ne lit donc pas :
//   - les autres partenaires ;
//   - le budget de la team, sous quelque forme que ce soit ;
//   - les échanges et les notes internes (interactions, notes de suivi) ;
//   - les preuves masquées (visiblePartenaire = false) ;
//   - les brouillons et les conventions envoyées (seules signée, en cours, terminée, résiliée passent) ;
//   - les membres, en dehors des signataires écrits dans la convention ;
//   - le statut de prospection du partenaire ;
//   - les résultats masqués par la team (public = false) ou non validés ;
//   - pour une épreuve : ni engagement, ni montant, ni membre, ni note, ni débrief.
import "server-only"

import { listerCalendrierPourPartenaires, listerResultatsPublicsPourPartenaires } from "@/apps/saison/lectures-partagees"
import { avecContextePublic } from "@/lib/prisma"

import {
  dateFrancaise,
  LIBELLES_STATUT_CONTREPARTIE,
  LIBELLES_STATUT_CONVENTION,
  LIBELLES_STATUT_RESULTAT,
  LIBELLES_TYPE_PREUVE,
} from "./affichage"
import type { LienPublic } from "./lien-public"
import { enRetard, formaterMontant, jourParis, STATUTS_CONVENTION_VISIBLES, statutContrepartie } from "./regles"

export interface ConventionAffichee {
  id: string
  saison: string | null
  dateDebut: string
  dateFin: string
  statut: string
  apport: string
  apportNature: string | null
  // Le PDF de la convention signée : le lien « Télécharger » n'apparaît que s'il existe.
  documentSigneFileId: string | null
}

export interface ContrepartieAffichee {
  id: string
  conventionId: string
  libelle: string
  quantitePromise: number
  quantiteTenue: number
  statut: string
  echeance: string | null
}

export interface PreuveAffichee {
  id: string
  date: string
  type: string
  epreuve: string | null
  fileId: string | null
  estImage: boolean
  lien: string | null
  commentaire: string | null
}

export interface EpreuveAffichee {
  nom: string
  dateDebut: string
  dateFin: string
  lieu: string | null
  saison: string
}

export interface ResultatAffiche {
  epreuve: string
  date: string
  statut: string
  classementGeneral: number | null
  nbClasses: number | null
  classementClasse: number | null
  nbPartantsClasse: number | null
}

export interface BilanAffiche {
  id: string
  periodeDebut: string
  periodeFin: string
  fileId: string | null
  genereLe: string
}

export interface PagePartenaire {
  team: { nom: string; couleurPrincipale: string | null; couleurSecondaire: string | null; logoFileId: string | null }
  partenaire: { entreprise: string; logoFileId: string | null }
  // Chaque liste reste vide quand sa section n'est pas cochée dans le lien.
  conventions: ConventionAffichee[]
  contreparties: ContrepartieAffichee[]
  preuves: PreuveAffichee[]
  calendrier: EpreuveAffichee[]
  resultats: ResultatAffiche[]
  bilans: BilanAffiche[]
}

// Date civile (colonne @db.Date) en AAAA-MM-JJ, sans décalage de fuseau.
function jourDe(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function estSection(lien: LienPublic, section: string): boolean {
  return lien.sections.includes(section)
}

export async function lirePagePartenaire(lien: LienPublic): Promise<PagePartenaire | null> {
  const aujourdhui = jourParis(new Date())
  return avecContextePublic(lien.teamId, async (tx) => {
    const team = await tx.coreTeam.findFirst({
      where: { id: lien.teamId, deletedAt: null },
      select: { nom: true, couleurPrincipale: true, couleurSecondaire: true, logoFileId: true },
    })
    const partenaire = await tx.partenairesPartner.findFirst({
      where: { id: lien.partnerId, teamId: lien.teamId, deletedAt: null },
      select: { logoFileId: true, contact: { select: { nom: true } } },
    })
    if (!team || !partenaire) return null

    // Les conventions affichées : celles de ce partenaire, dans les statuts publics.
    const conventionsBrutes = await tx.partenairesAgreement.findMany({
      where: { teamId: lien.teamId, partnerId: lien.partnerId, deletedAt: null, statut: { in: [...STATUTS_CONVENTION_VISIBLES] } },
      orderBy: { dateDebut: "desc" },
      select: {
        id: true,
        seasonId: true,
        dateDebut: true,
        dateFin: true,
        statut: true,
        apportFinancierCentimes: true,
        apportNatureDescription: true,
        documentSigneFileId: true,
        season: { select: { nom: true } },
      },
    })
    const idsConventions = conventionsBrutes.map((c) => c.id)
    const saisonIds = conventionsBrutes.map((c) => c.seasonId).filter((id): id is string => id !== null)

    // Les contreparties et les preuves ne se lisent que sur ces conventions.
    const contrepartiesBrutes = idsConventions.length
      ? await tx.partenairesBenefit.findMany({
          where: { teamId: lien.teamId, agreementId: { in: idsConventions }, deletedAt: null },
          orderBy: [{ echeance: "asc" }],
          select: { id: true, agreementId: true, libelle: true, quantitePromise: true, quantiteTenue: true, statut: true, echeance: true },
        })
      : []
    const preuvesBrutes =
      estSection(lien, "preuves") && contrepartiesBrutes.length
        ? await tx.partenairesProof.findMany({
            where: {
              teamId: lien.teamId,
              benefitId: { in: contrepartiesBrutes.map((c) => c.id) },
              visiblePartenaire: true,
              deletedAt: null,
            },
            orderBy: { date: "desc" },
            select: {
              id: true,
              date: true,
              type: true,
              lien: true,
              commentaire: true,
              fileId: true,
              event: { select: { nom: true } },
              file: { select: { mimeType: true } },
            },
          })
        : []

    const bilansBruts = estSection(lien, "bilans")
      ? await tx.partenairesReport.findMany({
          where: { teamId: lien.teamId, partnerId: lien.partnerId, deletedAt: null },
          orderBy: { periodeDebut: "desc" },
          select: { id: true, periodeDebut: true, periodeFin: true, fileId: true, genereLe: true },
        })
      : []

    const calendrierBrut = estSection(lien, "calendrier")
      ? await listerCalendrierPourPartenaires(tx, lien.teamId, saisonIds)
      : []
    const resultatsBruts = estSection(lien, "resultats")
      ? await listerResultatsPublicsPourPartenaires(tx, lien.teamId, saisonIds)
      : []

    return {
      team: { nom: team.nom, couleurPrincipale: team.couleurPrincipale, couleurSecondaire: team.couleurSecondaire, logoFileId: team.logoFileId },
      partenaire: { entreprise: partenaire.contact.nom, logoFileId: partenaire.logoFileId },
      conventions: estSection(lien, "conventions")
        ? conventionsBrutes.map((c) => ({
            id: c.id,
            saison: c.season?.nom ?? null,
            dateDebut: dateFrancaise(jourDe(c.dateDebut)),
            dateFin: dateFrancaise(jourDe(c.dateFin)),
            statut: LIBELLES_STATUT_CONVENTION[c.statut] ?? c.statut,
            apport: formaterMontant(c.apportFinancierCentimes),
            apportNature: c.apportNatureDescription,
            documentSigneFileId: c.documentSigneFileId,
          }))
        : [],
      contreparties: estSection(lien, "contreparties")
        ? contrepartiesBrutes.map((c) => {
            const echeance = c.echeance ? jourDe(c.echeance) : null
            const base = { statut: c.statut, quantitePromise: c.quantitePromise, quantiteTenue: c.quantiteTenue, echeance }
            const statut = enRetard(base, aujourdhui) ? "en_retard" : statutContrepartie(base)
            return {
              id: c.id,
              conventionId: c.agreementId,
              libelle: c.libelle,
              quantitePromise: c.quantitePromise,
              quantiteTenue: c.quantiteTenue,
              statut: LIBELLES_STATUT_CONTREPARTIE[statut] ?? statut,
              echeance: echeance ? dateFrancaise(echeance) : null,
            }
          })
        : [],
      preuves: preuvesBrutes.map((p) => ({
        id: p.id,
        date: dateFrancaise(jourDe(p.date)),
        type: LIBELLES_TYPE_PREUVE[p.type] ?? p.type,
        epreuve: p.event?.nom ?? null,
        fileId: p.fileId,
        estImage: p.file?.mimeType === "image/jpeg" || p.file?.mimeType === "image/png",
        lien: p.lien,
        commentaire: p.commentaire,
      })),
      calendrier: calendrierBrut.map((e) => ({
        nom: e.nom,
        dateDebut: dateFrancaise(jourDe(e.dateDebut)),
        dateFin: dateFrancaise(jourDe(e.dateFin)),
        lieu: e.lieu,
        saison: e.saison,
      })),
      resultats: resultatsBruts.map((r) => ({
        epreuve: r.epreuve,
        date: dateFrancaise(jourDe(r.dateDebut)),
        statut: LIBELLES_STATUT_RESULTAT[r.statutFinal] ?? r.statutFinal,
        classementGeneral: r.classementGeneral,
        nbClasses: r.nbClasses,
        classementClasse: r.classementClasse,
        nbPartantsClasse: r.nbPartantsClasse,
      })),
      bilans: bilansBruts.map((b) => ({
        id: b.id,
        periodeDebut: dateFrancaise(jourDe(b.periodeDebut)),
        periodeFin: dateFrancaise(jourDe(b.periodeFin)),
        fileId: b.fileId,
        genereLe: dateFrancaise(jourParis(b.genereLe)),
      })),
    }
  })
}

// Consultations (brief 3.7, §2) : la date du dernier affichage prend l'instant présent à chaque fois. Le compte
// monte d'un seul, au plus une fois toutes les 30 minutes : un rechargement ne le gonfle pas.
export async function enregistrerConsultation(lien: LienPublic): Promise<void> {
  const maintenant = new Date()
  const seuil = new Date(maintenant.getTime() - 30 * 60_000)
  await avecContextePublic(lien.teamId, async (tx) => {
    const compte = await tx.partenairesPortalLink.updateMany({
      where: { id: lien.lienId, OR: [{ derniereConsultation: null }, { derniereConsultation: { lt: seuil } }] },
      data: { nbConsultations: { increment: 1 }, derniereConsultation: maintenant },
    })
    if (compte.count === 0) {
      await tx.partenairesPortalLink.updateMany({ where: { id: lien.lienId }, data: { derniereConsultation: maintenant } })
    }
  })
}

export interface FichierPublic {
  storageKey: string
  nom: string
  mimeType: string
  taille: number
}

// Un fichier n'est servi que s'il est l'un de ceux de la page du lien (brief 3.7, §4) : le logo de la team, le logo
// du partenaire, le document signé d'une de ses conventions affichées, le fichier d'une de ses preuves visibles, ou
// un de ses bilans. Un identifiant de fichier d'un autre partenaire, d'une autre team, ou d'une preuve masquée
// donne null, comme un fichier absent.
export async function lireFichierDuLien(lien: LienPublic, fichierId: string): Promise<FichierPublic | null> {
  return avecContextePublic(lien.teamId, async (tx) => {
    const fichier = await tx.coreFile.findFirst({
      where: { id: fichierId, teamId: lien.teamId, deletedAt: null },
      select: { storageKey: true, nom: true, mimeType: true, taille: true },
    })
    if (!fichier) return null

    const logoTeam = await tx.coreTeam.findFirst({ where: { id: lien.teamId, logoFileId: fichierId }, select: { id: true } })
    const logoPartenaire = await tx.partenairesPartner.findFirst({
      where: { id: lien.partnerId, teamId: lien.teamId, logoFileId: fichierId, deletedAt: null },
      select: { id: true },
    })
    // Le document signé ne sort que si la section « conventions » est cochée, comme les preuves et les bilans.
    const conventionSignee = estSection(lien, "conventions")
      ? await tx.partenairesAgreement.findFirst({
          where: { teamId: lien.teamId, partnerId: lien.partnerId, deletedAt: null, statut: { in: [...STATUTS_CONVENTION_VISIBLES] }, documentSigneFileId: fichierId },
          select: { id: true },
        })
      : null
    const preuve = estSection(lien, "preuves")
      ? await tx.partenairesProof.findFirst({
          where: {
            teamId: lien.teamId,
            fileId: fichierId,
            visiblePartenaire: true,
            deletedAt: null,
            benefit: { deletedAt: null, agreement: { partnerId: lien.partnerId, deletedAt: null, statut: { in: [...STATUTS_CONVENTION_VISIBLES] } } },
          },
          select: { id: true },
        })
      : null
    const bilan = estSection(lien, "bilans")
      ? await tx.partenairesReport.findFirst({
          where: { teamId: lien.teamId, partnerId: lien.partnerId, fileId: fichierId, deletedAt: null },
          select: { id: true },
        })
      : null

    const permis = logoTeam || logoPartenaire || conventionSignee || preuve || bilan
    return permis ? { storageKey: fichier.storageKey, nom: fichier.nom, mimeType: fichier.mimeType, taille: fichier.taille } : null
  })
}
