// Données des écrans d'Équipe (tâche 5.2). Chaque fonction ouvre sa propre garde (accesEquipe) et rend des données
// prêtes pour l'écran : les pages et les composants ne voient jamais le contexte de session.
import { aAuMoins, type Niveau } from "@/core/droits/niveaux"

import { accesEquipe } from "./services-serveur"
import {
  lireAnciensMembres,
  lireCartesEquipe,
  lireFichePersonne,
  lireMembres,
  prochaineEpreuve,
  type CarteMembre,
  type EpreuveAVenir,
  type FichePersonne,
  type MembrePersonne,
} from "./lectures-serveur"

export interface PageEquipe {
  peutEcrire: boolean
  cartes: CarteMembre[]
  anciens: MembrePersonne[]
  epreuve: EpreuveAVenir | null
}

export async function pageEquipe(): Promise<PageEquipe> {
  const { ctx, niveau } = await accesEquipe("lecture")
  const [cartes, anciens, epreuve] = await Promise.all([lireCartesEquipe(ctx), lireAnciensMembres(ctx), prochaineEpreuve(ctx)])
  return { peutEcrire: aAuMoins(niveau, "ecriture"), cartes, anciens, epreuve }
}

// Où en est la personne dans l'équipe : membre actif (ou créée dans Équipe), ancien membre (historique gardé).
export type StatutDansEquipe = "membre" | "ancien"

export interface PagePersonne {
  niveau: Niveau
  peutEcrire: boolean
  // L'onglet Ressenti existe au niveau écriture seulement (équipage et responsable).
  peutVoirRessenti: boolean
  statutDansEquipe: StatutDansEquipe
  fiche: FichePersonne
  epreuve: EpreuveAVenir | null
}

// Fiche personne : null si la personne n'existe pas dans cette team (la page répond alors par notFound).
export async function pagePersonne(personId: string): Promise<PagePersonne | null> {
  const { ctx, niveau } = await accesEquipe("lecture")
  const fiche = await lireFichePersonne(ctx, niveau, personId)
  if (!fiche) return null
  const [epreuve, membres] = await Promise.all([prochaineEpreuve(ctx), lireMembres(ctx)])
  const estMembre = membres.some((membre) => membre.personId === personId)
  return {
    niveau,
    peutEcrire: aAuMoins(niveau, "ecriture"),
    peutVoirRessenti: aAuMoins(niveau, "ecriture"),
    statutDansEquipe: estMembre ? "membre" : "ancien",
    fiche,
    epreuve,
  }
}
