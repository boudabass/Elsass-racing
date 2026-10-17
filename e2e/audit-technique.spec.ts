import type { Page } from "@playwright/test"

import { expect, test } from "./aide/fixtures"
import { connecterParLien, tuilesDuQg } from "./aide/navigation"
import { preparerSaison } from "./aide/session"

// Brief 2.12, point 7 : preuves de l'audit technique sur le build de production (port 3101).
// Un seul titre principal, zones de toucher à 44 px, animations réduites ; captures pour John.

const SAISON = 2033

async function capturer(page: Page, nom: string, largeur: number, hauteur: number): Promise<void> {
  await page.setViewportSize({ width: largeur, height: hauteur })
  await page.screenshot({ path: `docs/captures/audit-${nom}-${largeur}x${hauteur}.png`, fullPage: true })
}

test("connexion, 360 px : un seul titre principal « Connexion », champ et bouton d'envoi à 44 px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto("/connexion")

  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1)
  await expect(page.getByRole("heading", { level: 1, name: "Connexion" })).toBeVisible()

  const champ = await page.getByLabel("Adresse e-mail").boundingBox()
  const envoi = await page.getByRole("button", { name: "Recevoir mon lien" }).boundingBox()
  expect(champ?.height ?? 0).toBeGreaterThanOrEqual(44)
  expect(envoi?.height ?? 0).toBeGreaterThanOrEqual(44)

  await capturer(page, "connexion", 360, 740)
  await capturer(page, "connexion", 1280, 800)
})

test("réglages : un titre principal « Réglages » après un clic depuis le QG", async ({ page, equipe }) => {
  await connecterParLien(page, equipe)
  await tuilesDuQg(page).filter({ hasText: "Réglages" }).click()

  await expect(page).toHaveURL(/\/apps\/settings/)
  await expect(page.getByRole("heading", { level: 1, name: "Réglages" })).toBeVisible()
})

test("réduire les animations, 360 px : le tiroir « Ajouter » apparaît sans glisser", async ({ page, equipe }) => {
  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 360, height: 740 })
  await page.emulateMedia({ reducedMotion: "reduce" })

  await page.getByRole("button", { name: "Ajouter", exact: true }).click()
  const tiroir = page.getByRole("dialog")
  await expect(tiroir).toBeVisible()
  const glissement = await tiroir.evaluate((element) => getComputedStyle(element).getPropertyValue("--tw-enter-translate-y").trim())
  expect(glissement).toBe("0")

  await page.keyboard.press("Escape")
  await expect(tiroir).toBeHidden()
})

test("captures de l'audit à 360 px et 1280 px : Réglages, formulaires Saison et Budget, filtres avec pastilles", async ({ page, equipe }) => {
  test.setTimeout(240_000)
  await preparerSaison(equipe, SAISON)
  await connecterParLien(page, equipe)

  // Une épreuve est nécessaire pour que le calendrier de Saison affiche ses filtres.
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto("/apps/saison/nouvelle")
  await page.getByLabel("Nom de l'épreuve").fill("Audit e2e")
  await page.getByLabel("Premier jour").fill(`${SAISON}-07-10`)
  await page.getByLabel("Dernier jour").fill(`${SAISON}-07-11`)
  await page.getByRole("button", { name: "Ajouter l'épreuve" }).click()
  await expect(page).toHaveURL(/\/apps\/saison\/epreuves\/[0-9a-f-]+/)

  for (const [largeur, hauteur] of [
    [1280, 800],
    [360, 740],
  ] as const) {
    await page.setViewportSize({ width: largeur, height: hauteur })
    await page.goto("/apps/settings/affichage")
    await expect(page.getByRole("heading", { level: 1, name: "Réglages" })).toBeVisible()
    await capturer(page, "reglages-personnel", largeur, hauteur)

    await page.goto("/apps/saison/nouvelle")
    await expect(page.getByLabel("Nom de l'épreuve")).toBeVisible()
    await capturer(page, "saison-formulaire", largeur, hauteur)

    await page.goto("/apps/budget/nouvelle")
    await expect(page.getByLabel("Montant (€)")).toBeVisible()
    await capturer(page, "budget-formulaire", largeur, hauteur)
  }

  // Filtres avec pastilles : le tiroir sur téléphone, puis le même état à 1280 px (l'état est dans l'adresse).
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto("/apps/saison")
  await page.getByRole("button", { name: /^Filtres/ }).click()
  await page.getByRole("dialog").getByRole("combobox", { name: "Type" }).selectOption({ index: 1 })
  await page.keyboard.press("Escape")
  await expect(page.getByRole("list", { name: "Filtres actifs" })).toBeVisible()
  await capturer(page, "filtres-pastilles", 360, 740)
  await capturer(page, "filtres-pastilles", 1280, 800)
})
