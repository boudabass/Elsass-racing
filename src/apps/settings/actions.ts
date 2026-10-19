"use server"

import { revalidatePath } from "next/cache"

import { exigerAcces } from "@/core/droits/garde-serveur"
import { ErreurAcces, libelleErreurAcces } from "@/core/droits/erreurs"
import { executerPourTeam, prismaPourTeam } from "@/lib/prisma"
import { newId } from "@/core/ids"
import { emettre } from "@/core/evenements/bus-serveur"
import type { ContexteTeam } from "@/core/contexte"
import { annulerInvitation, creerInvitation, renvoyerInvitation } from "@/core/invitations/invitations-serveur"
import { schemaEmail } from "@/core/auth/jetons"
import { texte, texteOuNull, type Resultat } from "@/core/sdk/actions-serveur"
import { rattacherFichier, remplacerFichier } from "@/core/fichiers/fichiers-serveur"

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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Toute action de Réglages passe par la garde. Une erreur s'affiche dans le tiroir, en clair.
function retour(erreur?: string): Resultat {
  return erreur ? { ok: false, message: erreur } : { ok: true }
}

async function ctxGestion(): Promise<{ ctx: ContexteTeam; nomTeam: string }> {
  const { session, team, membership } = await exigerAcces("settings", "gestion")
  return {
    ctx: { teamId: team.id, userId: session.userId, membership: { id: membership.id, role: membership.role } },
    nomTeam: team.nom,
  }
}

function messageErreur(erreur: unknown): string {
  if (erreur instanceof ErreurAcces) return libelleErreurAcces(erreur)
  return erreur instanceof Error ? erreur.message : "L'enregistrement n'a pas pu être fait."
}

export async function sauverIdentite(_etat: Resultat | null, formData: FormData): Promise<Resultat> {
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
    const logoId = texteOuNull(formData, "logoFileId")
    if (logoId && !UUID.test(logoId)) throw new Error("Logo introuvable dans cette team.")

    // Logo, team et rattachement dans une seule transaction : un échec ne laisse ni logo à moitié posé.
    await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
      const actuelle = await tx.coreTeam.findUnique({ where: { id: ctx.teamId }, select: { logoFileId: true } })
      await tx.coreTeam.update({
        where: { id: ctx.teamId },
        data: {
          nom,
          couleurPrincipale: principale.toUpperCase(),
          couleurSecondaire: secondaire.toUpperCase(),
          disciplinePrincipale: discipline,
          fuseau,
          logoFileId: logoId,
        },
      })
      if (logoId) {
        await rattacherFichier(tx, ctx, { fileId: logoId, app: "settings", ficheType: "team", ficheId: ctx.teamId, role: "photo" })
      }
      await remplacerFichier(tx, ctx, { ancienId: actuelle?.logoFileId ?? null, nouveauId: logoId })
    })
    await emettre(ctx, "settings.identite_modifiee", { rubrique: "identite" })
  } catch (cause) {
    erreur = messageErreur(cause)
  }
  revalidatePath(RUBRIQUE, "layout")
  return retour(erreur)
}

export async function sauverAssociation(_etat: Resultat | null, formData: FormData): Promise<Resultat> {
  let erreur: string | undefined
  try {
    const { ctx } = await ctxGestion()
    const nom = texte(formData, "associationNom")
    const siege = texte(formData, "associationSiege")

    // Pas de validation de format : une association de droit local n'a pas de numéro RNA.
    await prismaPourTeam(ctx.teamId, ctx.userId).coreTeam.update({
      where: { id: ctx.teamId },
      data: {
        associationNom: nom || null,
        formeJuridique: texteOuNull(formData, "formeJuridique"),
        associationRna: texteOuNull(formData, "associationRna"),
        associationSiege: siege || null,
        signataireNom: texteOuNull(formData, "signataireNom"),
        signataireQualite: texteOuNull(formData, "signataireQualite"),
      },
    })
    await emettre(ctx, "settings.identite_modifiee", { rubrique: "association" })
  } catch (cause) {
    erreur = messageErreur(cause)
  }
  revalidatePath(RUBRIQUE, "layout")
  return retour(erreur)
}

// Invitation : e-mail obligatoire. Le téléphone n'a pas encore d'invitation par SMS.
export async function inviterMembre(_etat: Resultat | null, formData: FormData): Promise<Resultat> {
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
  return retour(erreur)
}

export async function renvoyerInvitationAction(_etat: Resultat | null, formData: FormData): Promise<Resultat> {
  let erreur: string | undefined
  try {
    const { ctx, nomTeam } = await ctxGestion()
    await renvoyerInvitation(ctx, nomTeam, texte(formData, "invitationId"))
  } catch (cause) {
    erreur = messageErreur(cause)
  }
  revalidatePath(RUBRIQUE, "layout")
  return retour(erreur)
}

export async function annulerInvitationAction(_etat: Resultat | null, formData: FormData): Promise<Resultat> {
  let erreur: string | undefined
  try {
    const { ctx } = await ctxGestion()
    await annulerInvitation(ctx, texte(formData, "invitationId"))
  } catch (cause) {
    erreur = messageErreur(cause)
  }
  revalidatePath(RUBRIQUE, "layout")
  return retour(erreur)
}

// Changer le rôle, ou retirer un membre : règle du dernier responsable appliquée.
export async function changerRole(_etat: Resultat | null, formData: FormData): Promise<Resultat> {
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
  return retour(erreur)
}

export async function retirerMembre(_etat: Resultat | null, formData: FormData): Promise<Resultat> {
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
  return retour(erreur)
}

// Droits par app : une case à la valeur du défaut du rôle ne laisse aucune ligne
// core_app_access ; une case différente en crée ou met à jour une.
export async function sauverDroitsMembre(_etat: Resultat | null, formData: FormData): Promise<Resultat> {
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
  return retour(erreur)
}

// Revenir aux droits du rôle : supprime toutes les lignes core_app_access du membre.
export async function revenirAuxDroitsDuRole(_etat: Resultat | null, formData: FormData): Promise<Resultat> {
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
  return retour(erreur)
}

export async function basculerApp(_etat: Resultat | null, formData: FormData): Promise<Resultat> {
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
  return retour(erreur)
}

// Ordre des apps : monter ou descendre d'un cran. Le glisser-déposer viendra plus tard.
export async function deplacerApp(_etat: Resultat | null, formData: FormData): Promise<Resultat> {
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
  return retour(erreur)
}

// Proposition de passer en mode terrain le jour d'une épreuve : réglage de la team.
export async function sauverJourEpreuve(_etat: Resultat | null, formData: FormData): Promise<Resultat> {
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
  return retour(erreur)
}
