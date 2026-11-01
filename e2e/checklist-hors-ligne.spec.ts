// Check-lists hors ligne (tâche 5.6b, brief §5) : une coche faite sans réseau reste sur l'appareil, puis part au retour
// du réseau. Ce fichier tourne sur le projet « hors-ligne » (nom en -hors-ligne.spec.ts) : serveur de production, seul
// projet où le service worker existe.
import type { Page } from "@playwright/test"

import { attendreServiceWorker, attendreTirageLocal, preparerEngagementChecklist } from "./aide/checklist"
import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { ajouterMembreConnectable, ouvrirListesAssistanceEnBase, statutAction, statutPointChecklistEnBase, type Equipe, type Membre } from "./aide/session"

// Liste créée par le modèle de la team (aide preparerEngagementChecklist) : deux points, dont le premier est coché hors ligne.
const POINT = "Triangle de présentation"
const AUTRE_POINT = "Trousse de secours"

// Accepte la proposition « Créer les listes » : les listes de l'engagement existent ensuite.
async function accepterListes(page: Page, equipe: Equipe, entryId: string): Promise<void> {
  await page.getByRole("button", { name: /Boîte d'actions/ }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Accepter", exact: true }).click()
  await expect.poll(() => statutAction(equipe, `creer_listes:${entryId}`)).toBe("decidee")
}

test("Check-lists hors ligne : une coche faite sans réseau reste sur l'appareil, puis part au retour du réseau", async ({ page, equipe, context }) => {
  test.setTimeout(240_000)
  const { entryId } = await preparerEngagementChecklist(equipe)
  await connecterParLien(page, equipe)
  await accepterListes(page, equipe, entryId)

  await page.goto("/apps/checklist")
  await page.getByRole("region", { name: "Par engagement" }).getByRole("link").first().click()
  await expect(page).toHaveURL(/\/apps\/checklist\/liste\/[^?]+$/)

  // Les points sont tirés sur l'appareil au démarrage de la synchro : on recharge en ligne, on attend le tirage, puis on
  // coupe le réseau.
  await attendreServiceWorker(page)
  await attendreTirageLocal(page, 2)
  await context.setOffline(true)

  const point = page.locator("li").filter({ hasText: POINT })
  await expect(point.getByRole("button", { name: "Faire", exact: true })).toBeEnabled({ timeout: 30_000 })
  await point.getByRole("button", { name: "Faire", exact: true }).click()
  await expect(point.getByRole("button", { name: "✓ Fait", exact: true })).toBeVisible()
  await expect(point.getByText("en attente d'envoi")).toBeVisible()
  expect(await statutPointChecklistEnBase(equipe, POINT)).toBe("a_faire")

  // Retour du réseau : la coche part, arrive en base, et la mention « en attente d'envoi » disparaît.
  await context.setOffline(false)
  await expect.poll(() => statutPointChecklistEnBase(equipe, POINT), { timeout: 30_000 }).toBe("fait")
  await expect(point.getByText("en attente d'envoi")).toHaveCount(0)
})

// L'assistance coche hors ligne dans une liste ouverte à elle : sa coche part au retour du réseau.
test("Check-lists hors ligne · assistance : une coche sur une liste ouverte à elle part au retour du réseau", async ({ browser, page, equipe }) => {
  test.setTimeout(240_000)
  const { entryId } = await preparerEngagementChecklist(equipe)
  await connecterParLien(page, equipe)
  await accepterListes(page, equipe, entryId)
  await ouvrirListesAssistanceEnBase(equipe)

  const assistance: Membre & { secretLien: string } = await ajouterMembreConnectable(equipe, "assistance")
  const contexteAssistance = await browser.newContext()
  const pageAssistance = await contexteAssistance.newPage()
  await pageAssistance.goto(`/connexion/lien?t=${assistance.secretLien}`)
  await pageAssistance.waitForURL(/\/qg$/)

  await pageAssistance.goto("/apps/checklist")
  await pageAssistance.getByRole("region", { name: "Par engagement" }).getByRole("link").first().click()
  await expect(pageAssistance).toHaveURL(/\/apps\/checklist\/liste\/[^?]+$/)

  await attendreServiceWorker(pageAssistance)
  await attendreTirageLocal(pageAssistance, 2)
  await contexteAssistance.setOffline(true)

  const point = pageAssistance.locator("li").filter({ hasText: AUTRE_POINT })
  await expect(point.getByRole("button", { name: "Faire", exact: true })).toBeEnabled({ timeout: 30_000 })
  await point.getByRole("button", { name: "Faire", exact: true }).click()
  await expect(point.getByRole("button", { name: "✓ Fait", exact: true })).toBeVisible()
  await expect(point.getByText("en attente d'envoi")).toBeVisible()

  await contexteAssistance.setOffline(false)
  await expect.poll(() => statutPointChecklistEnBase(equipe, AUTRE_POINT), { timeout: 30_000 }).toBe("fait")
  await expect(point.getByText("en attente d'envoi")).toHaveCount(0)
})
