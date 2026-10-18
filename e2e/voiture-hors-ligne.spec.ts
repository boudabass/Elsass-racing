import type { Page } from "@playwright/test"

import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { ajouterMembreConnectable, ajouterVoitureSaxo, donnerAccesVoiture, reglagesVoitureEnBase } from "./aide/session"

// Voiture hors ligne (tâche 3.3, brief section 7 et point 9-6) : l'assistance crée une fiche de réglage sans réseau.
// Elle part au retour du réseau, une seule fois. Ce fichier tourne sur le projet « hors-ligne » (serveur de
// production, port 3101) : seul endroit où le service worker existe.

// Attend que le service worker contrôle la page (il prend le contrôle après le premier rechargement).
async function attendreServiceWorker(page: Page): Promise<void> {
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await page.evaluate(() => navigator.serviceWorker.ready)
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
}

test("voiture hors ligne : une fiche de réglage saisie sans réseau part au retour du réseau, une seule fois", async ({ page, equipe, context }) => {
  test.setTimeout(240_000)
  const vehiculeId = await ajouterVoitureSaxo(equipe, "Saxo hors ligne")
  const assistance = await ajouterMembreConnectable(equipe, "assistance")
  await donnerAccesVoiture(equipe, assistance, "contribution")
  await connecterParLien(page, { ...equipe, secretLien: assistance.secretLien })
  await page.setViewportSize({ width: 360, height: 740 })

  // En ligne, une fois : la page de la nouvelle fiche est mise en cache.
  const adresse = `/apps/voiture/vehicules/${vehiculeId}/reglages/nouveau`
  await page.goto(adresse)
  await expect(page.locator('input[name="v_pression_froid_avg"]')).toBeVisible()
  await attendreServiceWorker(page)
  await page.goto(adresse)
  await expect(page.locator('input[name="v_pression_froid_avg"]')).toBeVisible()

  // Hors ligne : la fiche part dans la base locale, annoncée tout de suite, pas encore en base.
  await context.setOffline(true)
  await page.goto(adresse)
  await page.locator('input[name="v_pression_froid_avg"]').fill("2,3")
  await page.getByRole("button", { name: "Enregistrer la fiche" }).click()
  await expect(page.getByText("Fiche enregistrée. Elle part")).toBeVisible()
  expect((await reglagesVoitureEnBase(equipe)).filter((fiche) => fiche.vehicleId === vehiculeId)).toHaveLength(0)

  // Retour du réseau : la fiche arrive en base, une seule fois, à l'assistance, avec sa valeur.
  await context.setOffline(false)
  await expect
    .poll(async () => (await reglagesVoitureEnBase(equipe)).filter((fiche) => fiche.vehicleId === vehiculeId).length, { timeout: 30_000 })
    .toBe(1)
  const [fiche] = (await reglagesVoitureEnBase(equipe)).filter((ligne) => ligne.vehicleId === vehiculeId)
  expect(fiche.createdBy).toBe(assistance.userId)
  expect(fiche.valeurs.pression_froid_avg).toBe(2.3)
})
