// Moteur de synchro côté navigateur. Écrit tout de suite en local (l'écran suit), range l'écriture
// dans la file, puis pousse la file et tire les changements. Hors ligne, rien n'est perdu : la file
// attend le retour du réseau. Aucune réécriture d'identifiant : les id sont créés ici (UUID v7).

import type { IDBPDatabase } from "idb"

import { newId } from "../../ids"
import { delaiAvantNouvelEssai } from "../attente"
import { LIMITE_OPERATIONS, type LigneSynchro, type Operation, type ResultatOperation } from "../protocole"

import { ouvrirBase, type LigneLocale, type OperationEnAttente, type SchemaLocal, type TableLocale, TABLES_LOCALES } from "./base"
import { refusDepuisOperation, refusDuCompte, type RefusLocal } from "./refus"

const DELAI_ECRITURE_MS = 2000
const INTERVALLE_MS = 60_000

export interface EtatSynchro {
  enLigne: boolean
  enAttente: number
  // Envois refusés par le serveur, pas encore lus par la personne (du compte courant).
  refus: number
  derniereSync: string | null
  erreur: string | null
}

// État d'un moteur neuf. Sert d'instantané serveur à useSyncExternalStore : pendant l'hydratation, React exige que le
// client rende ce que le serveur a rendu. Jamais l'état vivant (voir react.tsx).
export const ETAT_INITIAL: EtatSynchro = { enLigne: true, enAttente: 0, refus: 0, derniereSync: null, erreur: null }

type Ecouteur = () => void

// Champs modifiables d'une ligne : validés par la table côté serveur.
export type ChampsEcriture = Record<string, unknown>

// Version lue à mettre dans une modification (revLue), jamais 0 : le serveur refuse revLue < 1 (protocole.ts).
// Une ligne créée sur cet appareil a rev 0 tant que sa création n'est pas confirmée. Si cette création part (ou
// est en vol), elle est appliquée avant la modification et prend rev 1 : la création serveur part toujours de rev 1
// (prisma/schema.prisma, rev @default(1)). Une ligne en rev 0 sans création en attente ne doit pas exister : on le
// signale en développement, et on garde rev 1.
export function versionLue(ligne: LigneLocale, operationsDeLigne: OperationEnAttente[]): number {
  if (ligne.rev >= 1) return ligne.rev
  const creationEnVol = operationsDeLigne.some((o) => o.type === "creer")
  if (!creationEnVol && process.env.NODE_ENV !== "production") {
    console.error("[synchro] ligne en rev 0 sans création en attente :", ligne.id)
  }
  return 1
}

export class MoteurSynchro {
  // Ouverture paresseuse et partagée : une lecture qui arrive avant demarrer() attend la même ouverture.
  private ouverture: Promise<IDBPDatabase<SchemaLocal>> | null = null
  private ecouteurs = new Set<Ecouteur>()
  private ecouteursServeur = new Set<Ecouteur>()
  private serveurAApplique = false
  private etat: EtatSynchro = { ...ETAT_INITIAL }
  private minuteur: ReturnType<typeof setTimeout> | null = null
  private intervalle: ReturnType<typeof setInterval> | null = null
  private echecs = 0
  private occupe = false
  private relancer = false
  private demarre = false
  // Verrou de la file : une écriture locale et la lecture du paquet à envoyer ne se font pas l'une pendant l'autre.
  // Il n'est tenu que pour la lecture ou l'écriture de la file, jamais pendant l'appel réseau.
  private verrou: Promise<unknown> = Promise.resolve()
  // Opérations parties dans un paquet et pas encore notées : une écriture ne les fusionne plus.
  private enVol = new Set<string>()

  private gestionReseau = () => this.surReseau()
  private gestionVisibilite = () => {
    if (document.visibilityState === "visible") this.planifier(0)
  }

  constructor(
    private readonly userId: string,
    private readonly teamId: string,
  ) {}

  async demarrer(): Promise<void> {
    if (this.demarre) return
    this.demarre = true
    const db = await this.bd()
    this.etat = { ...this.etat, enLigne: navigator.onLine, enAttente: await db.count("operations_en_attente"), refus: await this.compterRefus() }
    window.addEventListener("online", this.gestionReseau)
    window.addEventListener("offline", this.gestionReseau)
    document.addEventListener("visibilitychange", this.gestionVisibilite)
    this.intervalle = setInterval(() => {
      if (document.visibilityState === "visible") this.planifier(0)
    }, INTERVALLE_MS)
    this.notifier()
    this.planifier(0)
  }

  arreter(): void {
    window.removeEventListener("online", this.gestionReseau)
    window.removeEventListener("offline", this.gestionReseau)
    document.removeEventListener("visibilitychange", this.gestionVisibilite)
    if (this.intervalle) clearInterval(this.intervalle)
    if (this.minuteur) clearTimeout(this.minuteur)
    this.intervalle = null
    this.minuteur = null
    this.demarre = false
  }

  abonner(ecouteur: Ecouteur): () => void {
    this.ecouteurs.add(ecouteur)
    return () => {
      this.ecouteurs.delete(ecouteur)
    }
  }

  // Écouteurs prévenus quand le serveur a appliqué des opérations : il a pu créer des actions (boîte) ou
  // changer des chiffres (solde, compteur) que l'écran, rendu côté serveur, ne connaît pas encore.
  abonnerAuServeur(ecouteur: Ecouteur): () => void {
    this.ecouteursServeur.add(ecouteur)
    return () => {
      this.ecouteursServeur.delete(ecouteur)
    }
  }

  lireEtat(): EtatSynchro {
    return this.etat
  }

  // Envois refusés du compte courant, les plus récents d'abord. Une personne les lit et les efface (« Compris »).
  async lireRefus(): Promise<RefusLocal[]> {
    return refusDuCompte(await (await this.bd()).getAll("refus_synchro"), { teamId: this.teamId, userId: this.userId })
  }

  async effacerRefus(idOperation: string): Promise<void> {
    await (await this.bd()).delete("refus_synchro", idOperation)
    await this.rafraichirCompteur()
    this.notifier()
  }

  // Lignes d'une table, sans les supprimées.
  async lireTable(table: TableLocale): Promise<LigneLocale[]> {
    const lignes = await (await this.bd()).getAll(table)
    return lignes.filter((l) => l.deletedAt === null)
  }

  // Écriture locale : l'écran se met à jour tout de suite, et l'opération part dans la file.
  async ecrireLocal(table: TableLocale, operation: { type: "creer" | "modifier" | "supprimer"; id: string; champs?: ChampsEcriture }): Promise<void> {
    await this.exclusif(() => this.ecrireLocalSousVerrou(table, operation))
    await this.rafraichirCompteur()
    this.notifier()
    this.planifier(DELAI_ECRITURE_MS)
  }

  // Une écriture et son effet sur la file tiennent dans une seule transaction IndexedDB (les magasins de la table et de la file).
  // Une modification d'une ligne créée et pas encore envoyée se fond dans la création ; une suppression de cette ligne
  // retire la création et ses modifications, rien ne part au serveur.
  private async ecrireLocalSousVerrou(table: TableLocale, operation: { type: "creer" | "modifier" | "supprimer"; id: string; champs?: ChampsEcriture }): Promise<void> {
    const db = await this.bd()
    const maintenant = new Date().toISOString()
    const tx = db.transaction([table, "operations_en_attente"], "readwrite")
    const magasin = tx.objectStore(table)
    const file = tx.objectStore("operations_en_attente")
    const surLigne = (await file.getAll()).filter((o) => o.table === table && o.id === operation.id)
    const creationEnFile = surLigne.find((o) => o.type === "creer" && !this.enVol.has(o.idOperation))
    const modificationEnFile = surLigne.find((o) => o.type === "modifier" && !this.enVol.has(o.idOperation))
    const nouvelleOperation = (revLue?: number): OperationEnAttente => ({
      idOperation: newId(),
      table,
      type: operation.type,
      id: operation.id,
      ...(revLue !== undefined ? { revLue } : {}),
      ...(operation.champs ? { champs: operation.champs } : {}),
      creeeLe: maintenant,
      tentatives: 0,
    })

    if (operation.type === "creer") {
      await magasin.put({
        id: operation.id,
        rev: 0,
        createdAt: maintenant,
        updatedAt: maintenant,
        deletedAt: null,
        createdBy: this.userId,
        updatedBy: this.userId,
        ...operation.champs,
        enAttente: true,
      })
      await file.put(nouvelleOperation())
      await tx.done
      return
    }

    const existante = await magasin.get(operation.id)
    if (!existante) throw new Error("Cet élément n'est pas sur cet appareil.")

    if (operation.type === "modifier") {
      if (creationEnFile) {
        // Pas encore envoyée : les champs se fondent dans la création, sans nouvelle opération.
        await file.put({ ...creationEnFile, champs: { ...creationEnFile.champs, ...operation.champs } })
        await magasin.put({ ...existante, ...operation.champs, updatedAt: maintenant, enAttente: true })
      } else if (modificationEnFile) {
        // Modification pas encore envoyée sur la même ligne : les champs se fondent dans elle. Sa version lue reste
        // celle de la première : c'est la version que la ligne avait avant ces modifications.
        await file.put({ ...modificationEnFile, champs: { ...modificationEnFile.champs, ...operation.champs } })
        await magasin.put({ ...existante, ...operation.champs, updatedAt: maintenant, enAttente: true })
      } else {
        await magasin.put({ ...existante, ...operation.champs, updatedAt: maintenant, enAttente: true })
        await file.put(nouvelleOperation(versionLue(existante, surLigne)))
      }
      await tx.done
      return
    }

    // Suppression.
    if (creationEnFile) {
      // Une ligne jamais envoyée disparaît sans rien envoyer : sa création et ses modifications sortent de la file.
      for (const o of surLigne) if (!this.enVol.has(o.idOperation)) await file.delete(o.idOperation)
      await magasin.delete(operation.id)
    } else {
      await magasin.put({ ...existante, deletedAt: maintenant, updatedAt: maintenant, enAttente: true })
      await file.put(nouvelleOperation(versionLue(existante, surLigne)))
    }
    await tx.done
  }

  // Ordre d'une synchro : pousser la file, puis tirer. Une seule à la fois.
  async synchroniser(): Promise<void> {
    if (this.occupe) {
      this.relancer = true
      return
    }
    if (!navigator.onLine) {
      this.passerHorsLigne()
      return
    }
    this.occupe = true
    this.etat = { ...this.etat, erreur: null }
    this.notifier()
    try {
      await this.pousser()
      if (this.serveurAApplique) {
        this.serveurAApplique = false
        Array.from(this.ecouteursServeur).forEach((ecouteur) => ecouteur())
      }
      await this.tirer()
      this.echecs = 0
      this.etat = { ...this.etat, enLigne: true, derniereSync: new Date().toISOString(), erreur: null }
    } catch (erreur) {
      this.echecs++
      const message = erreur instanceof Error ? erreur.message : "La synchronisation a échoué."
      this.etat = { ...this.etat, enLigne: navigator.onLine, erreur: message }
      this.planifier(delaiAvantNouvelEssai(this.echecs))
    } finally {
      this.occupe = false
      await this.rafraichirCompteur()
      this.notifier()
      if (this.relancer) {
        this.relancer = false
        this.planifier(0)
      }
    }
  }

  // Envoi de la file, par paquets. Une opération notée (appliquée, conflit ou refusée) sort de la file. Chaque paquet
  // est lu dans le verrou, au moment de partir : une écriture faite entre deux paquets est donc prise en compte.
  // Une opération qui reste sans réponse n'est pas renvoyée dans la même passe (pas de boucle).
  private async pousser(): Promise<void> {
    const db = await this.bd()
    const vuesDansLaPasse = new Set<string>()
    for (;;) {
      const paquet = await this.exclusif(async () => {
        const prochaines = (await db.getAll("operations_en_attente"))
          .filter((o) => !this.enVol.has(o.idOperation) && !vuesDansLaPasse.has(o.idOperation))
          .sort((a, b) => a.creeeLe.localeCompare(b.creeeLe))
          .slice(0, LIMITE_OPERATIONS)
        for (const o of prochaines) {
          this.enVol.add(o.idOperation)
          vuesDansLaPasse.add(o.idOperation)
        }
        return prochaines
      })
      if (paquet.length === 0) return
      try {
        const operations: Operation[] = paquet.map((o) => ({
          idOperation: o.idOperation,
          table: o.table,
          type: o.type,
          id: o.id,
          ...(o.revLue !== undefined ? { revLue: o.revLue } : {}),
          ...(o.champs ? { champs: o.champs } : {}),
        }))
        const reponse = await this.appeler("/api/synchro/pousser", { operations })
        const { resultats } = (await reponse.json()) as { resultats: ResultatOperation[] }
        for (const resultat of resultats) {
          const operation = paquet.find((o) => o.idOperation === resultat.idOperation)
          if (!operation) continue
          if (resultat.statut === "appliquee") this.serveurAApplique = true
          await this.exclusif(async () => {
            await db.delete("operations_en_attente", operation.idOperation)
            await this.libererLigne(operation, resultat)
          })
        }
      } finally {
        for (const o of paquet) this.enVol.delete(o.idOperation)
      }
    }
  }

  // Exécute un travail sur la file, un à la fois.
  private exclusif<T>(travail: () => Promise<T>): Promise<T> {
    const suite = this.verrou.then(() => travail())
    this.verrou = suite.catch(() => undefined)
    return suite
  }

  // Une fois l'opération notée, la ligne locale n'est plus « en attente » (sauf s'il reste une autre
  // opération sur la même ligne). Un refus est gardé pour la personne (refus_synchro), même si d'autres
  // opérations restent sur la ligne. Une création refusée est retirée de l'écran ; une modification ou une
  // suppression refusée remet la table à relire : la ligne reprend la valeur du serveur au tirage suivant.
  private async libererLigne(operation: OperationEnAttente, resultat: ResultatOperation): Promise<void> {
    const db = (await this.bd())
    const table = operation.table as TableLocale
    if (resultat.statut === "refusee") {
      await db.put("refus_synchro", refusDepuisOperation(operation, resultat, { teamId: this.teamId, userId: this.userId }, new Date().toISOString()))
      if (operation.type !== "creer") await db.put("curseurs", { table, curseur: null })
    }
    // Création appliquée : la ligne prend la version serveur. Le serveur ne rend pas de rev à la création ; il part
    // toujours de rev 1 (prisma/schema.prisma, rev @default(1)), donc la ligne locale prend 1 (voir versionLue).
    if (resultat.statut === "appliquee" && operation.type === "creer") {
      const creee = await db.get(table, operation.id)
      if (creee && creee.rev < 1) await db.put(table, { ...creee, rev: 1 })
    }
    // Modification notée : le serveur est passé à revLue + 1. La ligne locale prend cette version, et les opérations
    // restées sur la ligne (écrites pendant l'envoi, sur la version précédente) la prennent aussi : sinon elles
    // seraient notées comme conflit à tort.
    if ((resultat.statut === "appliquee" || resultat.statut === "conflit_resolu") && operation.type === "modifier" && operation.revLue !== undefined) {
      const nouvelle = operation.revLue + 1
      const notee = await db.get(table, operation.id)
      if (notee && notee.rev < nouvelle) await db.put(table, { ...notee, rev: nouvelle })
      for (const suivante of await db.getAll("operations_en_attente")) {
        if (suivante.table === table && suivante.id === operation.id && suivante.type !== "creer" && suivante.revLue !== undefined) {
          await db.put("operations_en_attente", { ...suivante, revLue: nouvelle })
        }
      }
    }
    const restantes = (await db.getAll("operations_en_attente")).some((o) => o.id === operation.id)
    if (restantes) return
    if (resultat.statut === "refusee" && operation.type === "creer") {
      await db.delete(table, operation.id)
      return
    }
    const ligne = await db.get(table, operation.id)
    if (ligne) await db.put(table, { ...ligne, enAttente: false })
  }

  // Tirage : pour chaque table, les paquets après le curseur. Une ligne qui a encore une modification
  // en attente sur cet appareil garde sa version locale, qui sera poussée.
  private async tirer(): Promise<void> {
    const db = (await this.bd())
    for (const table of TABLES_LOCALES) {
      let curseur = (await db.get("curseurs", table))?.curseur ?? null
      let suite = true
      while (suite) {
        const reponse = await this.appeler("/api/synchro/tirer", { curseurs: { [table]: curseur } })
        const corps = (await reponse.json()) as {
          tables: Record<string, { lignes: LigneSynchro[]; curseur: string | null; suite: boolean }>
        }
        const paquet = corps.tables[table]
        if (!paquet) break
        const enAttente = new Set((await db.getAll("operations_en_attente")).map((o) => o.id))
        for (const ligne of paquet.lignes) {
          if (enAttente.has(ligne.id)) continue
          await db.put(table, { ...ligne, enAttente: false })
        }
        curseur = paquet.curseur
        await db.put("curseurs", { table, curseur })
        suite = paquet.suite
      }
    }
  }

  private async appeler(chemin: string, corps: unknown): Promise<Response> {
    let reponse: Response
    try {
      reponse = await fetch(chemin, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corps),
        cache: "no-store",
        credentials: "same-origin",
      })
    } catch {
      throw new Error("Pas de réseau pour le moment.")
    }
    if (!reponse.ok) {
      const { erreur } = (await reponse.json().catch(() => ({ erreur: null }))) as { erreur: string | null }
      throw new Error(erreur ?? "La synchronisation a échoué.")
    }
    return reponse
  }

  private planifier(delai: number): void {
    if (this.minuteur) clearTimeout(this.minuteur)
    this.minuteur = setTimeout(() => {
      this.minuteur = null
      void this.synchroniser()
    }, delai)
  }

  private surReseau(): void {
    if (navigator.onLine) {
      this.etat = { ...this.etat, enLigne: true }
      this.notifier()
      this.planifier(0)
    } else {
      this.passerHorsLigne()
    }
  }

  private passerHorsLigne(): void {
    this.etat = { ...this.etat, enLigne: false }
    this.notifier()
  }

  private async rafraichirCompteur(): Promise<void> {
    const compte = await (await this.bd()).count("operations_en_attente")
    this.etat = { ...this.etat, enAttente: compte, refus: await this.compterRefus() }
  }

  private async compterRefus(): Promise<number> {
    return (await this.lireRefus()).length
  }

  private notifier(): void {
    Array.from(this.ecouteurs).forEach((ecouteur) => ecouteur())
  }

  private bd(): Promise<IDBPDatabase<SchemaLocal>> {
    if (!this.ouverture) this.ouverture = ouvrirBase(this.userId, this.teamId)
    return this.ouverture
  }
}
