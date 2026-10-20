// Liaisons de Voiture avec Partenaires (brief 3.8, §2.2 et §3). Une app propose, elle n'écrit jamais chez l'autre :
// Voiture lit la contrepartie par la lecture partagée de Partenaires, puis propose ses actions (réserver, libérer).
// Il n'écrit que ses tables, par ses propres fonctions (reserverEmplacementDans, retirerLogoDans).

import { z } from "zod"

import { lireContrepartieLogoPourVoiture, lireReservationConventionDans } from "@/apps/partenaires/lectures-partagees"
import { rouvrirAction } from "@/core/actions/actions-serveur"
import type { ContexteTeam } from "@/core/contexte"
import { emettre } from "@/core/evenements/bus-serveur"
import { enregistrerGestionnaire, type EvenementRecu } from "@/core/evenements/gestionnaires"
import { ErreurMetier } from "@/core/sdk/actions-serveur"
import { prismaPourTeam } from "@/lib/prisma"

import { ErreurVoiture, refus } from "./erreurs"
import { reserverEmplacementDans, retirerLogoDans } from "./services-serveur"

const jourCivil = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const schemaConventionSignee = z.object({
  partnerId: z.string().min(1),
  partenaireNom: z.string().min(1),
  dateDebut: jourCivil,
  dateFin: jourCivil,
  contreparties: z.array(z.object({ benefitId: z.string().min(1), slotId: z.string().min(1), slotNom: z.string().nullable() })),
})

const schemaConventionTerminee = z.object({
  partnerId: z.string().min(1),
  partenaireNom: z.string().min(1),
  slotIds: z.array(z.string().min(1)),
})

const PRIORITE_LIAISON = 5
const PRIORITE_INFORMATION = 6

// --- Convention signée : réserver l'emplacement de chaque contrepartie logo (§2.2) -----------------

// Emplacement libre : une action « Réserver ». Emplacement pris ou indisponible : une action d'information, sans
// réservation. Un emplacement déjà réservé pour ce partenaire ne lève rien.
export async function proposerReservationsDans(ctx: ContexteTeam, entree: z.input<typeof schemaConventionSignee>): Promise<void> {
  const donnees = schemaConventionSignee.parse(entree)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)

  for (const contrepartie of donnees.contreparties) {
    const emplacement = await client.voitureSlot.findFirst({
      where: { id: contrepartie.slotId, teamId: ctx.teamId, deletedAt: null },
      select: { id: true, nom: true, statut: true },
    })
    // Emplacement supprimé entre-temps : Partenaires le signale à l'écoute de voiture.emplacement_modifie.
    if (!emplacement) continue

    const occupation = await client.voitureSlotAssignment.findFirst({
      where: { slotId: emplacement.id, teamId: ctx.teamId, deletedAt: null, statut: { not: "retire" } },
      select: { partenaireId: true, partenaireNom: true },
    })
    if (occupation && occupation.partenaireId === donnees.partnerId) continue

    const cleUnicite = `reserver:${contrepartie.benefitId}`
    if (occupation || emplacement.statut === "indisponible") {
      const motif = occupation ? `La ${emplacement.nom} est déjà prise par ${occupation.partenaireNom}` : `La ${emplacement.nom} est indisponible`
      await emettre(ctx, "voiture.action_requise", {
        type: "emplacement_pris",
        cleUnicite,
        titre: `${motif} : choisissez un autre emplacement dans la convention de ${donnees.partenaireNom}.`,
        contexte: "Partenaires · convention signée",
        ficheType: "contrepartie",
        ficheId: contrepartie.benefitId,
        destinataires: { roles: ["responsable", "equipage"] },
        boutons: [{ cle: "compris", libelle: "Compris" }],
        priorite: PRIORITE_INFORMATION,
        niveauRequis: "ecriture",
        cleRegroupement: "reservations_emplacements",
      })
      continue
    }

    await emettre(ctx, "voiture.action_requise", {
      type: "reserver_emplacement",
      cleUnicite,
      titre: `Réserver la ${emplacement.nom} pour ${donnees.partenaireNom} ?`,
      contexte: "Partenaires · convention signée",
      ficheType: "contrepartie",
      ficheId: contrepartie.benefitId,
      destinataires: { roles: ["responsable", "equipage"] },
      boutons: [
        { cle: "reserver", libelle: "Réserver" },
        { cle: "ignorer", libelle: "Ignorer" },
      ],
      priorite: PRIORITE_LIAISON,
      niveauRequis: "ecriture",
      cleRegroupement: "reservations_emplacements",
    })
  }
}

// --- Convention terminée ou résiliée : libérer l'emplacement (§3) ----------------------------------

// Seules les occupations de ce partenaire sont proposées à la libération. Une occupation d'un autre partenaire, ou sans
// partenaire, n'est jamais touchée.
export async function proposerLiberationsDans(ctx: ContexteTeam, entree: z.input<typeof schemaConventionTerminee>): Promise<void> {
  const donnees = schemaConventionTerminee.parse(entree)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)

  for (const slotId of donnees.slotIds) {
    const occupation = await client.voitureSlotAssignment.findFirst({
      where: { slotId, teamId: ctx.teamId, partenaireId: donnees.partnerId, deletedAt: null, statut: { not: "retire" } },
      select: { id: true, slot: { select: { nom: true } } },
    })
    if (!occupation) continue

    await emettre(ctx, "voiture.action_requise", {
      type: "liberer_emplacement",
      cleUnicite: `liberer:${occupation.id}`,
      titre: `Libérer la ${occupation.slot.nom} ? La convention de ${donnees.partenaireNom} est terminée.`,
      contexte: "Partenaires · convention terminée",
      ficheType: "occupation",
      ficheId: occupation.id,
      destinataires: { roles: ["responsable", "equipage"] },
      boutons: [
        { cle: "liberer", libelle: "Libérer" },
        { cle: "garder", libelle: "Garder" },
      ],
      priorite: PRIORITE_LIAISON,
      niveauRequis: "ecriture",
      cleRegroupement: "liberations_emplacements",
    })
  }
}

// Réservation à la main d'un partenaire de la liste (brief 3.11, §3) : elle fait la même chose que la boîte d'actions,
// avec les dates et le logo de sa convention signée ou en cours pour cet emplacement.
export async function reserverPourPartenaireDans(ctx: ContexteTeam, slotId: string, partenaireId: string): Promise<string> {
  const convention = await lireReservationConventionDans(ctx, partenaireId, slotId)
  if (!convention) refus("Ce partenaire n'a pas de convention signée ou en cours pour cet emplacement.")
  return reserverEmplacementDans(
    ctx,
    slotId,
    { partenaireId, partenaireNom: convention.partenaireNom, du: convention.dateDebut, au: convention.dateFin, logoFileId: convention.logoFileId },
    convention.logoFileId ? { logoSource: { app: "partenaires", ficheType: "partner", ficheId: partenaireId } } : {},
  )
}

// --- Décisions de la boîte d'actions, pour les actions de Voiture -------------------------------------

async function reserverDepuisContrepartie(ctx: ContexteTeam, benefitId: string): Promise<void> {
  const contrepartie = await lireContrepartieLogoPourVoiture(ctx, benefitId)
  if (!contrepartie) throw new ErreurVoiture("Cette contrepartie n'existe plus, ou sa convention n'est plus en cours.")
  await reserverEmplacementDans(
    ctx,
    contrepartie.slotId,
    {
      partenaireId: contrepartie.partenaireId,
      partenaireNom: contrepartie.partenaireNom,
      du: contrepartie.dateDebut,
      au: contrepartie.dateFin,
      logoFileId: contrepartie.logoFileId,
    },
    contrepartie.logoFileId ? { logoSource: { app: "partenaires", ficheType: "partner", ficheId: contrepartie.partenaireId } } : {},
  )
}

// Un refus métier remet l'action en attente, avec son motif (même règle que Budget et Saison).
async function appliquerDecisionVoiture(ctx: ContexteTeam, evenement: EvenementRecu): Promise<void> {
  const donnees = evenement.donnees as { type?: string; decision?: string; cleUnicite?: string; ficheId?: string }
  if (!donnees.ficheId) return
  try {
    if (donnees.type === "reserver_emplacement" && donnees.decision === "reserver") await reserverDepuisContrepartie(ctx, donnees.ficheId)
    if (donnees.type === "liberer_emplacement" && donnees.decision === "liberer") await retirerLogoDans(ctx, donnees.ficheId)
  } catch (erreur) {
    if (!(erreur instanceof ErreurMetier)) throw erreur
    await rouvrirAction(prismaPourTeam(ctx.teamId, ctx.userId), ctx, donnees.cleUnicite, erreur.message)
  }
}

// Enregistrés à l'import du module : Voiture reçoit la convention signée, la fin de convention et les décisions.
enregistrerGestionnaire("voiture", "partenaires.convention_signee", async (ctx: ContexteTeam, evenement: EvenementRecu) => {
  const analyse = schemaConventionSignee.safeParse(evenement.donnees)
  if (!analyse.success) return
  await proposerReservationsDans(ctx, analyse.data)
})

enregistrerGestionnaire("voiture", "partenaires.convention_terminee", async (ctx: ContexteTeam, evenement: EvenementRecu) => {
  const analyse = schemaConventionTerminee.safeParse(evenement.donnees)
  if (!analyse.success) return
  await proposerLiberationsDans(ctx, analyse.data)
})

enregistrerGestionnaire("voiture", "core.action_decidee", appliquerDecisionVoiture)
