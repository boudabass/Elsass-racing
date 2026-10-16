import type { Page } from "@playwright/test"

import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { depensesBudgetEnBase, preparerSaison, rattacherPersonne } from "./aide/session"

// Budget hors ligne (tâche 2.6, section 2) : une dépense saisie au bord de la spéciale, sans réseau, part à
// la synchro au retour du réseau. Ce fichier tourne sur le projet « hors-ligne » (serveur de production,
// port 3101) : seul endroit où le service worker existe.

// Attend que le service worker contrôle la page (il prend le contrôle après le premier rechargement).
async function attendreServiceWorker(page: Page): Promise<void> {
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await page.evaluate(() => navigator.serviceWorker.ready)
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
}

test("budget hors ligne : une dépense saisie sans réseau part au retour du réseau", async ({ page, equipe, context }) => {
  test.setTimeout(240_000)
  await preparerSaison(equipe, 2026)
  await rattacherPersonne(equipe, equipe.responsable, "Responsable", "E2E")
  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 360, height: 740 })

  // En ligne, une fois : la page de saisie est mise en cache, avec ses catégories et ses payeurs.
  await page.goto("/apps/budget")
  const commencer = page.getByRole("button", { name: "Commencer" })
  if (await commencer.isVisible().catch(() => false)) await commencer.click()
  await attendreServiceWorker(page)
  await page.goto("/apps/budget/nouvelle")
  await expect(page.getByLabel("Montant (€)")).toBeVisible()

  // Hors ligne : la saisie part dans la base locale, affichée tout de suite, pas encore en base.
  await context.setOffline(true)
  await page.goto("/apps/budget/nouvelle")
  await page.getByLabel("Montant (€)").fill("7,80")
  await page.getByLabel("Catégorie", { exact: true }).selectOption({ label: "Repas" })
  await page.getByRole("button", { name: "Ajouter la dépense" }).click()
  await expect(page.getByText("Enregistré. La dépense part")).toBeVisible()
  expect((await depensesBudgetEnBase(equipe)).some((d) => d.libelle === "Repas")).toBe(false)

  // Retour du réseau : la dépense arrive en base, confirmée, à la personne qui l'a payée.
  await context.setOffline(false)
  await expect
    .poll(async () => (await depensesBudgetEnBase(equipe)).find((d) => d.libelle === "Repas")?.montant ?? null, { timeout: 30_000 })
    .toBe(780)
  const depense = (await depensesBudgetEnBase(equipe)).find((d) => d.libelle === "Repas")
  expect(depense?.confirmee).toBe(true)
  expect(depense?.personneId).not.toBeNull()
})
