"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { exigerAcces, exigerContexte } from "@/core/droits/garde-serveur"
import { ErreurAcces, libelleErreurAcces } from "@/core/droits/erreurs"
import { COOKIE_BANDEAU_TERRAIN, COOKIE_TERRAIN, DUREE_JOUR_SECONDES } from "@/core/qg/cookies"
import { prismaPourTeam } from "@/lib/prisma"
import type { Niveau } from "@/core/droits/niveaux"

import { decider, reporter } from "./actions-serveur"

// Les redirections sont faites hors des blocs try : redirect lève une exception interne
// que le catch intercepterait. Le message d'erreur part dans l'URL du QG.
function adresseAvecErreur(message: string): string {
  return `/qg?erreur=${encodeURIComponent(message)}`
}

export async function deciderAction(formData: FormData): Promise<void> {
  const actionId = String(formData.get("actionId") ?? "")
  const cleBouton = String(formData.get("cleBouton") ?? "")

  let erreur: string | null = null
  try {
    const { contexte } = await exigerContexte()
    const action = await prismaPourTeam(contexte.teamId, contexte.userId).coreAction.findFirst({
      where: { id: actionId, teamId: contexte.teamId },
      select: { appOrigine: true, destinataires: true },
    })
    if (!action) {
      erreur = "Cette action n'existe plus."
    } else {
      const niveauRequis = (action.destinataires as { niveauRequis?: Niveau } | null)?.niveauRequis ?? "ecriture"
      await exigerAcces(action.appOrigine, niveauRequis)
      await decider(contexte, actionId, cleBouton)
    }
  } catch (cause) {
    erreur =
      cause instanceof ErreurAcces
        ? libelleErreurAcces(cause)
        : cause instanceof Error
          ? cause.message
          : "La décision n'a pas pu être enregistrée."
  }

  revalidatePath("/qg", "layout")
  redirect(erreur ? adresseAvecErreur(erreur) : "/qg")
}

export async function reporterAction(formData: FormData): Promise<void> {
  const actionId = String(formData.get("actionId") ?? "")
  const jours = Number(formData.get("jours") ?? 1)

  let erreur: string | null = null
  try {
    const { contexte } = await exigerContexte()
    const jusquAu = new Date(Date.now() + Math.min(Math.max(jours, 1), 30) * 24 * 60 * 60 * 1000)
    await reporter(contexte, actionId, jusquAu)
  } catch (cause) {
    erreur = cause instanceof Error ? cause.message : "L'action n'a pas pu être reportée."
  }

  revalidatePath("/qg", "layout")
  redirect(erreur ? adresseAvecErreur(erreur) : "/qg")
}

// Bascule le mode terrain (cookie pour l'instant ; les préférences viendront en 1.10).
export async function basculerTerrainAction(formData: FormData): Promise<void> {
  await exigerContexte()
  const actif = formData.get("actif") === "1"
  const magasin = await cookies()
  magasin.set(COOKIE_TERRAIN, actif ? "1" : "0", {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 30 * 24 * 60 * 60,
  })
  revalidatePath("/", "layout")
}

// Refuse le bandeau « jour d'épreuve » pour la journée.
export async function refuserBandeauTerrainAction(): Promise<void> {
  await exigerContexte()
  const aujourdhui = new Date().toISOString().slice(0, 10)
  const magasin = await cookies()
  magasin.set(COOKIE_BANDEAU_TERRAIN, aujourdhui, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: DUREE_JOUR_SECONDES,
  })
  revalidatePath("/", "layout")
}
