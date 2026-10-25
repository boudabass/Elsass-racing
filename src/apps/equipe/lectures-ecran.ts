// Données des écrans d'Équipe (tâche 5.2). Chaque fonction ouvre sa propre garde (accesEquipe) et rend des données
// prêtes pour l'écran : les pages et les composants ne voient jamais le contexte de session.
import { aAuMoins, type Niveau } from "@/core/droits/niveaux"

import {
  LIBELLES_ROLE_EPREUVE,
  peutChangerTache,
  roleAffectable,
  ROLES_EPREUVE,
  type InteretVivier,
  type RoleEpreuve,
  type StatistiquesBinome,
} from "./regles"
import { accesEquipe, personneDuMembre } from "./services-serveur"
import {
  lireAffectationsEpreuve,
  lireAnciensMembres,
  lireBinomes,
  lireCartesEquipe,
  lireEquipageEpreuve,
  lireFichePersonne,
  lireMembres,
  lireNomsPersonnes,
  lirePresenceProchaineEpreuve,
  lireContactsAsa,
  lireVivier,
  prochaineEpreuve,
  type CarteMembre,
  type EpreuveAVenir,
  type FichePersonne,
  type MembrePersonne,
  type PresenceEpreuve,
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
  // Contacts ASA de la team, pour choisir l'ASA d'une licence.
  asas: Array<{ id: string; nom: string }>
}

// Fiche personne : null si la personne n'existe pas dans cette team (la page répond alors par notFound).
export async function pagePersonne(personId: string): Promise<PagePersonne | null> {
  const { ctx, niveau } = await accesEquipe("lecture")
  const fiche = await lireFichePersonne(ctx, niveau, personId)
  if (!fiche) return null
  const [epreuve, membres, asas] = await Promise.all([prochaineEpreuve(ctx), lireMembres(ctx), lireContactsAsa(ctx)])
  const estMembre = membres.some((membre) => membre.personId === personId)
  return {
    niveau,
    peutEcrire: aAuMoins(niveau, "ecriture"),
    peutVoirRessenti: aAuMoins(niveau, "ecriture"),
    statutDansEquipe: estMembre ? "membre" : "ancien",
    fiche,
    epreuve,
    asas,
  }
}

// --- Binômes (lecture) -------------------------------------------------------------------------------------

export interface BinomeAffiche {
  cle: string
  pilote: string
  copilote: string
  stats: StatistiquesBinome
}

export interface PageBinomes {
  binomes: BinomeAffiche[]
}

// Binômes de la team : pilote et copilote, avec leurs chiffres sur les épreuves à résultat validé.
export async function pageBinomes(): Promise<PageBinomes> {
  const { ctx } = await accesEquipe("lecture")
  const binomes = await lireBinomes(ctx)
  const noms = await lireNomsPersonnes(ctx, binomes.flatMap((binome) => [binome.piloteId, binome.copiloteId]))
  return {
    binomes: binomes.map((binome) => ({
      cle: `${binome.piloteId}|${binome.copiloteId}`,
      pilote: noms.get(binome.piloteId) ?? "Personne retirée",
      copilote: noms.get(binome.copiloteId) ?? "Personne retirée",
      stats: binome.stats,
    })),
  }
}

// --- Vivier (écriture et plus) -------------------------------------------------------------------------------

export interface EntreeVivierAffichee {
  id: string
  personId: string
  nom: string
  roleRecherche: RoleEpreuve
  source: string | null
  dernierContact: Date | null
  interet: InteretVivier
  notes: string | null
}

export interface PageVivier {
  entrees: EntreeVivierAffichee[]
  // Personnes actives, pour le choix d'une personne à mettre au vivier.
  personnes: Array<{ personId: string; nom: string }>
}

export async function pageVivier(): Promise<PageVivier> {
  const { ctx } = await accesEquipe("ecriture")
  const [entrees, membres] = await Promise.all([lireVivier(ctx), lireMembres(ctx)])
  const noms = await lireNomsPersonnes(ctx, entrees.map((entree) => entree.personId))
  return {
    entrees: entrees.map((entree) => ({ ...entree, nom: noms.get(entree.personId) ?? "Personne retirée" })),
    personnes: membres.map((membre) => ({ personId: membre.personId, nom: `${membre.prenom} ${membre.nom}` })),
  }
}

// --- Prochaine épreuve (lecture ; écriture pour affecter et retirer) -----------------------------------------

export interface TacheAffichee {
  id: string
  titre: string
  fait: boolean
  // La personne assignée (ou qui a l'écriture) peut la changer ; sinon, la raison est dite dans l'écran.
  peutChanger: boolean
}

export interface AffectationAffichee {
  id: string
  personId: string
  nom: string
  roleEpreuve: RoleEpreuve
  roleLibelle: string
  taches: TacheAffichee[]
}

export interface EquipageAffiche {
  engagementId: string
  pilote: string | null
  copilote: string | null
}

export interface PageEpreuve {
  peutEcrire: boolean
  epreuve: EpreuveAVenir | null
  presence: PresenceEpreuve
  equipage: EquipageAffiche[]
  affectations: AffectationAffichee[]
  // Personnes actives et rôles d'épreuve qu'on peut affecter (pilote et copilote exclus : ils se choisissent dans Saison).
  personnes: Array<{ personId: string; nom: string }>
  roles: Array<{ role: RoleEpreuve; libelle: string }>
}

export async function pageEpreuve(): Promise<PageEpreuve> {
  const { ctx, niveau } = await accesEquipe("lecture")
  const peutEcrire = aAuMoins(niveau, "ecriture")
  const epreuve = await prochaineEpreuve(ctx)
  if (!epreuve) {
    const presence = await lirePresenceProchaineEpreuve(ctx)
    return { peutEcrire, epreuve: null, presence, equipage: [], affectations: [], personnes: [], roles: [] }
  }

  const monPersonId = await personneDuMembre(ctx)
  const [presence, lignesEquipage, affectations, membres] = await Promise.all([
    lirePresenceProchaineEpreuve(ctx),
    lireEquipageEpreuve(ctx, epreuve.eventId),
    lireAffectationsEpreuve(ctx, epreuve.eventId),
    lireMembres(ctx),
  ])
  const noms = await lireNomsPersonnes(ctx, [
    ...lignesEquipage.flatMap((ligne) => [ligne.piloteId, ligne.copiloteId]).filter((id): id is string => id !== null),
    ...affectations.map((affectation) => affectation.personId),
  ])
  const nomDe = (personId: string | null) => (personId ? (noms.get(personId) ?? "Personne retirée") : null)

  return {
    peutEcrire,
    epreuve,
    presence,
    equipage: lignesEquipage.map((ligne) => ({ engagementId: ligne.engagementId, pilote: nomDe(ligne.piloteId), copilote: nomDe(ligne.copiloteId) })),
    affectations: affectations.map((affectation) => ({
      id: affectation.id,
      personId: affectation.personId,
      nom: nomDe(affectation.personId) ?? "Personne retirée",
      roleEpreuve: affectation.roleEpreuve,
      roleLibelle: LIBELLES_ROLE_EPREUVE[affectation.roleEpreuve],
      taches: affectation.taches.map((tache) => ({
        id: tache.id,
        titre: tache.titre,
        fait: tache.fait,
        peutChanger: peutChangerTache(niveau, monPersonId, tache.assigneePersonId),
      })),
    })),
    personnes: membres.map((membre) => ({ personId: membre.personId, nom: `${membre.prenom} ${membre.nom}` })),
    roles: ROLES_EPREUVE.filter(roleAffectable).map((role) => ({ role, libelle: LIBELLES_ROLE_EPREUVE[role] })),
  }
}
