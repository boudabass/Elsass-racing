// Notes de fiche d'un ordre hors ligne (brief 5.0, décision du 20/10 : les notes s'écrivent hors ligne, les photos attendent
// le réseau). Une note écrite sans réseau s'affiche « En attente d'envoi », et part au retour du réseau. Ce fichier tourne
// sur le projet « hors-ligne » (serveur de production, port 3101) : seul endroit où le service worker existe.
import type { Page } from "@playwright/test"

import { expect, test } from "./aide/fixtures"
import { envoyer } from "./aide/envoi"
import { preparerAtelierSaxo } from "./aide/garage"
import { connecterParLien } from "./aide/navigation"
import { ajouterVoitureSaxo } from "./aide/session"

// Attend que le service worker contrôle la page (il prend le contrôle après le premier rechargement).
async function attendreServiceWorker(page: Page): Promise<void> {
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await page.evaluate(() => navigator.serviceWorker.ready)
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
}

test("notes d'un ordre hors ligne : écrites sans réseau, parties au retour ; la photo attend le réseau", async ({ page, equipe, context }) => {
  test.setTimeout(240_000)
  const vehicleId = await ajouterVoitureSaxo(equipe, "Saxo notes hors ligne")
  const organes = await preparerAtelierSaxo(equipe, vehicleId)
  const titre = "Contrôle notes hors ligne"

  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto(`/apps/garage/travaux?vehicule=${vehicleId}`)
  await page.getByRole("button", { name: "Nouvel ordre", exact: true }).click()
  const tiroir = page.getByRole("dialog")
  await tiroir.getByLabel("Titre", { exact: true }).fill(titre)
  await tiroir.locator('select[name="vehicleComponentId"]').selectOption(organes.freins)
  await envoyer(page, tiroir.getByRole("button", { name: "Créer l'ordre", exact: true }))
  await page.getByRole("link", { name: new RegExp(titre) }).first().click()
  await expect(page).toHaveURL(/\/apps\/garage\/travaux\/[0-9a-f-]+$/)
  const adresseOrdre = page.url()

  // En ligne, une fois : la fiche est mise en cache, avec la synchro des notes.
  await attendreServiceWorker(page)
  await page.goto(adresseOrdre)
  await expect(page.getByRole("heading", { name: "Notes et photos", exact: true })).toBeVisible()

  // Hors ligne : la note part dans la file, et la photo le dit.
  await context.setOffline(true)
  await page.goto(adresseOrdre)
  await page.getByRole("button", { name: "Ajouter une note", exact: true }).click()
  await page.getByLabel("Ce qu'il faut retenir").fill("Note écrite sans réseau")
  await page.getByRole("button", { name: "Enregistrer la note", exact: true }).click()
  await expect(page.getByText("Note écrite sans réseau", { exact: true })).toBeVisible()
  await expect(page.getByText("En attente d'envoi")).toBeVisible()
  await expect(page.getByText("Photo : il faut du réseau.")).toBeVisible()
  await expect(page.getByRole("button", { name: "Ajouter une photo", exact: true })).toBeDisabled()

  // Retour du réseau : la note part, et l'indication disparaît.
  await context.setOffline(false)
  await page.goto(adresseOrdre)
  await expect(page.getByText("Note écrite sans réseau", { exact: true })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText("En attente d'envoi")).toHaveCount(0, { timeout: 60_000 })
})
