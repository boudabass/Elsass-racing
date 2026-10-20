import { expect, test } from "./aide/fixtures"
import { ajouterCodeConnu, CODE_CONNU } from "./aide/session"
import { connecterParLien, tuilesDuQg } from "./aide/navigation"

test("a. connexion par lien : arrivée sur le QG avec la team et ses 11 tuiles", async ({ page, equipe }) => {
  await connecterParLien(page, equipe)

  await expect(page).toHaveURL(/\/qg$/)
  await expect(page.getByRole("link", { name: `${equipe.nomTeam} : retour au QG` })).toBeVisible()
  // Pas d'initiales : l'icône QG, dans le lien vers le QG (point 6 du brief 2.15).
  await expect(page.getByRole("link", { name: `${equipe.nomTeam} : retour au QG` }).locator("svg")).toBeVisible()
  await expect(tuilesDuQg(page)).toHaveCount(11)
})

test("b. connexion par code : adresse, code saisi, arrivée sur le QG", async ({ page, equipe }) => {
  await page.goto("/connexion")
  await page.getByLabel("Adresse e-mail").fill(equipe.responsable.email)
  await page.getByRole("button", { name: "Recevoir mon lien" }).click()

  // L'étape code apparaît une fois la demande traitée. Le jeton au code connu est ajouté ici.
  await expect(page.getByLabel("Code à 6 chiffres")).toBeVisible()
  await ajouterCodeConnu(equipe.responsable.email, CODE_CONNU)

  await page.getByLabel("Code à 6 chiffres").fill(CODE_CONNU)
  await page.getByRole("button", { name: "Valider" }).click()

  await page.waitForURL(/\/qg$/)
  await expect(tuilesDuQg(page)).toHaveCount(11)
})

test("c. déconnexion par le menu : retour à /connexion, puis /qg redirige vers /connexion", async ({ page, equipe }) => {
  await connecterParLien(page, equipe)

  await page.getByRole("button", { name: "Menu", exact: true }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Se déconnecter" }).click()

  await page.waitForURL(/\/connexion$/)
  await page.goto("/qg")
  await expect(page).toHaveURL(/\/connexion/)
})
