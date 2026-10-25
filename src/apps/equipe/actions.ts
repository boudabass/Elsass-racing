"use server"

// Server Actions d'Équipe. N'exportent que des enveloppes des fonctions gardées de services-serveur.ts : chacune
// contrôle elle-même la session et les droits (la garde est dans le service). Renvoient { ok, id? } ou { ok: false, message }.

import { executer, texte, texteOuNull, type Resultat } from "@/core/sdk/actions-serveur"

import type { EntreeAffectation, EntreeDisponibilite, EntreeEquipement, EntreeLicence, EntreePersonne, EntreeProfil, EntreeVivier } from "./services-serveur"
import {
  affecterPersonne,
  ajouterAuVivier,
  ajouterEquipement,
  ajouterLicence,
  changerStatutTache,
  creerPersonne,
  modifierEquipement,
  modifierLicence,
  modifierProfil,
  modifierVivier,
  repondreDisponibilite,
  retirerAffectation,
  retirerDuVivier,
  retirerEquipement,
  retirerLicence,
} from "./services-serveur"
import {
  INTERETS_VIVIER,
  REPONSES_DISPONIBILITE,
  ROLES_EPREUVE,
  ROLES_HABITUELS,
  TYPES_EQUIPEMENT,
  TYPES_LICENCE,
  type InteretVivier,
  type ReponseDisponibilite,
  type RoleEpreuve,
  type RoleHabituel,
  type TypeEquipement,
  type TypeLicence,
} from "./regles"

const CHEMIN = "/apps/equipe"

// Montant saisi en euros (« 12,50 ») vers des centimes entiers. Vide : pas de montant.
function centimesDepuis(valeur: string): number | null {
  if (valeur === "") return null
  const nombre = Number(valeur.replace(",", "."))
  return Number.isFinite(nombre) ? Math.round(nombre * 100) : null
}

function choisi<T extends string>(valeur: string, liste: readonly T[], libelle: string): T {
  if ((liste as readonly string[]).includes(valeur)) return valeur as T
  throw new Error(`${libelle} : valeur inconnue.`)
}

function saisieProfil(donnees: FormData): EntreeProfil {
  return {
    rolesHabituels: donnees.getAll("rolesHabituels").map((role) => choisi(String(role), ROLES_HABITUELS, "Rôle")),
    debutSportAuto: texteOuNull(donnees, "debutSportAuto"),
    tailleVetements: texteOuNull(donnees, "tailleVetements"),
    contactUrgence: texteOuNull(donnees, "contactUrgence"),
    afficherTrophees: donnees.get("afficherTrophees") === "on",
  }
}

function saisieLicence(donnees: FormData): EntreeLicence {
  return {
    type: choisi(texte(donnees, "type"), TYPES_LICENCE as readonly TypeLicence[], "Type de licence"),
    numero: texteOuNull(donnees, "numero"),
    saison: texteOuNull(donnees, "saison"),
    valableDu: texteOuNull(donnees, "valableDu"),
    valableAu: texteOuNull(donnees, "valableAu"),
    asaContactId: texteOuNull(donnees, "asaContactId"),
    documentFileId: texteOuNull(donnees, "documentFileId"),
    montantCents: centimesDepuis(texte(donnees, "montant")),
  }
}

function saisieEquipement(donnees: FormData): EntreeEquipement {
  return {
    type: choisi(texte(donnees, "type"), TYPES_EQUIPEMENT as readonly TypeEquipement[], "Type d'équipement"),
    marque: texteOuNull(donnees, "marque"),
    modele: texteOuNull(donnees, "modele"),
    norme: texteOuNull(donnees, "norme"),
    finHomologation: texteOuNull(donnees, "finHomologation"),
    taille: texteOuNull(donnees, "taille"),
    acheteLe: texteOuNull(donnees, "acheteLe"),
  }
}

export async function creerPersonneAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, () =>
    creerPersonne({
      prenom: texte(donnees, "prenom"),
      nom: texte(donnees, "nom"),
      roleHabituel: choisi(texte(donnees, "roleHabituel"), ROLES_HABITUELS as readonly RoleHabituel[], "Rôle"),
    } satisfies EntreePersonne),
  )
}

export async function modifierProfilAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, async () => {
    await modifierProfil(texte(donnees, "personId"), saisieProfil(donnees))
  })
}

export async function ajouterLicenceAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, () => ajouterLicence(texte(donnees, "personId"), saisieLicence(donnees)))
}

export async function modifierLicenceAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, async () => {
    await modifierLicence(texte(donnees, "id"), saisieLicence(donnees))
  })
}

export async function retirerLicenceAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, async () => {
    await retirerLicence(texte(donnees, "id"))
  })
}

export async function ajouterEquipementAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, () => ajouterEquipement(texte(donnees, "personId"), saisieEquipement(donnees)))
}

export async function modifierEquipementAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, async () => {
    await modifierEquipement(texte(donnees, "id"), saisieEquipement(donnees))
  })
}

export async function retirerEquipementAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, async () => {
    await retirerEquipement(texte(donnees, "id"))
  })
}

export async function repondreDisponibiliteAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, async () => {
    const entree: EntreeDisponibilite = {
      reponse: choisi(texte(donnees, "reponse"), REPONSES_DISPONIBILITE as readonly ReponseDisponibilite[], "Réponse"),
    }
    await repondreDisponibilite(texte(donnees, "personId"), texte(donnees, "eventId"), entree)
  })
}

export async function affecterPersonneAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, () =>
    affecterPersonne(texte(donnees, "eventId"), texte(donnees, "personId"), {
      roleEpreuve: choisi(texte(donnees, "roleEpreuve"), ROLES_EPREUVE as readonly RoleEpreuve[], "Rôle d'épreuve"),
    } satisfies EntreeAffectation),
  )
}

export async function retirerAffectationAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, async () => {
    await retirerAffectation(texte(donnees, "id"))
  })
}

// Une tâche liée se coche par la personne assignée (ou qui a l'écriture) : le service refuse sinon, avec la raison.
export async function changerStatutTacheAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, async () => {
    await changerStatutTache(texte(donnees, "id"), texte(donnees, "fait") === "oui")
  })
}

function saisieVivier(donnees: FormData): EntreeVivier {
  return {
    roleRecherche: choisi(texte(donnees, "roleRecherche"), ROLES_EPREUVE as readonly RoleEpreuve[], "Rôle recherché"),
    source: texteOuNull(donnees, "source"),
    dernierContact: texteOuNull(donnees, "dernierContact"),
    interet: choisi(texte(donnees, "interet"), INTERETS_VIVIER as readonly InteretVivier[], "Intérêt"),
    notes: texteOuNull(donnees, "notes"),
  }
}

export async function ajouterAuVivierAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, () => ajouterAuVivier(texte(donnees, "personId"), saisieVivier(donnees)))
}

export async function modifierVivierAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, async () => {
    await modifierVivier(texte(donnees, "id"), saisieVivier(donnees))
  })
}

export async function retirerDuVivierAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, async () => {
    await retirerDuVivier(texte(donnees, "id"))
  })
}
