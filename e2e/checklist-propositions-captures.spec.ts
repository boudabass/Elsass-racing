// Captures des propositions de Check-lists (tâche 5.7b) : la boîte avec la proposition « Remplacer la pièce » en attente,
// puis la liste après acceptation, à 1440 et à 360 px, en thème sombre et clair. Elles partent dans docs/captures/
// (checklist-propositions-*) ; elles sont téléchargées du run, relues une à une, puis commitées à la main.
import type { Page } from "@playwright/test"

import { preparerEngagementChecklist } from "./aide/checklist"
import { capturer, choisirTheme } from "./aide/equipe"
import { envoyer } from "./aide/envoi"
import { expect, test } from "./aide/fixtures"
import { preparerAtelierSaxo } from "./aide/garage"
import { connecterParLien } from "./aide/navigation"
import { statutAction, statutActionTitreEnBase, type Equipe } from "./aide/session"

const BUREAU = { largeur: "1440", width: 1440, height: 900 }
const TELEPHONE = { largeur: "360", width: 360, height: 1000 }
const TITRE = "Remplacer la pièce : Boîte de vitesses"

async function accepterListes(page: Page, equipe: Equipe, entryId: string): Promise<void> {
  await page.getByRole("button", { name: /Boîte d'actions/ }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Accepter", exact: true }).click()
  await expect.poll(() => statutAction(equipe, `creer_listes:${entryId}`)).toBe("decidee")
}

async function rouler(page: Page, kilometres: string): Promise<void> {
  await page.goto("/qg")
  await page.locator('a[href="/apps/garage"]').filter({ has: page.locator("h2") }).click()
  await expect(page.getByRole("heading", { name: "Atelier", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Ajouter", exact: true }).click()
  await page.getByRole("menuitem", { name: "Roulage", exact: true }).click()
  await page.getByLabel("Kilomètres roulés").fill(kilometres)
  await page.getByRole("button", { name: "Enregistrer le roulage", exact: true }).click()
  await expect(page).toHaveURL(/\/apps\/garage\?vehicule=/)
}

test("captures · propositions : boîte avant acceptation, liste après, 1440 et 360 px, sombre et clair", async ({ page, equipe }) => {
  test.setTimeout(600_000)
  const { entryId, vehicleId } = await preparerEngagementChecklist(equipe)
  await preparerAtelierSaxo(equipe, vehicleId)
  await connecterParLien(page, equipe)
  await accepterListes(page, equipe, entryId)
  await rouler(page, "16000")

  // La proposition attend dans la boîte, dans chaque thème et chaque taille.
  for (const theme of ["sombre", "clair"] as const) {
    await choisirTheme(page, theme)
    for (const taille of [BUREAU, TELEPHONE]) {
      await page.setViewportSize({ width: taille.width, height: taille.height })
      await page.goto("/apps/checklist")
      await page.getByRole("button", { name: /Boîte d'actions/ }).click()
      await expect(page.getByRole("dialog").getByText(TITRE, { exact: true })).toBeVisible()
      await capturer(page, `checklist-propositions-boite-${taille.largeur}-${theme}.png`)
      await page.keyboard.press("Escape")
    }
  }

  // Acceptée, le point figure dans la liste ; la capture de la liste est faite dans chaque thème et chaque taille.
  await page.setViewportSize({ width: BUREAU.width, height: BUREAU.height })
  await page.goto("/apps/checklist")
  await page.getByRole("button", { name: /Boîte d'actions/ }).click()
  await envoyer(page, page.getByRole("dialog").locator("li").filter({ hasText: TITRE }).getByRole("button", { name: "Accepter", exact: true }))
  await expect.poll(() => statutActionTitreEnBase(equipe, "proposition:", TITRE)).toBe("decidee")
  await page.keyboard.press("Escape")

  await page.goto("/apps/checklist")
  await page.getByRole("region", { name: "Par engagement" }).getByRole("link").first().click()
  await expect(page).toHaveURL(/\/apps\/checklist\/liste\/[^?]+$/)
  const listeUrl = page.url()
  for (const theme of ["sombre", "clair"] as const) {
    await choisirTheme(page, theme)
    for (const taille of [BUREAU, TELEPHONE]) {
      await page.setViewportSize({ width: taille.width, height: taille.height })
      await page.goto(listeUrl)
      await expect(page.locator("li").filter({ hasText: TITRE }).first()).toBeVisible()
      await capturer(page, `checklist-propositions-liste-${taille.largeur}-${theme}.png`)
    }
  }
})
