import { expect, test } from "./aide/fixtures"
import { notesEnBase } from "./aide/session"
import { connecterParLien } from "./aide/navigation"

// Partie 1 : la synchro sur la base locale, sans service worker. Le service worker (lecture de
// l'enveloppe hors ligne, rechargement sans réseau) est testé à part, sur un serveur de production.
test("une note créée hors ligne reste en attente, puis part au retour du réseau", async ({ page, equipe }) => {
  await connecterParLien(page, equipe)
  await page.goto("/notes?nouvelle=1")

  const zone = page.locator("#note-texte")
  await expect(zone).toBeVisible()

  // En ligne : la note part, et disparaît de l'état « en attente » (délai court de la synchro).
  await zone.fill("Note en ligne")
  await page.getByRole("button", { name: "Enregistrer la note" }).click()
  await expect(page.getByText("Note en ligne")).toBeVisible()
  await expect.poll(() => notesEnBase(equipe, "Note en ligne")).toBe(1)

  // Hors ligne : la note s'affiche tout de suite, avec son badge et l'indicateur.
  await page.context().setOffline(true)
  await zone.fill("Note hors ligne")
  await page.getByRole("button", { name: "Enregistrer la note" }).click()
  await expect(page.getByText("Note hors ligne")).toBeVisible()
  await expect(page.getByText("En attente", { exact: true })).toBeVisible()
  await expect(page.getByRole("status").filter({ hasText: "1 modification en attente" })).toBeVisible()
  expect(await notesEnBase(equipe, "Note hors ligne")).toBe(0)

  // Retour du réseau : la file part, la note arrive en base, et le badge disparaît.
  await page.context().setOffline(false)
  await expect.poll(() => notesEnBase(equipe, "Note hors ligne"), { timeout: 30_000 }).toBe(1)
  await expect(page.getByText("En attente", { exact: true })).toHaveCount(0)
  await expect(page.getByRole("status").filter({ hasText: "modification en attente" })).toHaveCount(0)
})
