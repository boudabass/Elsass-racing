"use server"

// Server Actions de Documents. N'exportent que des enveloppes des fonctions gardées de services-serveur.ts : chacune
// contrôle elle-même la session et les droits (la garde est dans le service). Renvoient { ok, id? } ou { ok: false, message }.

import { revalidatePath } from "next/cache"

import { executer, journaliserErreurInattendue, messageDe, texte, texteOuNull, type Resultat } from "@/core/sdk/actions-serveur"

import { creerLienPartage, revoquerLienPartage } from "./partages-serveur"

import {
  ajouterVersion,
  archiverDocument,
  creerDocument,
  creerDossier,
  deplacerDocument,
  modifierDocument,
  modifierDossier,
  partagerDocument,
  remettreEnService,
  retirerAcces,
  supprimerDossier,
  type EntreeDocument,
  type EntreeModificationDocument,
} from "./services-serveur"
import { NIVEAUX_ACCES_INTERNE, TYPES_DOCUMENT, VISIBILITES, type NiveauAcces, type TypeDocument, type Visibilite } from "./regles"

const CHEMIN = "/apps/documents"

function choisi<T extends string>(valeur: string, liste: readonly T[], libelle: string): T {
  if ((liste as readonly string[]).includes(valeur)) return valeur as T
  throw new Error(`${libelle} : valeur inconnue.`)
}

function visibiliteOptionnelle(donnees: FormData): Visibilite | undefined {
  const valeur = texteOuNull(donnees, "visibilite")
  return valeur ? choisi(valeur, VISIBILITES, "Visibilité") : undefined
}

function saisieDocument(donnees: FormData): EntreeDocument {
  return {
    titre: texte(donnees, "titre"),
    typeDocument: choisi(texte(donnees, "typeDocument"), TYPES_DOCUMENT as readonly TypeDocument[], "Type de document"),
    dossier: texte(donnees, "dossier"),
    reference: texteOuNull(donnees, "reference"),
    dateEmission: texteOuNull(donnees, "dateEmission"),
    dateValidite: texteOuNull(donnees, "dateValidite"),
    notes: texteOuNull(donnees, "notes"),
    visibilite: visibiliteOptionnelle(donnees),
    fichierId: texteOuNull(donnees, "fichierId"),
    commentaire: texteOuNull(donnees, "commentaire"),
  }
}

// Modification : les champs absents du formulaire restent inchangés (écriture partielle).
function saisieModification(donnees: FormData): EntreeModificationDocument {
  return {
    titre: texte(donnees, "titre"),
    typeDocument: choisi(texte(donnees, "typeDocument"), TYPES_DOCUMENT as readonly TypeDocument[], "Type de document"),
    reference: texteOuNull(donnees, "reference"),
    dateEmission: texteOuNull(donnees, "dateEmission"),
    dateValidite: texteOuNull(donnees, "dateValidite"),
    notes: texteOuNull(donnees, "notes"),
    visibilite: visibiliteOptionnelle(donnees),
  }
}

export async function creerDossierAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, () => creerDossier({ nom: texte(donnees, "nom"), visibilite: visibiliteOptionnelle(donnees) }))
}

export async function modifierDossierAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, async () => {
    await modifierDossier(texte(donnees, "id"), { nom: texte(donnees, "nom"), visibilite: visibiliteOptionnelle(donnees) })
  })
}

export async function supprimerDossierAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, async () => {
    await supprimerDossier(texte(donnees, "id"))
  })
}

export async function creerDocumentAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, () => creerDocument(saisieDocument(donnees)))
}

export async function modifierDocumentAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, async () => {
    await modifierDocument(texte(donnees, "id"), saisieModification(donnees))
  })
}

export async function ajouterVersionAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, () => ajouterVersion(texte(donnees, "id"), texte(donnees, "fichierId"), texteOuNull(donnees, "commentaire")))
}

export async function deplacerDocumentAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, async () => {
    await deplacerDocument(texte(donnees, "id"), texte(donnees, "dossier"))
  })
}

export async function archiverDocumentAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, async () => {
    await archiverDocument(texte(donnees, "id"))
  })
}

export async function remettreEnServiceAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, async () => {
    await remettreEnService(texte(donnees, "id"))
  })
}

export async function partagerDocumentAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, async () => {
    const niveau = choisi(texte(donnees, "niveau"), NIVEAUX_ACCES_INTERNE as readonly NiveauAcces[], "Niveau d'accès")
    await partagerDocument(texte(donnees, "id"), texte(donnees, "personneId"), niveau)
  })
}

export async function retirerAccesAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, async () => {
    await retirerAcces(texte(donnees, "id"))
  })
}

// Création d'un lien : le jeton part vers le navigateur une seule fois, dans ce résultat. Il n'est jamais relu ensuite.
export type ResultatLien = { ok: true; id: string; jeton: string; finLe: string } | { ok: false; message: string }

export async function creerLienPartageAction(_etat: ResultatLien | null, donnees: FormData): Promise<ResultatLien> {
  try {
    const contact = texteOuNull(donnees, "contactId")
    const lien = await creerLienPartage(texte(donnees, "id"), {
      destinataire: texte(donnees, "destinataire"),
      contactId: contact,
      jours: Number(texte(donnees, "jours")),
    })
    revalidatePath(CHEMIN, "layout")
    return { ok: true, id: lien.shareId, jeton: lien.jeton, finLe: lien.finLe.toISOString() }
  } catch (erreur) {
    journaliserErreurInattendue(CHEMIN, erreur)
    return { ok: false, message: messageDe(erreur) }
  }
}

export async function revoquerLienPartageAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, async () => {
    await revoquerLienPartage(texte(donnees, "id"))
  })
}
