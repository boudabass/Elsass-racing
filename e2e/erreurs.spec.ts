import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"

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
