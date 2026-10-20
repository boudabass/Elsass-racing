import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { preparerDonneesCaptures } from "./aide/session"

// Brief 3.11, §9 : le bouton flottant « Prochaine étape » n'est plus affiché, ni sur ordinateur ni sur téléphone.
// La logique (src/core/actions/prochaine-etape.ts) reste pour les écrans qui s'en servent.
test("la prochaine étape ne flotte plus : ni sur ordinateur, ni sur téléphone", async ({ page, equipe }) => {
  preparerDonneesCaptures(equipe)
  await connecterParLien(page, equipe)

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/qg")
  await expect(page.getByText("1 action à traiter")).toBeVisible()
  await expect(page.getByRole("link", { name: /Valider le résultat du Gaschney/ })).toHaveCount(0)

  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto("/qg")
  await expect(page.getByRole("button", { name: /Synchronisé|En ligne|Hors ligne|En attente/ }).first()).toBeVisible()
  await expect(page.getByRole("link", { name: /Valider le résultat du Gaschney/ })).toHaveCount(0)
})
