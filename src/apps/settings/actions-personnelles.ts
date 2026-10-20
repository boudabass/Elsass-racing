"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { ErreurAcces, libelleErreurAcces } from "@/core/droits/erreurs"
import { exigerContexte } from "@/core/droits/garde-serveur"
import { deconnecter, lireSession, magasinCookies } from "@/core/auth/session-serveur"
import { teamCourante } from "@/core/auth/team-serveur"
import { appsVisibles } from "@/core/sdk/apps-serveur"
import { texte, type Resultat } from "@/core/sdk/actions-serveur"
import { emettre } from "@/core/evenements/bus-serveur"
import { newId } from "@/core/ids"
import type { ContexteTeam } from "@/core/contexte"
import { prisma, prismaPourCompte, prismaPourTeam } from "@/lib/prisma"

import { appDecouverte, confirmationCorrespond, dateDePurge, lireHeure, peutSupprimerCompte } from "./regles-personnelles"
import { peutChangerAcces } from "./regles"
import { CANAUX_NOTIFIABLES, adhesionsDuCompte } from "./personnelles-serveur"
import { mettreAJourPrefsMembre, prefsMembre } from "./preferences-serveur"

// Actions des rubriques personnelles. Ouvertes à tout membre de la team, sans droit sur
// Réglages. Les rubriques de la team restent dans actions.ts.

const THEMES = ["sombre", "clair", "systeme"] as const
const TAILLES = ["normale", "grande"] as const
const LUDIQUES = ["oui", "non", "comme_la_team"] as const
const REGROUPEMENTS = ["immediat", "quotidien"] as const

// Une erreur s'affiche dans le tiroir, en clair. Le succès ferme le tiroir et relit la rubrique
// (demandes en cours, appareils, réglages) : le tiroir ne rafraîchit pas la page tout seul.
const RUBRIQUE = "/apps/settings"

function retour(erreur?: string): Resultat {
  if (erreur) return { ok: false, message: erreur }
  revalidatePath(RUBRIQUE, "layout")
  return { ok: true }
}

function choix<T extends string>(valeur: string, liste: readonly T[]): T {
  const trouve = liste.find((v) => v === valeur)
  if (!trouve) throw new Error("Choix inconnu.")
  return trouve
}

function messageErreur(erreur: unknown): string {
  if (erreur instanceof ErreurAcces) return libelleErreurAcces(erreur)
  return erreur instanceof Error ? erreur.message : "L'enregistrement n'a pas pu être fait."
}

function estResponsable(ctx: ContexteTeam): boolean {
  return ctx.membership.role === "responsable"
}

export async function sauverNotifications(_etat: Resultat | null, formData: FormData): Promise<Resultat> {
  let erreur: string | undefined
  try {
    const { contexte } = await exigerContexte()
    const apps = await appsVisibles(contexte)
    const client = prismaPourTeam(contexte.teamId, contexte.userId)

    for (const app of apps) {
      const cle = app.manifeste.cle
      const regroupement = choix(texte(formData, `regroupement_${cle}`) || "immediat", REGROUPEMENTS)
      for (const canal of CANAUX_NOTIFIABLES) {
        const actif = formData.get(`${canal}_${cle}`) === "1"
        await client.coreNotificationPref.upsert({
          where: { membershipId_app_type_canal: { membershipId: contexte.membership.id, app: cle, type: "general", canal } },
          create: { id: newId(), teamId: contexte.teamId, membershipId: contexte.membership.id, app: cle, type: "general", canal, actif, regroupement },
          update: { actif, regroupement },
        })
      }
    }

    const debut = lireHeure(texte(formData, "heuresCalmesDebut"))
    const fin = lireHeure(texte(formData, "heuresCalmesFin"))
    if (!debut.ok || !fin.ok) throw new Error("Heure invalide : écris-la au format 22:30.")
    await mettreAJourPrefsMembre(contexte, { heuresCalmesDebut: debut.valeur, heuresCalmesFin: fin.valeur })
  } catch (cause) {
    erreur = messageErreur(cause)
  }
  return retour(erreur)
}

export async function sauverAffichage(_etat: Resultat | null, formData: FormData): Promise<Resultat> {
  let erreur: string | undefined
  try {
    const { contexte } = await exigerContexte()
    await mettreAJourPrefsMembre(contexte, {
      theme: choix(texte(formData, "theme"), THEMES),
      tailleTexte: choix(texte(formData, "tailleTexte"), TAILLES),
      ludiqueAffiche: choix(texte(formData, "ludiqueAffiche"), LUDIQUES),
      modeTerrain: formData.get("modeTerrain") === "1",
    })
  } catch (cause) {
    erreur = messageErreur(cause)
  }
  return retour(erreur)
}

export async function sauverLudiqueEquipe(_etat: Resultat | null, formData: FormData): Promise<Resultat> {
  let erreur: string | undefined
  try {
    const { contexte } = await exigerContexte()
    if (!estResponsable(contexte)) throw new Error("Réservé au responsable de la team.")
    const affiche = formData.get("ludiqueEquipe") === "1"
    await prismaPourTeam(contexte.teamId, contexte.userId).settingsTeamPref.upsert({
      where: { teamId: contexte.teamId },
      create: { id: newId(), teamId: contexte.teamId, ludiqueAffiche: affiche },
      update: { ludiqueAffiche: affiche },
    })
    await emettre(contexte, "settings.ludique_modifie", { affiche })
  } catch (cause) {
    erreur = messageErreur(cause)
  }
  return retour(erreur)
}

// Revoir les écrans d'accueil : tous les écrans d'app redeviennent visibles une fois.
export async function reinitialiserDecouvertes(_etat: Resultat | null): Promise<Resultat> {
  let erreur: string | undefined
  try {
    const { contexte } = await exigerContexte()
    await mettreAJourPrefsMembre(contexte, { appsDecouvertes: [] })
  } catch (cause) {
    erreur = messageErreur(cause)
  }
  return retour(erreur)
}

// Déconnecter un appareil : le sien, ou un appareil d'un membre pour le responsable.
// L'événement part avant la suppression, pendant que la session est encore valable.
export async function revoquerAppareil(_etat: Resultat | null, formData: FormData): Promise<Resultat> {
  let erreur: string | undefined
  let deconnecte = false
  try {
    const session = await lireSession()
    if (!session) throw new Error("Ta session a expiré. Reconnecte-toi.")
    const { contexte } = await exigerContexte()

    const appareilId = texte(formData, "appareilId")
    const cible = await prisma.coreDevice.findUnique({ where: { id: appareilId }, select: { id: true, userId: true } })
    if (!cible) throw new Error("Cet appareil n'existe plus.")

    let autorise = cible.userId === session.userId
    if (!autorise && estResponsable(contexte)) {
      const membre = await prismaPourTeam(contexte.teamId, contexte.userId).coreMembership.findFirst({
        where: { teamId: contexte.teamId, userId: cible.userId, statut: { not: "parti" } },
        select: { id: true },
      })
      autorise = membre !== null
    }
    if (!autorise) throw new Error("Tu ne peux pas déconnecter cet appareil.")

    await emettre(contexte, "settings.appareil_revoque", { appareilId })
    await prisma.coreDevice.delete({ where: { id: appareilId } })
    deconnecte = appareilId === session.deviceId
  } catch (cause) {
    erreur = messageErreur(cause)
  }

  // Appareil courant : les cookies partent, et on revient à la connexion.
  if (deconnecte) {
    await deconnecter(await magasinCookies())
    redirect("/connexion")
  }
  return retour(erreur)
}

// Export : personnel pour tout membre, de la team pour le responsable. La génération du
// fichier n'existe pas encore : la ligne reste en attente.
export async function demanderExport(_etat: Resultat | null, formData: FormData): Promise<Resultat> {
  let erreur: string | undefined
  try {
    const { contexte } = await exigerContexte()
    const perimetre = choix(texte(formData, "perimetre"), ["personnel", "equipe"] as const)
    if (perimetre === "equipe" && !estResponsable(contexte)) throw new Error("Réservé au responsable de la team.")

    const id = newId()
    await prismaPourTeam(contexte.teamId, contexte.userId).coreExport.create({
      data: {
        id,
        teamId: contexte.teamId,
        demandeParUserId: contexte.userId,
        perimetre,
        format: perimetre === "equipe" ? "archive" : "json",
        statut: "en_attente",
      },
    })
    await emettre(contexte, "settings.export_demande", { exportId: id, perimetre })
  } catch (cause) {
    erreur = messageErreur(cause)
  }
  return retour(erreur)
}

// Suppression de mon compte, ou de la team (responsable). Confirmation par saisie. Aucune
// purge n'est exécutée ici : la demande attend sa date.
export async function demanderSuppression(_etat: Resultat | null, formData: FormData): Promise<Resultat> {
  let erreur: string | undefined
  try {
    const { contexte, team } = await exigerContexte()
    const portee = choix(texte(formData, "portee"), ["compte", "team"] as const)
    const saisie = texte(formData, "confirmation")

    if (portee === "compte") {
      const compte = await prisma.coreUser.findUniqueOrThrow({ where: { id: contexte.userId }, select: { email: true } })
      if (!confirmationCorrespond(saisie.toLowerCase(), compte.email)) {
        throw new Error("Pour confirmer, tape ton adresse e-mail.")
      }
      const verdict = peutSupprimerCompte(await adhesionsDuCompte(contexte.userId))
      if (!verdict.ok) throw new Error(verdict.raison)
    } else {
      if (!estResponsable(contexte)) throw new Error("Réservé au responsable de la team.")
      if (!confirmationCorrespond(saisie, team.nom)) throw new Error("Pour confirmer, tape le nom de la team.")
    }

    const client = prismaPourTeam(contexte.teamId, contexte.userId)
    const deja = await client.settingsDeletionRequest.findFirst({
      where: { teamId: contexte.teamId, portee, annuleeAt: null, executeeAt: null },
      select: { id: true },
    })
    if (deja) throw new Error("Une demande de suppression est déjà en cours.")

    const id = newId()
    await client.settingsDeletionRequest.create({
      data: {
        id,
        teamId: contexte.teamId,
        portee,
        userId: portee === "compte" ? contexte.userId : null,
        demandeParUserId: contexte.userId,
        purgePrevueAt: dateDePurge(new Date()),
      },
    })
    await emettre(contexte, "settings.suppression_demandee", { demandeId: id, portee })
  } catch (cause) {
    erreur = messageErreur(cause)
  }
  return retour(erreur)
}

export async function annulerSuppression(_etat: Resultat | null, formData: FormData): Promise<Resultat> {
  let erreur: string | undefined
  try {
    const { contexte } = await exigerContexte()
    const id = texte(formData, "demandeId")
    const client = prismaPourTeam(contexte.teamId, contexte.userId)
    const demande = await client.settingsDeletionRequest.findFirst({
      where: { id, teamId: contexte.teamId, annuleeAt: null, executeeAt: null },
      select: { id: true, portee: true, demandeParUserId: true },
    })
    if (!demande) throw new Error("Cette demande n'est plus en cours.")
    if (demande.portee === "team" && !estResponsable(contexte)) throw new Error("Réservé au responsable de la team.")
    if (demande.portee === "compte" && demande.demandeParUserId !== contexte.userId) {
      throw new Error("Seul le titulaire du compte peut annuler cette demande.")
    }

    await client.settingsDeletionRequest.update({ where: { id }, data: { annuleeAt: new Date() } })
    await emettre(contexte, "settings.suppression_annulee", { demandeId: id })
  } catch (cause) {
    erreur = messageErreur(cause)
  }
  return retour(erreur)
}

export async function sauverTelephone(_etat: Resultat | null, formData: FormData): Promise<Resultat> {
  let erreur: string | undefined
  try {
    const { contexte } = await exigerContexte()
    const brut = texte(formData, "telephone")
    if (brut !== "" && !/^\+?[0-9 ]{6,20}$/.test(brut)) throw new Error("Numéro invalide : chiffres, espaces et + seulement.")
    await prisma.coreUser.update({ where: { id: contexte.userId }, data: { telephone: brut === "" ? null : brut } })
  } catch (cause) {
    erreur = messageErreur(cause)
  }
  return retour(erreur)
}

// Quitter une team : refusé au dernier responsable, avec la raison. Si c'est la team courante,
// on repart vers le choix de team.
export async function quitterTeam(_etat: Resultat | null, formData: FormData): Promise<Resultat> {
  let erreur: string | undefined
  let etaitCourante = false
  try {
    const session = await lireSession()
    if (!session) throw new Error("Ta session a expiré. Reconnecte-toi.")
    const teamId = texte(formData, "teamId")

    const adhesion = await prismaPourCompte(session.userId).coreMembership.findFirst({
      where: { teamId, userId: session.userId, statut: "actif" },
      select: { id: true, role: true },
    })
    if (!adhesion) throw new Error("Tu n'es pas membre de cette team.")

    const client = prismaPourTeam(teamId, session.userId)
    const membres = await client.coreMembership.findMany({
      where: { teamId, statut: { not: "parti" } },
      select: { id: true, role: true, statut: true },
    })
    const verdict = peutChangerAcces(membres, adhesion.id, { role: adhesion.role, statut: "parti" })
    if (!verdict.ok) throw new Error(verdict.raison)

    const ctx: ContexteTeam = { teamId, userId: session.userId, membership: { id: adhesion.id, role: adhesion.role } }
    await emettre(ctx, "settings.membre_retire", { membershipId: adhesion.id })
    await client.coreMembership.update({ where: { id: adhesion.id }, data: { statut: "parti" } })

    etaitCourante = (await teamCourante())?.team.id === teamId
  } catch (cause) {
    erreur = messageErreur(cause)
  }
  if (etaitCourante) redirect("/equipes")
  return retour(erreur)
}

// Commencer une app : son écran d'accueil ne revient plus pour ce membre.
export async function marquerAppDecouverte(formData: FormData): Promise<void> {
  const appCle = texte(formData, "appCle")
  const { contexte } = await exigerContexte()
  const prefs = await prefsMembre(contexte)
  if (!appDecouverte(appCle, prefs.appsDecouvertes)) {
    await mettreAJourPrefsMembre(contexte, { appsDecouvertes: [...prefs.appsDecouvertes, appCle] })
  }
  redirect(`/apps/${appCle}`)
}
