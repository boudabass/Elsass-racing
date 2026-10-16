import { expect, test } from "./aide/fixtures"
import { connecterParLien, tuilesDuQg } from "./aide/navigation"

// Ligne d'une app dans la rubrique Apps : l'élément de liste qui porte le nom exact.
function ligneApp(page: import("@playwright/test").Page, nom: string) {
  return page.getByRole("listitem").filter({ has: page.getByText(nom, { exact: true }) })
}

test("e. apps : désactiver Garage retire sa tuile, la réactiver la rend, Voiture reste requise", async ({ page, equipe }) => {
  await connecterParLien(page, equipe)
  await page.goto("/apps/settings/apps")

  await ligneApp(page, "Garage").getByRole("button", { name: "Désactiver" }).click()
  await expect(ligneApp(page, "Garage").getByText("Désactivée")).toBeVisible()

  await page.goto("/qg")
  await expect(page.locator('a[href="/apps/garage"]').filter({ has: page.locator("h2") })).toHaveCount(0)
  await expect(tuilesDuQg(page)).toHaveCount(10)

  await page.goto("/apps/settings/apps")
  await ligneApp(page, "Garage").getByRole("button", { name: "Activer" }).click()
  await expect(ligneApp(page, "Garage").getByText("Activée")).toBeVisible()

  // Voiture ne peut pas être désactivée tant que Garage (qui la requiert) est activée :
  // le bouton est bloqué et la raison est affichée.
  const voiture = ligneApp(page, "Voiture")
  await expect(voiture.getByText("Requise par Garage")).toBeVisible()
  await expect(voiture.getByRole("button", { name: "Désactiver" })).toBeDisabled()
})
