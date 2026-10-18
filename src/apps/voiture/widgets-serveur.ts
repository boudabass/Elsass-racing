// Widgets de Voiture (tâche 3.3, brief section 8) : deux lectures, sans affichage (le Tableau de bord arrive au
// lot 6). Chaque lecture a sa variante « …Dans(ctx, …) » pour être testée en base, comme celles de Budget.
// Sans accès, un widget renvoie null (rien plutôt qu'un chiffre qui ne revient pas au membre).

import { ErreurAcces } from "@/core/droits/erreurs"
import type { ContexteTeam } from "@/core/contexte"
import { prismaPourTeam } from "@/lib/prisma"

import { libelleDuPapier, libelleEmplacementsLibres, libellePapiersARenouveler, type TypePapier } from "./libelles"
import { papiersARenouveler, type StatutPapier } from "./regles"
import { accesVoiture } from "./services-serveur"

export interface WidgetPapiers {
  nombre: number
  libelle: string
  // Le premier à traiter : un papier expiré passe avant un papier à renouveler.
  premier: { titre: string; vehicule: string; statut: Exclude<StatutPapier, "valide">; echeance: Date | null } | null
}

// Papiers à renouveler ou expirés, tous véhicules actifs confondus.
export async function widgetPapiersARenouvelerDans(ctx: ContexteTeam, maintenant: Date): Promise<WidgetPapiers> {
  const papiers = await prismaPourTeam(ctx.teamId, ctx.userId).voiturePaper.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, vehicle: { actif: true, deletedAt: null } },
    select: { type: true, libelle: true, valableJusquAu: true, vehicle: { select: { nomCourt: true } } },
  })
  const liste = papiersARenouveler(papiers, maintenant)
  const premier = liste[0]
  return {
    nombre: liste.length,
    libelle: libellePapiersARenouveler(liste.length),
    premier: premier
      ? {
          titre: libelleDuPapier(premier.type as TypePapier, premier.libelle),
          vehicule: premier.vehicle.nomCourt,
          statut: premier.statut as Exclude<StatutPapier, "valide">,
          echeance: premier.valableJusquAu,
        }
      : null,
  }
}

export async function widgetPapiersARenouveler(): Promise<WidgetPapiers | null> {
  try {
    const { ctx } = await accesVoiture("lecture")
    return await widgetPapiersARenouvelerDans(ctx, new Date())
  } catch (erreur) {
    if (erreur instanceof ErreurAcces) return null
    throw erreur
  }
}

export interface WidgetEmplacements {
  nombre: number
  libelle: string
}

// Emplacements libres, tous véhicules actifs confondus. Le statut est tenu à jour par le service (recalculerStatutEmplacement).
export async function widgetEmplacementsLibresDans(ctx: ContexteTeam): Promise<WidgetEmplacements> {
  const nombre = await prismaPourTeam(ctx.teamId, ctx.userId).voitureSlot.count({
    where: { teamId: ctx.teamId, deletedAt: null, statut: "libre", vehicle: { actif: true, deletedAt: null } },
  })
  return { nombre, libelle: libelleEmplacementsLibres(nombre) }
}

export async function widgetEmplacementsLibres(): Promise<WidgetEmplacements | null> {
  try {
    const { ctx } = await accesVoiture("lecture")
    return await widgetEmplacementsLibresDans(ctx)
  } catch (erreur) {
    if (erreur instanceof ErreurAcces) return null
    throw erreur
  }
}
