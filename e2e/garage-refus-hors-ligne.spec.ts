// Refus de la synchro visibles (tâche 4.3b, brief §4) : une intervention saisie hors ligne par un compte sans fiche
// personne est refusée à l'envoi. Au retour du réseau, l'indicateur le dit, la raison est lisible, le refus reste après
// un rechargement, et « Compris » l'efface. Ce fichier tourne sur le projet « hors-ligne » (port 3101).
import type { Page } from "@playwright/test"

import { expect, test } from "./aide/fixtures"
import { ordresEnBase, preparerAtelierSaxo } from "./aide/garage"
import { connecterParLien } from "./aide/navigation"
import { ajouterVoitureSaxo } from "./aide/session"

// Attend que le service worker contrôle la page (il prend le contrôle après le premier rechargement).
async function attendreServiceWorker(page: Page): Promise<void> {
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await page.evaluate(() => navigator.serviceWorker.ready)
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
}

test("refus hors ligne : la raison est visible au retour du réseau, reste après rechargement, s'efface par « Compris »", async ({ page, equipe, context }) => {
  test.setTimeout(240_000)
  const vehicleId = await ajouterVoitureSaxo(equipe, "Saxo refus hors ligne")
  const organes = await preparerAtelierSaxo(equipe, vehicleId)
  // Pas de fiche personne pour le compte : le serveur refuse l'intervention à l'envoi.
  const titre = "Refus hors ligne visible"

  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`/apps/garage/intervention?vehicule=${vehicleId}`)
  await expect(page.getByRole("heading", { name: "Intervention", exact: true })).toBeVisible()
  await attendreServiceWorker(page)
  await page.goto(`/apps/garage/intervention?vehicule=${vehicleId}`)
  await expect(page.getByLabel("Ce qui a été fait")).toBeVisible()

  // Hors ligne : l'intervention est saisie sur l'appareil.
  await context.setOffline(true)
  await page.goto(`/apps/garage/intervention?vehicule=${vehicleId}`)
  await page.locator('select[name="vehicleComponentId"]').selectOption(organes.freins)
  await page.getByLabel("Ce qui a été fait").fill(titre)
  await page.getByRole("button", { name: "Enregistrer l'intervention", exact: true }).click()
  await expect(page.getByText("Intervention enregistrée sur cet appareil.")).toBeVisible()

  // Retour du réseau : le serveur refuse, l'indicateur l'annonce.
  await context.setOffline(false)
  const indicateur = page.getByRole("button", { name: "1 envoi refusé", exact: true })
  await expect(indicateur).toBeVisible({ timeout: 30_000 })
  expect(await ordresEnBase(equipe, titre)).toHaveLength(0)

  // La raison et ce que la personne avait saisi sont dans le tiroir.
  await indicateur.click()
  const tiroir = page.getByRole("dialog")
  await expect(tiroir.getByText("Intervention : Refus hors ligne visible")).toBeVisible()
  await expect(tiroir.getByText("Votre compte n'a pas de fiche personne dans la team : le responsable doit la créer.")).toBeVisible()
  await page.keyboard.press("Escape")

  // Le refus reste après un rechargement : il est gardé sur l'appareil.
  await page.reload()
  await expect(page.getByRole("button", { name: "1 envoi refusé", exact: true })).toBeVisible()

  // Sur téléphone, l'indicateur garde son texte : l'état ne se dit pas par la couleur seule.
  await page.setViewportSize({ width: 360, height: 740 })
  await expect(page.locator("button:visible", { hasText: "1 envoi refusé" })).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 900 })

  // « Compris » efface le refus : l'indicateur ne l'annonce plus.
  await page.getByRole("button", { name: "1 envoi refusé", exact: true }).click()
  await page.getByRole("dialog").getByRole("button", { name: /^Compris/ }).click()
  await expect(page.getByRole("button", { name: "1 envoi refusé", exact: true })).toHaveCount(0)
  expect(await ordresEnBase(equipe, titre)).toHaveLength(0)
})
