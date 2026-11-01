import { expect, type Page } from "@playwright/test"

// Aide des scénarios Check-lists : une épreuve à venir avec un engagement, créé comme le fait Saison
// (lignes en base, puis saison.engagement_cree par le bus). La proposition « Créer les listes » vient ensuite
// de l'app Check-lists, comme en production : le test la traite dans la boîte.
import { jourParis } from "./dates"
import type { Equipe } from "./session"
import {
  ajouterEpreuveEnBase,
  ajouterModeleChecklistEnBase,
  ajouterVoitureDeCourse,
  emettreEvenement,
  engagerVehiculeEnBase,
  preparerSaison,
} from "./session"

export interface EngagementChecklist {
  entryId: string
  eventId: string
  vehicleId: string
}

// Par défaut l'épreuve est à venir (année suivante). Avec « commence aujourd'hui », elle est commencée : un point créé
// maintenant est « ajouté pendant l'épreuve » (débrief), et la date est celle de Paris, comme dans l'app.
// `echeanceRelative` : décalage des points du modèle. Sans lui, la liste n'a pas d'échéance (aucune action « point critique »).
export async function preparerEngagementChecklist(
  equipe: Equipe,
  options: { commenceAujourdhui?: boolean; echeanceRelative?: "j_moins_7" | "j_moins_1" | "jour_j" } = {},
): Promise<EngagementChecklist> {
  const annee = new Date().getFullYear() + 1
  const debut = options.commenceAujourdhui ? jourParis(0) : `${annee}-06-01`
  const fin = options.commenceAujourdhui ? jourParis(1) : `${annee}-06-02`
  const saisonId = await preparerSaison(equipe, annee)
  const eventId = await ajouterEpreuveEnBase(equipe, saisonId, `Rallye Check-lists ${equipe.horodatage}`, debut, fin)
  const vehicleId = await ajouterVoitureDeCourse(equipe, `Saxo ${equipe.horodatage}`)
  const entryId = await engagerVehiculeEnBase(equipe, eventId, vehicleId, "inscrit")
  // Le modèle de la team doit exister avant l'événement : sans modèle disponible, aucune proposition.
  await ajouterModeleChecklistEnBase(equipe, "Contrôle avant départ", ["Triangle de présentation", "Trousse de secours"], options.echeanceRelative ?? null)
  emettreEvenement(equipe, "saison.engagement_cree", { entryId, eventId, vehicleId })
  return { entryId, eventId, vehicleId }
}

// Attend que la base locale de la page contienne au moins `minimum` points de Check-lists : le premier tirage de la
// synchro doit être fini avant de couper le réseau, sinon la liste n'est jamais sur l'appareil (le tirage ne tourne pas
// hors ligne). Lecture de la base IndexedDB de l'origine, sans passer par le moteur.
export async function attendreTirageLocal(page: Page, minimum: number): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          for (const { name } of await indexedDB.databases()) {
            if (!name?.startsWith("elsass-racing-")) continue
            const compte = await new Promise<number>((resolve) => {
              const ouverture = indexedDB.open(name)
              ouverture.onerror = () => resolve(0)
              ouverture.onsuccess = () => {
                const base = ouverture.result
                if (!base.objectStoreNames.contains("checklist_item")) {
                  base.close()
                  resolve(0)
                  return
                }
                const requete = base.transaction("checklist_item").objectStore("checklist_item").count()
                requete.onsuccess = () => {
                  base.close()
                  resolve(requete.result)
                }
                requete.onerror = () => {
                  base.close()
                  resolve(0)
                }
              }
            })
            if (compte > 0) return compte
          }
          return 0
        }),
      { timeout: 30_000 },
    )
    .toBeGreaterThanOrEqual(minimum)
}

// Le service worker doit contrôler la page, pour qu'elle se recharge hors ligne depuis le cache (projet « hors-ligne »).
export async function attendreServiceWorker(page: Page): Promise<void> {
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await page.evaluate(() => navigator.serviceWorker.ready)
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
}
