// Envois refusés par le serveur, gardés sur l'appareil jusqu'à ce que la personne les ait lus (« Compris »). Module pur :
// la décision (ce qu'un refus contient, qui le voit) est ici ; le moteur ne fait que l'écrire et le relire.
//
// Un refus porte la team et le compte qui l'ont fait : un appareil partagé, ou un changement de team, ne montre
// jamais à un compte les refus d'un autre.

import type { OperationEnAttente, TableLocale } from "./base"
import { LIBELLES_TABLES, type LibelleTable } from "./libelles"
import type { ResultatOperation } from "../protocole"

// Raison de repli si le serveur n'en donne pas (une raison vide n'est jamais affichée).
export const RAISON_PAR_DEFAUT = "Le serveur a refusé cet envoi."

export interface RefusLocal {
  idOperation: string
  teamId: string
  userId: string
  table: string
  idLigne: string
  type: "creer" | "modifier" | "supprimer"
  // Libellé de la table, dans le vocabulaire de l'app.
  libelle: string
  // Ce que la personne avait saisi, quand la table le permet ; sinon null.
  resume: string | null
  raison: string
  // Date de la saisie sur l'appareil, et date du refus.
  creeLe: string
  refuseLe: string
}

export interface CompteSynchro {
  teamId: string
  userId: string
}

// Le refus d'une opération : ce que la personne doit savoir pour la reprendre ou l'ignorer.
export function refusDepuisOperation(operation: OperationEnAttente, resultat: ResultatOperation, compte: CompteSynchro, refuseLe: string): RefusLocal {
  // Lecture au cas où la table ne serait pas connue du client (le test de couverture l'interdit).
  const table: LibelleTable | undefined = LIBELLES_TABLES[operation.table as TableLocale]
  return {
    idOperation: operation.idOperation,
    teamId: compte.teamId,
    userId: compte.userId,
    table: operation.table,
    idLigne: operation.id,
    type: operation.type,
    libelle: table?.libelle ?? operation.table,
    resume: operation.champs && table?.resumer ? table.resumer(operation.champs) : null,
    raison: resultat.raison?.trim() || RAISON_PAR_DEFAUT,
    creeLe: operation.creeeLe,
    refuseLe,
  }
}

// Les refus du compte courant seulement, les plus récents d'abord.
export function refusDuCompte(refus: RefusLocal[], compte: CompteSynchro): RefusLocal[] {
  return refus
    .filter((r) => r.teamId === compte.teamId && r.userId === compte.userId)
    .sort((a, b) => b.refuseLe.localeCompare(a.refuseLe))
}

// Titre de l'état dans l'indicateur : « 1 envoi refusé », « 3 envois refusés ».
export function libelleEnvoisRefuses(nombre: number): string {
  return nombre === 1 ? "1 envoi refusé" : `${nombre} envois refusés`
}
