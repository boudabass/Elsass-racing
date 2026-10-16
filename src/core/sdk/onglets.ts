// Onglets apportés par les autres apps à une fiche (article 949). Une app déclare l'onglet d'une fiche,
// avec le niveau minimum pour le voir. Le socle ne l'affiche que si l'app est activée pour la team et que
// le membre a au moins ce niveau : l'app fournit le contenu (un composant serveur), jamais la condition.
//
// Réutilisable par Garage, Médias et Check-lists : ajouter un onglet = une entrée dans la liste de la fiche
// et un composant de l'app. Voir docs/app-sdk.md, section « Onglets de fiche ».

import type { ContexteTeam } from "@/core/contexte"
import { niveauDe } from "@/core/actions/actions-serveur"
import { aAuMoins, type Niveau } from "@/core/droits/niveaux"
import { prismaPourTeam } from "@/lib/prisma"

export interface OngletApp {
  cle: string
  libelle: string
  app: string
  niveauMinimum: Niveau
}

// Onglets de la fiche d'une épreuve, apportés par d'autres apps.
export const ONGLETS_FICHE_EPREUVE: readonly OngletApp[] = [{ cle: "depenses", libelle: "Dépenses", app: "budget", niveauMinimum: "contribution" }]

// Sous-ensemble des onglets visibles pour ce membre : app activée et niveau suffisant.
export async function ongletsVisibles(contexte: ContexteTeam, onglets: readonly OngletApp[]): Promise<OngletApp[]> {
  if (onglets.length === 0) return []
  const activees = await prismaPourTeam(contexte.teamId, contexte.userId).coreTeamApp.findMany({
    where: { teamId: contexte.teamId, appCle: { in: Array.from(new Set(onglets.map((onglet) => onglet.app))) }, activee: true, deletedAt: null },
    select: { appCle: true },
  })
  const appsActivees = new Set(activees.map((activation) => activation.appCle))
  const visibles: OngletApp[] = []
  for (const onglet of onglets) {
    if (!appsActivees.has(onglet.app)) continue
    const niveau = await niveauDe(contexte, onglet.app)
    if (aAuMoins(niveau, onglet.niveauMinimum)) visibles.push(onglet)
  }
  return visibles
}
