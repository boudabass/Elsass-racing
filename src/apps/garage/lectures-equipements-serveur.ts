// Lectures des équipements de la team (tâche 4.6, brief §3 et §4). Lecture seule, sous accesGarage("lecture"). La valeur
// n'est servie qu'au niveau écriture : l'assistance (contribution) reçoit null, comme pour les prix ailleurs dans le Garage.

import type { ContexteTeam } from "@/core/contexte"
import { aAuMoins } from "@/core/droits/niveaux"
import { prismaPourTeam } from "@/lib/prisma"

import type { CategorieEquipement } from "./equipements"
import { accesGarage } from "./services-serveur"

export interface EquipementLigne {
  id: string
  nom: string
  categorie: CategorieEquipement
  etat: string | null
  // Dates civiles « AAAA-MM-JJ », comme elles s'affichent et se saisissent.
  acheteLe: string | null
  valeurCents: number | null
  prochainControleLe: string | null
  emplacement: string | null
}

const versDateCivile = (date: Date | null): string | null => (date === null ? null : date.toISOString().slice(0, 10))

// Sans garde : les appelants (lecture de l'écran, verifications) ont déjà contrôlé l'accès.
export async function lireEquipementsDans(ctx: ContexteTeam, avecValeur: boolean): Promise<EquipementLigne[]> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const lignes = await client.garageEquipment.findMany({
    where: { teamId: ctx.teamId, deletedAt: null },
    select: {
      id: true,
      nom: true,
      categorie: true,
      etat: true,
      acheteLe: true,
      valeurCents: true,
      prochainControleLe: true,
      emplacement: true,
    },
  })
  return lignes.map((ligne) => ({
    id: ligne.id,
    nom: ligne.nom,
    categorie: ligne.categorie,
    etat: ligne.etat,
    acheteLe: versDateCivile(ligne.acheteLe),
    valeurCents: avecValeur ? ligne.valeurCents : null,
    prochainControleLe: versDateCivile(ligne.prochainControleLe),
    emplacement: ligne.emplacement,
  }))
}

// L'écran : la liste, et si la personne peut écrire (ajout, modification, retrait).
export async function lireEquipements(): Promise<{ equipements: EquipementLigne[]; peutEcrire: boolean }> {
  const { ctx, niveau } = await accesGarage("lecture")
  const peutEcrire = aAuMoins(niveau, "ecriture")
  return { equipements: await lireEquipementsDans(ctx, peutEcrire), peutEcrire }
}
