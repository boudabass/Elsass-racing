// Base locale du navigateur (IndexedDB), une par compte et par team : elsass-racing-<userId>-<teamId>.
// Un magasin par table synchronisable, un magasin des opérations en attente, un magasin des curseurs.

import { openDB, type DBSchema, type IDBPDatabase } from "idb"

import type { LigneSynchro, Operation } from "../protocole"

export const PREFIXE_BASE = "elsass-racing-"

// Ligne locale : ligne du serveur, plus l'indicateur d'une écriture pas encore envoyée.
export interface LigneLocale extends LigneSynchro {
  enAttente?: boolean
}

export interface OperationEnAttente extends Operation {
  creeeLe: string
  tentatives: number
}

export interface CurseurLocal {
  table: string
  curseur: string | null
}

export interface SchemaLocal extends DBSchema {
  core_note: { key: string; value: LigneLocale }
  core_event: { key: string; value: LigneLocale }
  saison_stage: { key: string; value: LigneLocale }
  saison_schedule_item: { key: string; value: LigneLocale }
  saison_recce: { key: string; value: LigneLocale }
  saison_recce_session: { key: string; value: LigneLocale }
  saison_debrief: { key: string; value: LigneLocale }
  budget_expense: { key: string; value: LigneLocale }
  budget_category: { key: string; value: LigneLocale }
  budget_payer: { key: string; value: LigneLocale }
  voiture_setup: { key: string; value: LigneLocale }
  core_vehicle: { key: string; value: LigneLocale }
  voiture_setup_template: { key: string; value: LigneLocale }
  operations_en_attente: { key: string; value: OperationEnAttente }
  curseurs: { key: string; value: CurseurLocal }
}

export const TABLES_LOCALES = ["core_note", "core_event", "saison_stage", "saison_schedule_item", "saison_recce", "saison_recce_session", "saison_debrief", "budget_expense", "budget_category", "budget_payer", "voiture_setup", "core_vehicle", "voiture_setup_template"] as const
export type TableLocale = (typeof TABLES_LOCALES)[number]

export function nomBase(userId: string, teamId: string): string {
  return `${PREFIXE_BASE}${userId}-${teamId}`
}

// Version 2 : magasins de Saison. Version 3 : magasins de Budget. Version 4 : magasins de Voiture (fiches de
// réglage, et véhicules et références en lecture seule). Une base plus ancienne reçoit les magasins manquants à
// l'ouverture.
export const VERSION_BASE = 4

export function ouvrirBase(userId: string, teamId: string): Promise<IDBPDatabase<SchemaLocal>> {
  return openDB<SchemaLocal>(nomBase(userId, teamId), VERSION_BASE, {
    upgrade(db) {
      const magasins: string[] = [...TABLES_LOCALES, "operations_en_attente", "curseurs"]
      for (const magasin of magasins) {
        if (magasin === "operations_en_attente") {
          if (!db.objectStoreNames.contains("operations_en_attente")) db.createObjectStore("operations_en_attente", { keyPath: "idOperation" })
        } else if (magasin === "curseurs") {
          if (!db.objectStoreNames.contains("curseurs")) db.createObjectStore("curseurs", { keyPath: "table" })
        } else if (!db.objectStoreNames.contains(magasin as TableLocale)) {
          db.createObjectStore(magasin as TableLocale, { keyPath: "id" })
        }
      }
    },
  })
}

// Supprime de l'appareil les bases des comptes déconnectés. Une base qui a encore des
// modifications non envoyées est gardée : les effacer perdrait ces modifications.
export async function nettoyerBasesDeconnectees(): Promise<number> {
  if (typeof indexedDB === "undefined" || !indexedDB.databases) return 0
  let supprimees = 0
  for (const { name } of await indexedDB.databases()) {
    if (!name?.startsWith(PREFIXE_BASE)) continue
    const version = await openDB(name)
    const enAttente = await version.count("operations_en_attente")
    version.close()
    if (enAttente > 0) continue
    await new Promise<void>((resolve) => {
      const demande = indexedDB.deleteDatabase(name)
      demande.onsuccess = () => resolve()
      demande.onerror = () => resolve()
      demande.onblocked = () => resolve()
    })
    supprimees++
  }
  await supprimerCachesDeLApp()
  return supprimees
}

// Pages et ressources mises en cache par le service worker : elles peuvent contenir des données de
// la team. Elles sont retirées à la déconnexion. Les modifications en attente, elles, sont dans IndexedDB.
export async function supprimerCachesDeLApp(): Promise<void> {
  if (typeof caches === "undefined") return
  for (const cle of await caches.keys()) {
    if (cle.indexOf(PREFIXE_BASE) === 0) await caches.delete(cle)
  }
}
