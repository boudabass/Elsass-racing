// Contrôles de lecture des fichiers (tâche 5.8, §3.1). Le niveau d'app ne suffit pas : le fichier d'un document dans
// un dossier caché, d'un ticket d'une autre personne ou d'une photo d'ordre non affecté se lit seulement si la fiche
// elle-même le permet. Chaque app déclare le contrôle de ses fiches (comme controleContribution en 5.6b) ; le socle ne
// connaît pas ce qu'elles contrôlent. Les apps s'enregistrent par src/apps/controles-lecture-serveur.ts.
//
// Un contrôle renvoie vrai ou faux, sans lever : un refus donne 404 côté route, rien d'autre ne sort.

import type { ContexteTeam } from "@/core/contexte"
import { aAuMoins, type Niveau } from "@/core/droits/niveaux"

export interface ControleLecture {
  app: string
  ficheType: string
  // Vrai si la personne peut lire le fichier rattaché à cette fiche (identifiant de la fiche, pas du fichier).
  peutLire(ctx: ContexteTeam, ficheId: string): Promise<boolean>
}

export interface RattachementLecture {
  app: string
  ficheType: string
  ficheId: string
}

const controles = new Map<string, ControleLecture>()

const cleControle = (app: string, ficheType: string) => `${app}:${ficheType}`

// Un nouveau contrôle remplace l'ancien pour la même fiche (rechargement à chaud en développement).
export function enregistrerControleLecture(controle: ControleLecture): void {
  controles.set(cleControle(controle.app, controle.ficheType), controle)
}

export function controleLecturePour(app: string, ficheType: string): ControleLecture | null {
  return controles.get(cleControle(app, ficheType)) ?? null
}

// Un rattachement est ouvert si le niveau de son app donne au moins la lecture, et si son contrôle (s'il en a un) l'accorde.
// Le contrôle n'est pas appelé quand le niveau refuse déjà.
export async function rattachementOuvert(ctx: ContexteTeam, rattachement: RattachementLecture, niveau: Niveau | undefined): Promise<boolean> {
  if (!aAuMoins(niveau ?? "aucun", "lecture")) return false
  const controle = controleLecturePour(rattachement.app, rattachement.ficheType)
  if (!controle) return true
  return controle.peutLire(ctx, rattachement.ficheId)
}
