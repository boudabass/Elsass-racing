import type { Page } from "@playwright/test"

import { expect, test } from "./aide/fixtures"
import { notesEnBase } from "./aide/session"
import { connecterParLien, tuilesDuQg } from "./aide/navigation"

// Ce fichier tourne sur le projet « hors-ligne » : serveur de production (port 3101), le seul où le
// service worker existe.

// Attend que le service worker contrôle la page (il prend le contrôle après le premier rechargement).
async function attendreServiceWorker(page: Page): Promise<void> {
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await page.evaluate(() => navigator.serviceWorker.ready)
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
}

test("hors ligne : le QG et les notes s'ouvrent depuis le cache, la note hors ligne part au retour du réseau", async ({ page, equipe, context }) => {
  await connecterParLien(page, equipe)

  // En ligne : une note, envoyée.
  await page.goto("/notes?nouvelle=1")
  await page.locator("#note-texte").fill("Note en ligne")
  await page.getByRole("button", { name: "Enregistrer la note" }).click()
  await expect.poll(() => notesEnBase(equipe, "Note en ligne")).toBe(1)

  // Le service worker prend le contrôle, puis /qg et /notes sont visités une fois en ligne : ils
  // sont alors mis en cache.
  await attendreServiceWorker(page)
  await page.goto("/qg")
  await expect(tuilesDuQg(page)).toHaveCount(11)
  await page.goto("/notes")
  await expect(page.getByText("Note en ligne")).toBeVisible()

  // Hors ligne : les deux pages se rechargent depuis le cache, et la note vient de la base locale.
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByText("Note en ligne")).toBeVisible()
  await page.goto("/qg")
  await expect(tuilesDuQg(page)).toHaveCount(11)
  await page.goto("/notes")

  // Une note hors ligne : badge « En attente » et indicateur.
  await page.locator("#note-texte").fill("Note hors ligne")
  await page.getByRole("button", { name: "Enregistrer la note" }).click()
  await expect(page.getByText("Note hors ligne")).toBeVisible()
  await expect(page.getByText("En attente", { exact: true })).toBeVisible()
  await expect(page.getByRole("status").filter({ hasText: "1 modification en attente" })).toBeVisible()
  expect(await notesEnBase(equipe, "Note hors ligne")).toBe(0)

  // Retour du réseau : la note part, arrive en base, et le badge disparaît.
  await context.setOffline(false)
  await expect.poll(() => notesEnBase(equipe, "Note hors ligne"), { timeout: 30_000 }).toBe(1)
  await expect(page.getByText("En attente", { exact: true })).toHaveCount(0)
  await expect(page.getByRole("status").filter({ hasText: "modification en attente" })).toHaveCount(0)
})

// Sans rechargement : la file se vide au retour du réseau, sur le même serveur.
test("une note créée hors ligne reste en attente, puis part au retour du réseau", async ({ page, equipe, context }) => {
  await connecterParLien(page, equipe)
  await page.goto("/notes?nouvelle=1")

  const zone = page.locator("#note-texte")
  await expect(zone).toBeVisible()

  await zone.fill("Note en ligne 2")
  await page.getByRole("button", { name: "Enregistrer la note" }).click()
  await expect.poll(() => notesEnBase(equipe, "Note en ligne 2")).toBe(1)

  await context.setOffline(true)
  await zone.fill("Note hors ligne 2")
  await page.getByRole("button", { name: "Enregistrer la note" }).click()
  await expect(page.getByText("Note hors ligne 2")).toBeVisible()
  await expect(page.getByRole("status").filter({ hasText: "1 modification en attente" })).toBeVisible()
  expect(await notesEnBase(equipe, "Note hors ligne 2")).toBe(0)

  await context.setOffline(false)
  await expect.poll(() => notesEnBase(equipe, "Note hors ligne 2"), { timeout: 30_000 }).toBe(1)
})
