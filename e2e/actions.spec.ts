import { expect, test } from "./aide/fixtures"
import { emettreActionSaison, statutAction } from "./aide/session"
import { connecterParLien } from "./aide/navigation"

test("g. boîte d'actions : décider depuis le QG fait disparaître l'action et passe la base à decidee", async ({ page, equipe }) => {
  const cleUnicite = `e2e-action-${equipe.horodatage}`
  await emettreActionSaison(equipe, cleUnicite)
  await connecterParLien(page, equipe)

  await page.getByRole("button", { name: /Boîte d'actions/ }).click()
  const boite = page.getByRole("dialog")
  await expect(boite.getByRole("heading", { name: "Confirmer le calendrier de la saison (test)" })).toBeVisible()

  await boite.getByRole("button", { name: "Confirmer", exact: true }).click()

  await expect.poll(() => statutAction(equipe, cleUnicite)).toBe("decidee")

  await page.goto("/qg")
  await page.getByRole("button", { name: /Boîte d'actions/ }).click()
  await expect(page.getByText("Rien à décider. Profite de la route.")).toBeVisible()
})
