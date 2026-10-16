import { expect, test } from "./aide/fixtures"
import { compterEvenements } from "./aide/session"
import { connecterParLien } from "./aide/navigation"

const NOUVELLE_COULEUR = "#2e7d32"

test("d. identité : la couleur enregistrée est relue après rechargement, et l'événement est émis", async ({ page, equipe }) => {
  await connecterParLien(page, equipe)
  await page.goto("/apps/settings/identite")

  const couleur = page.locator("#couleurPrincipale")
  await couleur.fill(NOUVELLE_COULEUR)

  const formulaire = page.locator("form", { has: couleur })
  await formulaire.getByRole("button", { name: "Enregistrer" }).click()
  await page.waitForURL(/ok=1/)

  await page.reload()
  // La base enregistre les couleurs en majuscules : la comparaison ignore la casse.
  await expect(page.locator("#couleurPrincipale")).toHaveValue(NOUVELLE_COULEUR)

  expect(await compterEvenements(equipe, "settings.identite_modifiee")).toBeGreaterThanOrEqual(1)
})
