// Garage hors ligne (tâche 4.3, D5) : une intervention rapide sans pièce, saisie sans réseau, part à la synchro au retour
// du réseau, terminée et affectée au compte ; une intervention avec pièce ne part pas hors ligne et le dit. Ce fichier
// tourne sur le projet « hors-ligne » (serveur de production, port 3101) : seul endroit où le service worker existe.
import type { Page } from "@playwright/test"

import { expect, test } from "./aide/fixtures"
import { ordresEnBase, pieceEnStockDeTest, preparerAtelierSaxo } from "./aide/garage"
import { connecterParLien } from "./aide/navigation"
import { ajouterVoitureSaxo, rattacherPersonne } from "./aide/session"

// Attend que le service worker contrôle la page (il prend le contrôle après le premier rechargement).
async function attendreServiceWorker(page: Page): Promise<void> {
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await page.evaluate(() => navigator.serviceWorker.ready)
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
}

test("garage hors ligne : une intervention sans pièce part au retour du réseau, une pièce attend le réseau", async ({ page, equipe, context }) => {
  test.setTimeout(240_000)
  const vehicleId = await ajouterVoitureSaxo(equipe, "Saxo garage hors ligne")
  const organes = await preparerAtelierSaxo(equipe, vehicleId)
  // Une pièce en stock, pour que le menu « Pièce utilisée » ait une option à choisir (les pièces montées n'y figurent pas).
  await pieceEnStockDeTest(equipe, organes.freins, "Disque avant en stock")
  const titre = "Plaquettes avant changées hors ligne"

  // Le compte doit avoir une fiche personne : sans elle, l'intervention hors ligne est refusée à l'envoi (D1, affectation).
  await rattacherPersonne(equipe, equipe.responsable, "Responsable", "E2E")

  // En ligne, une fois : la page d'intervention est mise en cache, avec ses organes et ses pièces.
  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto(`/apps/garage/intervention?vehicule=${vehicleId}`)
  await expect(page.getByRole("heading", { name: "Intervention", exact: true })).toBeVisible()
  await attendreServiceWorker(page)
  await page.goto(`/apps/garage/intervention?vehicule=${vehicleId}`)
  await expect(page.getByLabel("Ce qui a été fait")).toBeVisible()

  // Hors ligne : une pièce ne part pas, le formulaire le dit et ne saisit rien.
  await context.setOffline(true)
  await page.goto(`/apps/garage/intervention?vehicule=${vehicleId}`)
  await page.locator('select[name="vehicleComponentId"]').selectOption(organes.freins)
  await page.getByLabel("Ce qui a été fait").fill(titre)
  await page.locator('select[name="partId"]').selectOption({ index: 1 })
  await page.getByRole("button", { name: "Enregistrer l'intervention", exact: true }).click()
  await expect(page.getByText("Pour utiliser une pièce, reviens en ligne.")).toBeVisible()
  await page.locator('select[name="partId"]').selectOption("")

  // Sans pièce : l'intervention est saisie sur l'appareil, pas encore en base.
  await page.getByRole("button", { name: "Enregistrer l'intervention", exact: true }).click()
  await expect(page.getByText("Intervention enregistrée sur cet appareil.")).toBeVisible()
  expect(await ordresEnBase(equipe, titre)).toHaveLength(0)

  // Retour du réseau : l'ordre arrive en base, terminé à 100 %, sur l'organe choisi, origine saisie.
  await context.setOffline(false)
  await expect.poll(async () => (await ordresEnBase(equipe, titre)).length, { timeout: 30_000 }).toBe(1)
  const [ordre] = await ordresEnBase(equipe, titre)
  expect(ordre?.statut).toBe("termine")
  expect(ordre?.avancement_pct).toBe(100)
  expect(ordre?.origine).toBe("saisie")
  expect(ordre?.vehicle_component_id).toBe(organes.freins)
  expect(ordre?.vehicle_id).toBe(vehicleId)
})
