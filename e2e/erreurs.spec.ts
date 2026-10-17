import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { retirerAdhesion } from "./aide/session"

// Écran d'erreur en français et journal : une page de test qui lève une erreur (hors production).
test("une erreur affiche l'écran en français et part au journal du serveur", async ({ page, equipe }) => {
  await connecterParLien(page, equipe)

  const envoi = page.waitForResponse((reponse) => reponse.url().includes("/api/erreurs-client") && reponse.request().method() === "POST")
  await page.goto("/erreur-test")

  await expect(page.getByRole("heading", { name: "Quelque chose s'est mal passé." })).toBeVisible()
  await expect(page.getByRole("button", { name: "Recharger" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Retour au QG" }).first()).toBeVisible()
  await expect(page.getByText("Erreur de test")).toHaveCount(0)

  // L'erreur est envoyée au serveur : 204 quand les logs l'ont reçue.
  expect((await envoi).status()).toBe(204)
})

// La route du journal exige une session : sans elle, rien n'est accepté.
test("le journal des erreurs refuse un envoi sans session", async ({ request }) => {
  const reponse = await request.post("/api/erreurs-client", {
    data: { message: "x", pile: "", page: "/qg", version: "v", navigateur: "n", enLigne: true, date: "2026-10-16T10:00:00.000Z" },
    maxRedirects: 0,
  })
  expect(reponse.status()).toBe(401)
})

// Brief 2.17 : un membre retiré pendant qu'il a l'app ouverte est renvoyé vers le choix de team,
// sans page d'erreur, et les routes (export) ne répondent pas 500.
test("une adhésion retirée pendant l'utilisation renvoie vers le choix de team, sans page d'erreur", async ({ page, equipe }) => {
  await connecterParLien(page, equipe)
  await page.goto("/apps/budget")
  await expect(page.getByRole("link", { name: "Par épreuve" }).first()).toBeVisible()

  await retirerAdhesion(equipe.responsable)

  await page.getByRole("link", { name: "Par épreuve" }).first().click()
  await page.waitForURL(/\/equipes/)
  await expect(page.getByRole("heading", { name: "Quelque chose s'est mal passé." })).toHaveCount(0)

  const reponse = await page.request.get("/apps/budget/export")
  expect(reponse.status()).toBeLessThan(500)
})
