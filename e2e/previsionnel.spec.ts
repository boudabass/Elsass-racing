import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { preparerSaison } from "./aide/session"

// Brief 2.9, point 5.2 : Prévisionnel, saison entière ou une épreuve. Saisie par ligne (gestion), écart en phrase.
// Captures 360 et 1280 des deux vues, pour le jugement de John.

const SAISON = new Date().getUTCFullYear()

test("prévisionnel : saisie pour la saison, puis pour une épreuve, par clic ; captures", async ({ page, equipe }) => {
  test.setTimeout(300_000)
  await preparerSaison(equipe, SAISON)
  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 1280, height: 900 })

  // Une épreuve créée à l'écran, pour le choix « une épreuve ».
  await page.getByRole("navigation", { name: "Apps" }).getByRole("link", { name: "Saison" }).click()
  await page.getByRole("link", { name: "Ajouter une épreuve" }).click()
  await page.getByLabel("Nom de l'épreuve").fill("Rallye prévu e2e")
  await page.getByLabel("Premier jour").fill(`${SAISON}-06-10`)
  await page.getByLabel("Dernier jour").fill(`${SAISON}-06-11`)
  await page.getByRole("button", { name: "Ajouter l'épreuve" }).click()
  await expect(page).toHaveURL(/\/apps\/saison\/epreuves\/[0-9a-f-]+/)

  // Prévisionnel par clic depuis le menu de Budget.
  await page.getByRole("navigation", { name: "Apps" }).getByRole("link", { name: "Budget" }).click()
  const commencer = page.getByRole("button", { name: "Commencer" })
  if (await commencer.waitFor({ state: "visible", timeout: 5_000 }).then(() => true).catch(() => false)) await commencer.click()
  await page.getByRole("navigation", { name: "Menu de Budget" }).getByRole("link", { name: "Prévisionnel" }).click()
  await expect(page.getByRole("heading", { name: "Prévisionnel" })).toBeVisible()
  await expect(page.getByText(/Le prévu de la saison, par catégorie/)).toBeVisible()
  await expect(page.getByText(/Aucun montant prévu pour la saison/)).toBeVisible()

  // Saisie d'un prévu sur la première ligne, pour la saison entière.
  await page.getByRole("button", { name: "Modifier les prévus" }).click()
  const tiroirSaison = page.getByRole("dialog")
  await tiroirSaison.locator("input[name^='prevu-']").first().fill("3000")
  await tiroirSaison.getByRole("button", { name: "Enregistrer les prévus" }).click()
  await expect(tiroirSaison).toHaveCount(0)
  await expect(page.getByText("Dans le prévu, 0 %").first()).toBeVisible()
  await page.screenshot({ path: "docs/captures/budget-previsionnel-saison-1280x900.png", fullPage: true })

  // Une épreuve : le choix est dans la portée, le prévu de l'épreuve est séparé de celui de la saison.
  await page.getByRole("navigation", { name: "Portée du prévisionnel" }).getByRole("link", { name: "Rallye prévu e2e" }).click()
  await expect(page).toHaveURL(/epreuve=/)
  await expect(page.getByText(/Le prévu de cette épreuve/)).toBeVisible()
  await expect(page.getByText(/Aucun montant prévu pour l'épreuve Rallye prévu e2e/)).toBeVisible()
  await page.getByRole("button", { name: "Modifier les prévus" }).click()
  const tiroirEpreuve = page.getByRole("dialog")
  await tiroirEpreuve.locator("input[name^='prevu-']").first().fill("500")
  await tiroirEpreuve.getByRole("button", { name: "Enregistrer les prévus" }).click()
  await expect(tiroirEpreuve).toHaveCount(0)
  await expect(page.getByText("Dans le prévu, 0 %").first()).toBeVisible()
  await page.screenshot({ path: "docs/captures/budget-previsionnel-epreuve-1280x900.png", fullPage: true })

  // Captures téléphone des deux vues.
  await page.setViewportSize({ width: 360, height: 740 })
  await page.screenshot({ path: "docs/captures/budget-previsionnel-epreuve-360x740.png", fullPage: true })
  await page.getByRole("navigation", { name: "Portée du prévisionnel" }).getByRole("link", { name: "Saison entière" }).click()
  await page.screenshot({ path: "docs/captures/budget-previsionnel-saison-360x740.png", fullPage: true })
})
