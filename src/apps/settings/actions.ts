"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { exigerAcces } from "@/core/droits/garde-serveur"
import { ErreurAcces, libelleErreurAcces } from "@/core/droits/erreurs"
import { prismaPourTeam } from "@/lib/prisma"
import { newId } from "@/core/ids"
import { emettre } from "@/core/evenements/bus-serveur"
import type { ContexteTeam } from "@/core/contexte"
import { annulerInvitation, creerInvitation, renvoyerInvitation } from "@/core/invitations/invitations-serveur"
import { schemaEmail } from "@/core/auth/jetons"

import { peutChangerAcces } from "./regles"

const RUBRIQUE = "/apps/settings"
const ROLES = ["responsable", "equipage", "assistance", "invite"] as const
const DISCIPLINES = ["rallye", "slalom", "course_de_cote", "circuit", "autre"] as const
const FUSEAUX = ["Europe/Paris", "Europe/Berlin", "Europe/Brussels", "Europe/Madrid", "Europe/Rome", "Europe/London"] as const
const HEX = /^#[0-9A-Fa-f]{6}$/
const RNA = /^W\d{9}$/

// Toute action de Réglages passe par la garde. Une erreur revient à la rubrique, en clair.
function retour(rubrique: string, erreur?: string): never {
  const base = `${RUBRIQUE}/${rubrique}`
  redirect(erreur ? `${base}?erreur=${encodeURIComponent(erreur)}` : `${base}?ok=1`)
}

async function ctxGestion(): Promise<{ ctx: ContexteTeam; nomTeam: string }> {
  const { session, team, membership } = await exigerAcces("settings", "gestion")
  return {
    ctx: { teamId: team.id, userId: session.userId, membership: { id: membership.id, role: membership.role } },
    nomTeam: team.nom,
  }
}

function texte(formData: FormData, cle: string): string {
  return String(formData.get(cle) ?? "").trim()
}

function messageErreur(erreur: unknown): string {
  if (erreur instanceof ErreurAcces) return libelleErreurAcces(erreur)
  return erreur instanceof Error ? erreur.message : "L'enregistrement n'a pas pu être fait."
}

export async function sauverIdentite(formData: FormData): Promise<void> {
  let erreur: string | undefined
  try {
    const { ctx } = await ctxGestion()
    const nom = texte(formData, "nom")
    const principale = texte(formData, "couleurPrincipale")
    const secondaire = texte(formData, "couleurSecondaire")
    const discipline = texte(formData, "discipline")
    const fuseau = texte(formData, "fuseau")

    if (nom.length < 1 || nom.length > 80) throw new Error("Le nom de la team doit faire entre 1 et 80 caractères.")
    if (!HEX.test(principale) || !HEX.test(secondaire)) throw new Error("Les couleurs doivent être au format #RRGGBB.")
    if (!(DISCIPLINES as readonly string[]).includes(discipline)) throw new Error("Discipline inconnue.")
    if (!(FUSEAUX as readonly string[]).includes(fuseau)) throw new Error("Fuseau inconnu.")

    await prismaPourTeam(ctx.teamId, ctx.userId).coreTeam.update({
      where: { id: ctx.teamId },
      data: {
        nom,
        couleurPrincipale: principale.toUpperCase(),
        couleurSecondaire: secondaire.toUpperCase(),
        disciplinePrincipale: discipline,
        fuseau,
      },
    })
    await emettre(ctx, "settings.identite_modifiee", { rubrique: "identite" })
  } catch (cause) {
    erreur = messageErreur(cause)
  }
  revalidatePath(RUBRIQUE, "layout")
  retour("identite", erreur)
}

export async function sauverAssociation(formData: FormData): Promise<void> {
  let erreur: string | undefined
  try {
    const { ctx } = await ctxGestion()
    const nom = texte(formData, "associationNom")
    const rna = texte(formData, "associationRna").toUpperCase()
    const siege = texte(formData, "associationSiege")

    if (rna && !RNA.test(rna)) throw new Error("Le numéro RNA doit être au format W suivi de 9 chiffres.")

    await prismaPourTeam(ctx.teamId, ctx.userId).coreTeam.update({
      where: { id: ctx.teamId },
      data: {
        associationNom: nom || null,
        associationRna: rna || null,
        associationSiege: siege || null,
      },
    })
    await emettre(ctx, "settings.identite_modifiee", { rubrique: "association" })
  } catch (cause) {
    erreur = messageErreur(cause)
  }
  revalidatePath(RUBRIQUE, "layout")
  retour("association", erreur)
}

// Invitation : e-mail obligatoire. Le téléphone n'a pas encore d'invitation par SMS.
export async function inviterMembre(formData: FormData): Promise<void> {
  let erreur: string | undefined
  try {
    const { ctx, nomTeam } = await ctxGestion()
    const analyse = schemaEmail.safeParse(texte(formData, "email"))
    if (!analyse.success) throw new Error("Adresse e-mail invalide.")
    const email = analyse.data

    const role = texte(formData, "role")
    if (!(ROLES as readonly string[]).includes(role)) throw new Error("Rôle inconnu.")

    const client = prismaPourTeam(ctx.teamId, ctx.userId)
    let personId = texte(formData, "personneId") || null
    if (personId) {
      const personne = await client.corePerson.findFirst({ where: { id: personId, userId: null }, select: { id: true } })
      if (!personne) throw new Error("Cette personne n'est pas disponible pour une invitation.")
    } else {
      const prenom = texte(formData, "prenom")
      const nom = texte(formData, "nom")
      if (!prenom || !nom) throw new Error("Pour une nouvelle personne, indique le prénom et le nom.")
      personId = newId()
      await client.corePerson.create({
        data: { id: personId, teamId: ctx.teamId, prenom, nom, membreTeam: true },
      })
    }

    await creerInvitation(ctx, nomTeam, { email, role, personId })
  } catch (cause) {
    erreur = messageErreur(cause)
  }
  revalidatePath(RUBRIQUE, "layout")
  retour("membres", erreur)
}

export async function renvoyerInvitationAction(formData: FormData): Promise<void> {
  let erreur: string | undefined
  try {
    const { ctx, nomTeam } = await ctxGestion()
    await renvoyerInvitation(ctx, nomTeam, texte(formData, "invitationId"))
  } catch (cause) {
    erreur = messageErreur(cause)
  }
  revalidatePath(RUBRIQUE, "layout")
  retour("membres", erreur)
}

export async function annulerInvitationAction(formData: FormData): Promise<void> {
  let erreur: string | undefined
  try {
    const { ctx } = await ctxGestion()
    await annulerInvitation(ctx, texte(formData, "invitationId"))
  } catch (cause) {
    erreur = messageErreur(cause)
  }
  revalidatePath(RUBRIQUE, "layout")
  retour("membres", erreur)
}

// Changer le rôle, ou retirer un membre : règle du dernier responsable appliquée.
export async function changerRole(formData: FormData): Promise<void> {
  let erreur: string | undefined
  try {
    const { ctx } = await ctxGestion()
    const membershipId = texte(formData, "membershipId")
    const role = texte(formData, "role")
    if (!(ROLES as readonly string[]).includes(role)) throw new Error("Rôle inconnu.")

    const client = prismaPourTeam(ctx.teamId, ctx.userId)
    const membres = await client.coreMembership.findMany({
      where: { teamId: ctx.teamId },
      select: { id: true, role: true, statut: true },
    })
    const verdict = peutChangerAcces(membres, membershipId, { role, statut: "actif" })
    if (!verdict.ok) throw new Error(verdict.raison)

    await client.coreMembership.update({ where: { id: membershipId }, data: { role: role as (typeof ROLES)[number] } })
    await emettre(ctx, "settings.droits_modifies", { membershipId, role })
  } catch (cause) {
    erreur = messageErreur(cause)
  }
  revalidatePath(RUBRIQUE, "layout")
  retour("membres", erreur)
}

export async function retirerMembre(formData: FormData): Promise<void> {
  let erreur: string | undefined
  try {
    const { ctx } = await ctxGestion()
    const membershipId = texte(formData, "membershipId")

    const client = prismaPourTeam(ctx.teamId, ctx.userId)
    const membres = await client.coreMembership.findMany({
      where: { teamId: ctx.teamId },
      select: { id: true, role: true, statut: true },
    })
    const verdict = peutChangerAcces(membres, membershipId, { role: "invite", statut: "parti" })
    if (!verdict.ok) throw new Error(verdict.raison)

    await client.coreMembership.update({ where: { id: membershipId }, data: { statut: "parti" } })
    await emettre(ctx, "settings.membre_retire", { membershipId })
  } catch (cause) {
    erreur = messageErreur(cause)
  }
  revalidatePath(RUBRIQUE, "layout")
  retour("membres", erreur)
}
