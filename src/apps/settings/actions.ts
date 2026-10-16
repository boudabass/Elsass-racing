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

import { APPS } from "@/core/catalogue"
import { NIVEAUX, type Niveau } from "@/core/droits/niveaux"
import { prisma } from "@/lib/prisma"

import { peutChangerAcces } from "./regles"
import { deplacer, niveauAutorise, peutDesactiver } from "./droits-regles"

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

// Droits par app : une case à la valeur du défaut du rôle ne laisse aucune ligne
// core_app_access ; une case différente en crée ou met à jour une.
export async function sauverDroitsMembre(formData: FormData): Promise<void> {
  let erreur: string | undefined
  try {
    const { ctx } = await ctxGestion()
    const membershipId = texte(formData, "membershipId")
    const client = prismaPourTeam(ctx.teamId, ctx.userId)

    const membre = await client.coreMembership.findFirst({
      where: { id: membershipId, teamId: ctx.teamId },
      select: { id: true, role: true },
    })
    if (!membre) throw new Error("Membre introuvable.")

    const defauts = await prisma.coreRoleDefault.findMany({ where: { role: membre.role } })

    for (const app of APPS) {
      const valeur = texte(formData, `niveau_${app.cle}`)
      if (!(NIVEAUX as readonly string[]).includes(valeur)) continue
      const niveau = valeur as Niveau
      if (!niveauAutorise(membre.role, app.cle, niveau)) {
        throw new Error("Un responsable garde la gestion de Réglages.")
      }

      const defaut = defauts.find((d) => d.appCle === app.cle)?.niveau ?? "aucun"
      if (niveau === defaut) {
        await client.coreAppAccess.deleteMany({ where: { membershipId, appCle: app.cle } })
      } else {
        await client.coreAppAccess.upsert({
          where: { membershipId_appCle: { membershipId, appCle: app.cle } },
          create: { id: newId(), teamId: ctx.teamId, membershipId, appCle: app.cle, niveau },
          update: { niveau },
        })
      }
    }
    await emettre(ctx, "settings.droits_modifies", { membershipId })
  } catch (cause) {
    erreur = messageErreur(cause)
  }
  revalidatePath(RUBRIQUE, "layout")
  retour("droits", erreur)
}

// Revenir aux droits du rôle : supprime toutes les lignes core_app_access du membre.
export async function revenirAuxDroitsDuRole(formData: FormData): Promise<void> {
  let erreur: string | undefined
  try {
    const { ctx } = await ctxGestion()
    const membershipId = texte(formData, "membershipId")
    await prismaPourTeam(ctx.teamId, ctx.userId).coreAppAccess.deleteMany({ where: { membershipId } })
    await emettre(ctx, "settings.droits_modifies", { membershipId })
  } catch (cause) {
    erreur = messageErreur(cause)
  }
  revalidatePath(RUBRIQUE, "layout")
  retour("droits", erreur)
}

export async function basculerApp(formData: FormData): Promise<void> {
  let erreur: string | undefined
  try {
    const { ctx } = await ctxGestion()
    const appCle = texte(formData, "appCle")
    const activer = texte(formData, "activer") === "1"
    if (!APPS.some((a) => a.cle === appCle)) throw new Error("App inconnue.")

    const client = prismaPourTeam(ctx.teamId, ctx.userId)
    const lignes = await client.coreTeamApp.findMany({ where: { teamId: ctx.teamId, deletedAt: null }, select: { appCle: true, activee: true } })
    if (!activer) {
      const verdict = peutDesactiver(appCle, lignes.filter((l) => l.activee).map((l) => l.appCle))
      if (!verdict.ok) throw new Error(verdict.raison)
    }

    await client.coreTeamApp.update({
      where: { teamId_appCle: { teamId: ctx.teamId, appCle } },
      data: { activee: activer },
    })
    await emettre(ctx, activer ? "settings.app_activee" : "settings.app_desactivee", { appCle })
  } catch (cause) {
    erreur = messageErreur(cause)
  }
  revalidatePath(RUBRIQUE, "layout")
  retour("apps", erreur)
}

// Ordre des apps : monter ou descendre d'un cran. Le glisser-déposer viendra plus tard.
export async function deplacerApp(formData: FormData): Promise<void> {
  let erreur: string | undefined
  try {
    const { ctx } = await ctxGestion()
    const appCle = texte(formData, "appCle")
    const sens = texte(formData, "sens") === "monter" ? -1 : 1

    const client = prismaPourTeam(ctx.teamId, ctx.userId)
    const lignes = await client.coreTeamApp.findMany({ where: { teamId: ctx.teamId, deletedAt: null }, select: { appCle: true, ordre: true } })
    const nouveaux = deplacer(lignes, appCle, sens)
    if (!nouveaux) throw new Error("Cette app ne peut pas bouger dans ce sens.")

    for (const ligne of nouveaux) {
      await client.coreTeamApp.update({
        where: { teamId_appCle: { teamId: ctx.teamId, appCle: ligne.appCle } },
        data: { ordre: ligne.ordre },
      })
    }
    await emettre(ctx, "settings.ordre_apps_modifie", { appCle, sens })
  } catch (cause) {
    erreur = messageErreur(cause)
  }
  revalidatePath(RUBRIQUE, "layout")
  retour("apps", erreur)
}

// Proposition de passer en mode terrain le jour d'une épreuve : réglage de la team.
export async function sauverJourEpreuve(formData: FormData): Promise<void> {
  let erreur: string | undefined
  try {
    const { ctx } = await ctxGestion()
    const propose = texte(formData, "terrainProposeJourEpreuve") === "1"
    const client = prismaPourTeam(ctx.teamId, ctx.userId)
    await client.settingsTeamPref.upsert({
      where: { teamId: ctx.teamId },
      create: { id: newId(), teamId: ctx.teamId, terrainProposeJourEpreuve: propose },
      update: { terrainProposeJourEpreuve: propose },
    })
    await emettre(ctx, "settings.identite_modifiee", { rubrique: "jour_epreuve" })
  } catch (cause) {
    erreur = messageErreur(cause)
  }
  revalidatePath(RUBRIQUE, "layout")
  retour("identite", erreur)
}
