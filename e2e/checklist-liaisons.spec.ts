// Check-lists liaisons (tâche 5.7a, brief §5, article 956 §4-§5) par des clics : un problème sans organe ouvre une tâche du
// socle ; un point critique à l'approche de l'échéance figure dans la boîte, et en sort quand il est fait ; Saison affiche
// l'avancement des check-lists à côté de l'indice, sans le changer.
import type { Page, Response } from "@playwright/test"

import { accepterListes, preparerEngagementChecklist } from "./aide/checklist"
import { envoyer } from "./aide/envoi"
import { expect, test } from "./aide/fixtures"
import { preparerAtelierSaxo, ordresEnBase } from "./aide/garage"
import { connecterParLien } from "./aide/navigation"
import { lienPointChecklistEnBase, statutActionTitreEnBase, statutPointChecklistEnBase, tachesPointChecklistEnBase } from "./aide/session"

// Réponse d'une server action : à attendre après un envoi qui ne ferme pas de tiroir (cf. envoi.ts).
const RESPONSE_ACTION = (r: Response) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined


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
  // Le modèle a un décalage J-7 : la liste tombe à échéance proche (une liste sans échéance n'a jamais d'action).
  const { entryId } = await preparerEngagementChecklist(equipe, { commenceAujourdhui: true, echeanceRelative: "j_moins_7" })
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

  // Dans la boîte, la carte « Pression des pneus » n'a qu'un « Ouvrir la liste » (lien) : pas de « Ouvrir » générique en double.
  // Le modèle ajoute son propre point critique (« Triangle de présentation ») : sa carte n'est pas comptée ici.
  await page.getByRole("button", { name: /Boîte d'actions/ }).click()
  const boiteCritique = page.getByRole("dialog")
  await expect(boiteCritique.getByRole("article").filter({ hasText: "Pression des pneus" }).getByRole("link", { name: "Ouvrir la liste", exact: true })).toHaveCount(1)
  await expect(boiteCritique.getByRole("link", { name: "Ouvrir", exact: true })).toHaveCount(0)
  await page.keyboard.press("Escape")
  await expect(boiteCritique).toHaveCount(0)

  // Coche : le point est fait, l'action est levée (annulée) sans que personne ne l'ait décidée.
  const reponse = page.waitForResponse(RESPONSE_ACTION)
  await page.locator("li").filter({ hasText: "Pression des pneus" }).getByRole("button", { name: "Faire", exact: true }).click()
  await reponse
  await expect.poll(() => statutPointChecklistEnBase(equipe, "Pression des pneus")).toBe("fait")
  await expect.poll(() => statutActionTitreEnBase(equipe, "point_critique:", "Pression des pneus")).toBe("annulee")
})

test("Lien à un organe : le problème propose un ordre dans la boîte, Créer l'ordre le crée dans Travaux ; sans organe, une tâche", async ({ page, equipe }) => {
  test.setTimeout(420_000)
  const { entryId, vehicleId } = await preparerEngagementChecklist(equipe)
  // L'atelier réel de la voiture : ses organes ont des identifiants que le lien et l'ordre reprennent.
  const organes = await preparerAtelierSaxo(equipe, vehicleId)
  await connecterParLien(page, equipe)
  await accepterListes(page, equipe, entryId)
  await ouvrirPremiereListe(page)

  // Un point ajouté à la liste, lié au moteur dans sa fiche : le choix ne propose que les objets de la voiture.
  await page.getByRole("button", { name: "+ Ajouter un point", exact: true }).click()
  const ajout = page.getByRole("dialog")
  await ajout.getByLabel("Libellé du point", { exact: true }).fill("Niveau d'huile moteur")
  await envoyer(page, ajout.getByRole("button", { name: "Ajouter le point", exact: true }))
  await page.locator("li").filter({ hasText: "Niveau d'huile moteur" }).getByRole("link", { name: "Détail", exact: true }).click()
  const fiche = page.getByRole("dialog").first()
  await fiche.getByLabel("Objet lié", { exact: true }).selectOption(`organe_garage|${organes.moteur}`)
  const reponseLien = page.waitForResponse(RESPONSE_ACTION)
  await fiche.getByRole("button", { name: "Enregistrer le lien", exact: true }).click()
  await reponseLien
  await expect.poll(() => lienPointChecklistEnBase(equipe, "Niveau d'huile moteur")).toEqual({ lienType: "organe_garage", lienId: organes.moteur })
  await expect(fiche.getByRole("region", { name: "Lien" })).toContainText("Moteur")

  // Le problème sur ce point : Garage propose un ordre, il n'en crée aucun avant l'acceptation.
  const reponseProbleme = page.waitForResponse(RESPONSE_ACTION)
  await fiche.getByRole("button", { name: "Problème", exact: true }).click()
  await reponseProbleme
  await expect.poll(() => statutPointChecklistEnBase(equipe, "Niveau d'huile moteur")).toBe("probleme")
  // La fiche est modale : fermée, elle ne cache plus l'en-tête où s'ouvre la boîte.
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.getByRole("button", { name: /Boîte d'actions/ }).click()
  const boite = page.getByRole("dialog")
  await expect(boite.getByText("Problème signalé : Moteur", { exact: true })).toBeVisible()
  await expect.poll(() => ordresEnBase(equipe, "Problème signalé : Moteur")).toEqual([])

  // Créer l'ordre : l'ordre part sur l'organe du lien, et l'action est décidée.
  const reponseOrdre = page.waitForResponse(RESPONSE_ACTION)
  await boite.getByRole("button", { name: "Créer l'ordre", exact: true }).click()
  await reponseOrdre
  await expect.poll(() => statutActionTitreEnBase(equipe, "ordre_point:", "Problème signalé : Moteur")).toBe("decidee")
  await expect.poll(async () => (await ordresEnBase(equipe, "Problème signalé : Moteur")).map((ordre) => ordre.vehicle_component_id)).toEqual([organes.moteur])

  // La boîte est modale : fermée, elle ne cache plus la navigation.
  await page.keyboard.press("Escape")
  await expect(boite).toHaveCount(0)

  // Dans Garage, par les menus : l'ordre figure dans Travaux.
  await page.getByRole("navigation", { name: "Apps" }).getByRole("link", { name: "Garage", exact: true }).click()
  await page.getByRole("navigation", { name: "Menu de Garage" }).getByRole("link", { name: "Travaux", exact: true }).click()
  await expect(page.getByText("Problème signalé : Moteur").first()).toBeVisible()

  // Un point sans organe en problème ne fait pas d'ordre : une tâche du socle, une seule.
  await page.getByRole("navigation", { name: "Apps" }).getByRole("link", { name: "Check-lists", exact: true }).click()
  await page.getByRole("region", { name: "Par engagement" }).getByRole("link").first().click()
  await expect(page).toHaveURL(/\/apps\/checklist\/liste\/[^?]+$/)
  await page.locator("li").filter({ hasText: "Trousse de secours" }).getByRole("link", { name: "Détail", exact: true }).click()
  const ficheTrousse = page.getByRole("dialog").first()
  const reponseTrousse = page.waitForResponse(RESPONSE_ACTION)
  await ficheTrousse.getByRole("button", { name: "Problème", exact: true }).click()
  await reponseTrousse
  await expect.poll(() => statutPointChecklistEnBase(equipe, "Trousse de secours")).toBe("probleme")
  await expect.poll(() => tachesPointChecklistEnBase(equipe, "Trousse de secours")).toBe(1)
  await expect.poll(async () => (await ordresEnBase(equipe, "Problème signalé : Moteur")).length).toBe(1)
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
