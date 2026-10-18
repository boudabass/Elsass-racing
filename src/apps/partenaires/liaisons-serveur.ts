// Liaisons de Partenaires avec les autres apps (brief 3.8, §4 à §7). Une app propose, elle n'écrit jamais chez l'autre :
// Partenaires lit Voiture et Budget par leurs lectures partagées, écrit ses propres tables, et lève ses actions.

import { z } from "zod"

import { etatRecettesParOrigine } from "@/apps/budget/liaisons-serveur"
import { listerEmplacementsPourPartenaires, lireOccupationPourPartenaires } from "@/apps/voiture/lectures-partagees"
import { rouvrirAction } from "@/core/actions/actions-serveur"
import type { ContexteTeam } from "@/core/contexte"
import { emettre } from "@/core/evenements/bus-serveur"
import { enregistrerGestionnaire, type EvenementRecu } from "@/core/evenements/gestionnaires"
import { ErreurMetier } from "@/core/sdk/actions-serveur"
import { executerPourTeam, prismaPourTeam } from "@/lib/prisma"

import { ErreurPartenaires } from "./erreurs"
import { apportRecuDe } from "./regles"
import { ajouterPreuvePoseDans, destinatairesDeSuiviDans, saisirAvancementDans } from "./services-serveur"

const identifiant = z.string().min(1)
const jourCivil = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const STATUTS_EN_COURS = ["signee", "en_cours"] as const
const PRIORITE_ACTION = 5
const PRIORITE_INFORMATION = 6

// --- Logo posé : ajouter la preuve (§4) ---------------------------------------------------------------

const schemaLogoPose = z.object({
  slotId: identifiant,
  assignmentId: identifiant,
  partenaireId: identifiant.nullable(),
  poseLe: jourCivil,
  photoFileId: identifiant.nullable(),
})

// Sans partenaire (occupation saisie à la main), ou sans contrepartie logo sur une convention en cours : rien.
export async function proposerPreuvePoseDans(ctx: ContexteTeam, entree: z.input<typeof schemaLogoPose>): Promise<void> {
  const donnees = schemaLogoPose.parse(entree)
  if (!donnees.partenaireId) return
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const contrepartie = await client.partenairesBenefit.findFirst({
    where: {
      teamId: ctx.teamId,
      deletedAt: null,
      type: "logo_voiture",
      slotId: donnees.slotId,
      agreement: { partnerId: donnees.partenaireId, statut: { in: [...STATUTS_EN_COURS] }, deletedAt: null },
    },
    select: { id: true, statut: true, agreement: { select: { partner: { select: { suiviParPersonId: true, contact: { select: { nom: true } } } } } } },
  })
  if (!contrepartie || contrepartie.statut === "tenue") return

  const partenaire = contrepartie.agreement.partner
  const nom = partenaire.contact.nom
  const avecPhoto = donnees.photoFileId !== null
  await emettre(ctx, "partenaires.action_requise", {
    type: "preuve_pose",
    cleUnicite: `preuve_pose:${donnees.assignmentId}`,
    titre: avecPhoto ? `Ajouter la photo de pose comme preuve pour ${nom} ?` : `Marquer le logo de ${nom} comme posé ?`,
    contexte: "Voiture · logo posé",
    ficheType: "contrepartie",
    ficheId: contrepartie.id,
    destinataires: { memberships: await destinatairesDeSuiviDans(client, ctx, partenaire.suiviParPersonId) },
    boutons: avecPhoto
      ? [
          { cle: "ajouter", libelle: "Ajouter" },
          { cle: "ignorer", libelle: "Ignorer" },
        ]
      : [
          { cle: "marquer", libelle: "Marquer" },
          { cle: "ignorer", libelle: "Ignorer" },
        ],
    priorite: PRIORITE_ACTION,
    niveauRequis: "ecriture",
    cleRegroupement: "preuves_a_ajouter",
  })
}

// « Ajouter » : la photo devient une preuve, puis la contrepartie passe à tenue (quantité promise). « Marquer » : sans
// photo, la contrepartie passe à tenue seule. La décision se relit sur l'occupation, pas sur le message de l'événement.
async function appliquerPreuvePose(ctx: ContexteTeam, benefitId: string, decision: string, cleUnicite: string | undefined): Promise<void> {
  const assignmentId = cleUnicite?.replace("preuve_pose:", "")
  if (!assignmentId) throw new ErreurPartenaires("Action de pose sans occupation.")
  const occupation = await lireOccupationPourPartenaires(ctx, assignmentId)
  if (!occupation) throw new ErreurPartenaires("L'occupation de ce logo n'existe plus.")

  const contrepartie = await prismaPourTeam(ctx.teamId, ctx.userId).partenairesBenefit.findFirst({
    where: { id: benefitId, teamId: ctx.teamId, deletedAt: null },
    select: { quantitePromise: true },
  })
  if (!contrepartie) throw new ErreurPartenaires("Contrepartie introuvable.")

  if (decision === "ajouter" && occupation.photoPoseFileId && occupation.poseLe) {
    await ajouterPreuvePoseDans(ctx, benefitId, {
      poseLe: occupation.poseLe,
      fileId: occupation.photoPoseFileId,
      source: { app: "voiture", ficheType: "slot_assignment", ficheId: occupation.id },
    })
  }
  await saisirAvancementDans(ctx, benefitId, contrepartie.quantitePromise)
}

// --- Emplacement modifié (§5) -------------------------------------------------------------------------

const schemaEmplacementModifie = z.object({ vehicleId: identifiant, slotId: identifiant.optional() })

// Nom d'emplacement à jour pour chaque contrepartie qui le désigne. Emplacement supprimé : le lien est vidé, le nom
// garde « (supprimé) », et le suivi est prévenu.
export async function suivreEmplacementModifieDans(ctx: ContexteTeam, entree: z.input<typeof schemaEmplacementModifie>): Promise<void> {
  const donnees = schemaEmplacementModifie.parse(entree)
  if (!donnees.slotId) return
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const emplacement = (await listerEmplacementsPourPartenaires(ctx)).find((e) => e.id === donnees.slotId)
  const contreparties = await client.partenairesBenefit.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, type: "logo_voiture", slotId: donnees.slotId },
    select: {
      id: true,
      slotNom: true,
      agreement: { select: { partner: { select: { suiviParPersonId: true, contact: { select: { nom: true } } } } } },
    },
  })

  for (const contrepartie of contreparties) {
    if (emplacement) {
      if (contrepartie.slotNom === emplacement.nom) continue
      await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
        tx.partenairesBenefit.update({ where: { id: contrepartie.id }, data: { slotNom: emplacement.nom, rev: { increment: 1 }, updatedBy: ctx.userId } }),
      )
      continue
    }

    const ancienNom = contrepartie.slotNom ?? "emplacement"
    const nomSupprime = ancienNom.endsWith(" (supprimé)") ? ancienNom : `${ancienNom} (supprimé)`
    await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
      tx.partenairesBenefit.update({
        where: { id: contrepartie.id },
        data: { slotId: null, slotNom: nomSupprime, rev: { increment: 1 }, updatedBy: ctx.userId },
      }),
    )
    const partenaire = contrepartie.agreement.partner
    await emettre(ctx, "partenaires.action_requise", {
      type: "emplacement_supprime",
      cleUnicite: `emplacement_supprime:${contrepartie.id}`,
      titre: `L'emplacement ${ancienNom} de ${partenaire.contact.nom} a été supprimé : choisissez-en un autre.`,
      contexte: "Voiture · emplacement supprimé",
      ficheType: "contrepartie",
      ficheId: contrepartie.id,
      destinataires: { memberships: await destinatairesDeSuiviDans(client, ctx, partenaire.suiviParPersonId) },
      boutons: [{ cle: "compris", libelle: "Compris" }],
      priorite: PRIORITE_INFORMATION,
      niveauRequis: "ecriture",
      cleRegroupement: "emplacements_supprimes",
    })
  }
}

// --- Épreuve terminée : les publications promises (§6) -----------------------------------------------

const schemaEpreuveTerminee = z.object({ eventId: identifiant })

// Une action par épreuve et par personne qui suit un partenaire concerné. Sans suivi, pas d'action : le partenaire
// reste visible dans sa fiche. « Fait » ferme l'action sans rien marquer ; « Plus tard » la reporte (voir plus bas).
export async function proposerPublicationsDans(ctx: ContexteTeam, entree: z.input<typeof schemaEpreuveTerminee>): Promise<void> {
  const donnees = schemaEpreuveTerminee.parse(entree)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const contreparties = await client.partenairesBenefit.findMany({
    where: {
      teamId: ctx.teamId,
      deletedAt: null,
      type: { in: ["publication_reseaux", "story"] },
      statut: { not: "tenue" },
      eventIds: { has: donnees.eventId },
      agreement: { statut: { in: [...STATUTS_EN_COURS] }, deletedAt: null },
    },
    select: {
      quantitePromise: true,
      quantiteTenue: true,
      agreement: { select: { partner: { select: { id: true, suiviParPersonId: true, contact: { select: { nom: true } } } } } },
    },
  })

  // Par personne qui suit : ses partenaires concernés, avec ce qui reste à publier pour chacun.
  const parPersonne = new Map<string, Map<string, { nom: string; reste: number }>>()
  for (const contrepartie of contreparties) {
    const partenaire = contrepartie.agreement.partner
    const reste = contrepartie.quantitePromise - contrepartie.quantiteTenue
    if (!partenaire.suiviParPersonId || reste <= 0) continue
    const partenaires = parPersonne.get(partenaire.suiviParPersonId) ?? new Map<string, { nom: string; reste: number }>()
    const ligne = partenaires.get(partenaire.id) ?? { nom: partenaire.contact.nom, reste: 0 }
    ligne.reste += reste
    partenaires.set(partenaire.id, ligne)
    parPersonne.set(partenaire.suiviParPersonId, partenaires)
  }
  if (parPersonne.size === 0) return

  const epreuve = await client.coreEvent.findFirst({ where: { id: donnees.eventId, teamId: ctx.teamId, deletedAt: null }, select: { nom: true } })
  const nomEpreuve = epreuve?.nom ?? "l'épreuve"
  for (const [personneId, partenaires] of Array.from(parPersonne)) {
    const adhesion = await client.coreMembership.findFirst({
      where: { teamId: ctx.teamId, personId: personneId, statut: "actif", deletedAt: null },
      select: { id: true },
    })
    if (!adhesion) continue
    const lignes = Array.from(partenaires.values()).map((ligne) => `${ligne.nom} (${ligne.reste})`).join(", ")
    await emettre(ctx, "partenaires.action_requise", {
      type: "publications_promises",
      cleUnicite: `publications:${donnees.eventId}:${personneId}`,
      titre: `Publications promises après ${nomEpreuve} : ${lignes}.`,
      contexte: "Partenaires · épreuve terminée",
      ficheType: "epreuve",
      ficheId: donnees.eventId,
      eventId: donnees.eventId,
      destinataires: { memberships: [adhesion.id] },
      boutons: [
        { cle: "fait", libelle: "Fait" },
        { cle: "plus_tard", libelle: "Plus tard" },
      ],
      priorite: PRIORITE_INFORMATION,
      niveauRequis: "ecriture",
      cleRegroupement: "publications_promises",
    })
  }
}

// « Plus tard » : l'action revient dans trois jours. La décision est déjà enregistrée par la boîte d'actions ; on la
// rouvre avec une date de report.
const DELAI_PLUS_TARD_JOURS = 3

async function reporterPublications(ctx: ContexteTeam, cleUnicite: string | undefined): Promise<void> {
  if (!cleUnicite) return
  const jusquAu = new Date(Date.now() + DELAI_PLUS_TARD_JOURS * 24 * 60 * 60 * 1000)
  await prismaPourTeam(ctx.teamId, ctx.userId).coreAction.updateMany({
    where: { teamId: ctx.teamId, cleUnicite, appOrigine: "partenaires" },
    data: { statut: "en_attente", decision: null, decideeParMembershipId: null, decideeAt: null, reporteeJusquAu: jusquAu, updatedBy: ctx.userId },
  })
}

// --- Apport reçu (§7) ---------------------------------------------------------------------------------

// Recette encaissée d'une convention : l'apport reçu se recalcule sur toutes les recettes de la convention.
export async function recalculerApportRecuDans(ctx: ContexteTeam, origineRef: string): Promise<void> {
  const agreementId = origineRef.split(":")[1]
  if (!agreementId) return
  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    const convention = await tx.partenairesAgreement.findFirst({
      where: { id: agreementId, teamId: ctx.teamId, deletedAt: null },
      select: { apportRecu: true, apportFinancierCentimes: true },
    })
    if (!convention) return
    const { encaisseCentimes } = await etatRecettesParOrigine(tx, ctx.teamId, `partenaires:${agreementId}:`)
    const apportRecu = apportRecuDe({ attenduCentimes: convention.apportFinancierCentimes, encaisseCentimes })
    if (apportRecu === convention.apportRecu) return
    await tx.partenairesAgreement.update({ where: { id: agreementId }, data: { apportRecu, rev: { increment: 1 }, updatedBy: ctx.userId } })
  })
}

// --- Décisions de la boîte d'actions, pour les actions de Partenaires -----------------------------------

async function appliquerDecisionPartenaires(ctx: ContexteTeam, evenement: EvenementRecu): Promise<void> {
  const donnees = evenement.donnees as { type?: string; decision?: string; cleUnicite?: string; ficheId?: string }
  try {
    if (donnees.type === "preuve_pose" && donnees.ficheId && (donnees.decision === "ajouter" || donnees.decision === "marquer")) {
      await appliquerPreuvePose(ctx, donnees.ficheId, donnees.decision, donnees.cleUnicite)
    }
    if (donnees.type === "publications_promises" && donnees.decision === "plus_tard") {
      await reporterPublications(ctx, donnees.cleUnicite)
    }
  } catch (erreur) {
    if (!(erreur instanceof ErreurMetier)) throw erreur
    await rouvrirAction(prismaPourTeam(ctx.teamId, ctx.userId), ctx, donnees.cleUnicite, erreur.message)
  }
}

// Enregistrés à l'import du module : Partenaires reçoit la pose, le déplacement d'emplacement, l'épreuve, la recette
// encaissée et les décisions de ses actions.
enregistrerGestionnaire("partenaires", "voiture.logo_pose", async (ctx: ContexteTeam, evenement: EvenementRecu) => {
  const analyse = schemaLogoPose.safeParse(evenement.donnees)
  if (!analyse.success) return
  await proposerPreuvePoseDans(ctx, analyse.data)
})

enregistrerGestionnaire("partenaires", "voiture.emplacement_modifie", async (ctx: ContexteTeam, evenement: EvenementRecu) => {
  const analyse = schemaEmplacementModifie.safeParse(evenement.donnees)
  if (!analyse.success) return
  await suivreEmplacementModifieDans(ctx, analyse.data)
})

enregistrerGestionnaire("partenaires", "saison.epreuve_terminee", async (ctx: ContexteTeam, evenement: EvenementRecu) => {
  const analyse = schemaEpreuveTerminee.safeParse(evenement.donnees)
  if (!analyse.success) return
  await proposerPublicationsDans(ctx, analyse.data)
})

enregistrerGestionnaire("partenaires", "budget.recette_encaissee", async (ctx: ContexteTeam, evenement: EvenementRecu) => {
  const origineRef = (evenement.donnees as { origineRef?: string | null }).origineRef
  if (!origineRef?.startsWith("partenaires:")) return
  await recalculerApportRecuDans(ctx, origineRef)
})

enregistrerGestionnaire("partenaires", "core.action_decidee", appliquerDecisionPartenaires)
