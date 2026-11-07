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
  // Le compte dépend de la date : l'épreuve de démonstration du 11/11 entre dans la fenêtre bloquante (5.9) et ajoute
  // « Engagement à payer ». On vérifie qu'il y a des actions à traiter, pas leur nombre.
  await expect(page.getByText(/\d+ actions? à traiter/).first()).toBeVisible()
  await expect(page.getByRole("link", { name: /Valider le résultat du Gaschney/ })).toHaveCount(0)

  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto("/qg")
  await expect(page.getByRole("button", { name: /Synchronisé|En ligne|Hors ligne|En attente/ }).first()).toBeVisible()
  await expect(page.getByRole("link", { name: /Valider le résultat du Gaschney/ })).toHaveCount(0)
})
