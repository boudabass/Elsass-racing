import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { preparerDonneesCaptures } from "./aide/session"

test("le bouton Prochaine étape affiche Valider le résultat du Gaschney et ouvre la boîte d'actions", async ({ page, equipe }) => {
  preparerDonneesCaptures(equipe)
  await connecterParLien(page, equipe)
  await page.goto("/qg")

  const bouton = page.getByRole("link", { name: /Valider le résultat du Gaschney/ })
  await expect(bouton).toBeVisible()
  await expect(bouton).toHaveAttribute("href", /\/qg\?boite=/)
  await bouton.click()

  // Le panneau s'ouvre, l'URL garde la cible, et l'action est dans la zone visible.
  await expect(page).toHaveURL(/\/qg\?boite=/)
  const panneau = page.getByRole("dialog")
  await expect(panneau.getByRole("heading", { name: "Valider le résultat du Gaschney" })).toBeVisible()
  await expect(panneau.locator("article", { hasText: "Valider le résultat du Gaschney" })).toBeInViewport()
})
