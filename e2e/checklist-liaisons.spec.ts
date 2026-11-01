// Check-lists liaisons (tâche 5.7a, brief §5, article 956 §4-§5) par des clics : un problème sans organe ouvre une tâche du
// socle ; un point critique à l'approche de l'échéance figure dans la boîte, et en sort quand il est fait ; Saison affiche
// l'avancement des check-lists à côté de l'indice, sans le changer.
import type { Page, Response } from "@playwright/test"

import { preparerEngagementChecklist } from "./aide/checklist"
import { envoyer } from "./aide/envoi"
import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { statutAction, statutActionTitreEnBase, statutPointChecklistEnBase, tachesPointChecklistEnBase, type Equipe } from "./aide/session"

// Réponse d'une server action : à attendre après un envoi qui ne ferme pas de tiroir (cf. envoi.ts).
const RESPONSE_ACTION = (r: Response) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined

// Accepte la proposition « Créer les listes » : les listes de l'engagement existent ensuite.
async function accepterListes(page: Page, equipe: Equipe, entryId: string): Promise<void> {
  await page.getByRole("button", { name: /Boîte d'actions/ }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Accepter", exact: true }).click()
  await expect.poll(() => statutAction(equipe, `creer_listes:${entryId}`)).toBe("decidee")
}

async function ouvrirPremiereListe(page: Page): Promise<void> {
  await page.goto("/apps/checklist")
  await page.getByRole("region", { name: "Par engagement" }).getByRole("link").first().click()
  await expect(page).toHaveURL(/\/apps\/checklist\/liste\/[^?]+$/)
}

test("Problème sans organe : une tâche du socle, et la fiche montre qu'il n'y a pas d'objet lié", async ({ page, equipe }) => {
  test.setTimeout(300_000)
  const { entryId } = await preparerEngagementChecklist(equipe)
  await connecterParLien(page, equipe)
  await accepterListes(page, equipe, entryId)
  await ouvrirPremiereListe(page)

  await page.locator("li").filter({ hasText: "Trousse de secours" }).getByRole("link", { name: "Détail", exact: true }).click()
  const fiche = page.getByRole("dialog").first()
  await expect(fiche.getByRole("region", { name: "Lien" }).getByText("Aucun objet lié à ce point.")).toBeVisible()

  const reponse = page.waitForResponse(RESPONSE_ACTION)
  await fiche.getByRole("button", { name: "Problème", exact: true }).click()
  await reponse
  await expect.poll(() => statutPointChecklistEnBase(equipe, "Trousse de secours")).toBe("probleme")
  // Un point sans organe n'ouvre pas d'ordre : c'est une tâche du socle, une seule à faire par point.
  await expect.poll(() => tachesPointChecklistEnBase(equipe, "Trousse de secours")).toBe(1)
})

test("Point critique à l'approche de l'échéance : l'action sort dans la boîte, et se lève quand le point est fait", async ({ page, equipe }) => {
  test.setTimeout(300_000)
  const { entryId } = await preparerEngagementChecklist(equipe, { commenceAujourdhui: true })
  await connecterParLien(page, equipe)
  await accepterListes(page, equipe, entryId)
  await ouvrirPremiereListe(page)

  // Un point critique ajouté à une liste dont l'échéance est à 7 jours ou moins : l'action se pose.
  await page.getByRole("button", { name: "+ Ajouter un point", exact: true }).click()
  const ajout = page.getByRole("dialog")
  await ajout.getByLabel("Libellé du point", { exact: true }).fill("Pression des pneus")
  await ajout.getByLabel("Point critique", { exact: true }).check()
  await envoyer(page, ajout.getByRole("button", { name: "Ajouter le point", exact: true }))
  await expect.poll(() => statutActionTitreEnBase(equipe, "point_critique:", "Pression des pneus")).toBe("en_attente")

  // Coche : le point est fait, l'action est levée (annulée) sans que personne ne l'ait décidée.
  const reponse = page.waitForResponse(RESPONSE_ACTION)
  await page.locator("li").filter({ hasText: "Pression des pneus" }).getByRole("button", { name: "Faire", exact: true }).click()
  await reponse
  await expect.poll(() => statutPointChecklistEnBase(equipe, "Pression des pneus")).toBe("fait")
  await expect.poll(() => statutActionTitreEnBase(equipe, "point_critique:", "Pression des pneus")).toBe("annulee")
})

test("Saison : l'avancement des check-lists s'affiche à côté de l'indice, sans le modifier", async ({ page, equipe }) => {
  test.setTimeout(300_000)
  const { eventId, entryId } = await preparerEngagementChecklist(equipe)
  await connecterParLien(page, equipe)
  await accepterListes(page, equipe, entryId)

  await page.goto(`/apps/saison/epreuves/${eventId}?onglet=pret`)
  await expect(page.getByText("À côté, sans effet sur l'indice").first()).toBeVisible()
  await expect(page.locator("li", { has: page.getByText("Check-lists", { exact: true }) }).first()).toBeVisible()
})
