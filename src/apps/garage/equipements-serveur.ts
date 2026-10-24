// Services serveur des équipements de la team (tâche 4.6, brief §3 et §4). Même forme que casses-serveur.ts : chaque fonction
// publique passe par accesGarage("ecriture") ; les fonctions « …Dans(ctx, …) » font le travail sans garde (scripts de
// vérification). Un équipement n'appartient à aucune voiture et n'émet aucun événement : rien ne le lit ailleurs.

import type { ContexteTeam } from "@/core/contexte"
import { newId } from "@/core/ids"
import { executerPourTeam } from "@/lib/prisma"
import { avecReprisePourConflit } from "@/lib/reprise-conflit"

import { refus } from "./erreurs"
import { validerSaisieEquipement, type SaisieBrute, type SaisieEquipement } from "./equipements"
import { accesGarage } from "./services-serveur"

// Saisie complète : le formulaire envoie tous les champs, vides compris. Une modification remplace donc l'équipement.
export type EntreeEquipement = SaisieBrute

function saisieValide(entree: EntreeEquipement): SaisieEquipement {
  const resultat = validerSaisieEquipement(entree)
  if ("erreur" in resultat) refus(resultat.erreur)
  return resultat.saisie
}

// Date civile « AAAA-MM-JJ » rangée à minuit UTC (la colonne d'achat est un horodatage, celle du contrôle une date).
const versDate = (dateCivile: string | null): Date | null => (dateCivile === null ? null : new Date(`${dateCivile}T00:00:00Z`))

// --- Ajouter ----------------------------------------------------------------------------------------------------------

export async function creerEquipement(entree: EntreeEquipement): Promise<string> {
  const { ctx } = await accesGarage("ecriture")
  return creerEquipementDans(ctx, entree)
}

export async function creerEquipementDans(ctx: ContexteTeam, entree: EntreeEquipement): Promise<string> {
  const saisie = saisieValide(entree)
  const id = newId()
  await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
      await tx.garageEquipment.create({
        data: {
          id,
          teamId: ctx.teamId,
          nom: saisie.nom,
          categorie: saisie.categorie,
          etat: saisie.etat,
          acheteLe: versDate(saisie.acheteLe),
          valeurCents: saisie.valeurCents,
          prochainControleLe: versDate(saisie.prochainControleLe),
          emplacement: saisie.emplacement,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      })
    }),
  )
  return id
}

// --- Modifier ---------------------------------------------------------------------------------------------------------

export async function modifierEquipement(id: string, entree: EntreeEquipement): Promise<void> {
  const { ctx } = await accesGarage("ecriture")
  return modifierEquipementDans(ctx, id, entree)
}

export async function modifierEquipementDans(ctx: ContexteTeam, id: string, entree: EntreeEquipement): Promise<void> {
  const saisie = saisieValide(entree)
  await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
      const existant = await tx.garageEquipment.findFirst({ where: { id, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
      if (!existant) refus("Cet équipement n'existe pas dans la team.")
      await tx.garageEquipment.updateMany({
        where: { id, teamId: ctx.teamId, deletedAt: null },
        data: {
          nom: saisie.nom,
          categorie: saisie.categorie,
          etat: saisie.etat,
          acheteLe: versDate(saisie.acheteLe),
          valeurCents: saisie.valeurCents,
          prochainControleLe: versDate(saisie.prochainControleLe),
          emplacement: saisie.emplacement,
          rev: { increment: 1 },
          updatedBy: ctx.userId,
        },
      })
    }),
  )
}

// --- Retirer : suppression douce, l'équipement sort de la liste et du total --------------------------------------------

export async function retirerEquipement(id: string): Promise<void> {
  const { ctx } = await accesGarage("ecriture")
  return retirerEquipementDans(ctx, id)
}

export async function retirerEquipementDans(ctx: ContexteTeam, id: string): Promise<void> {
  await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
      const existant = await tx.garageEquipment.findFirst({ where: { id, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
      if (!existant) refus("Cet équipement n'existe pas dans la team.")
      await tx.garageEquipment.updateMany({
        where: { id, teamId: ctx.teamId, deletedAt: null },
        data: { deletedAt: new Date(), rev: { increment: 1 }, updatedBy: ctx.userId },
      })
    }),
  )
}
