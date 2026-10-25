import type { Page } from "@playwright/test"

import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { ajouterVoitureDeCourse, preparerSaison, rattacherPersonne, statutAction } from "./aide/session"

// Brief 2.9, point 2 : une dépense d'engagement saisie dans Budget crée « marquer payé » dans la boîte.
// Symptôme rapporté : la boîte affiche « Rien à décider » jusqu'au rechargement. Ce test reproduit le parcours
// sans rechargement : écriture, navigation client vers le QG, boîte et compteur.

const SAISON = 2026

async function engagerLaVoiture(page: Page): Promise<{ eventId: string; entryId: string }> {
  await page.goto("/apps/saison/nouvelle")
  await page.getByLabel("Nom de l'épreuve").fill("Rallye boite e2e")
  await page.getByLabel("Premier jour").fill(`${SAISON}-07-10`)
  await page.getByLabel("Dernier jour").fill(`${SAISON}-07-11`)
  await page.getByRole("button", { name: "Ajouter l'épreuve" }).click()
  await expect(page).toHaveURL(/\/apps\/saison\/epreuves\/[0-9a-f-]+/)
  const fiche = page.url().split("?")[0]
  const eventId = fiche.split("/").pop() ?? ""
  await page.goto(`${fiche}?onglet=engagements`)
  await page.getByRole("button", { name: "Engager une voiture", exact: true }).click()
  await page.getByLabel("Voiture", { exact: true }).selectOption({ label: "Saxo test e2e" })
  await page.getByRole("dialog").getByRole("button", { name: "Engager la voiture", exact: true }).click()
  await expect(page.getByText("Saxo test e2e").first()).toBeVisible()
  await page.getByRole("link", { name: /Saxo test e2e/ }).first().click()
  await expect(page).toHaveURL(/\/apps\/saison\/engagements\/[0-9a-f-]+/)
  return { eventId, entryId: page.url().split("?")[0].split("/").pop() ?? "" }
}

// Nombre affiché sur le bouton de la boîte, lu dans son libellé d'accessibilité.
async function compteurBoite(page: Page): Promise<string> {
  const bouton = page.getByRole("button", { name: /Boîte d'actions/ }).first()
  return (await bouton.getAttribute("aria-label")) ?? ""
}

// Le libellé donne « Boîte d'actions, N en attente » ; sans action, il ne porte pas de nombre.
function nombreEnAttente(libelle: string): number {
  const trouve = /, (\d+) en attente/.exec(libelle)
  return trouve ? Number(trouve[1]) : 0
}

test("point 2 : dépense d'engagement, navigation client vers le QG, boîte et compteur sans rechargement", async ({ page, equipe }) => {
  test.setTimeout(240_000)
  await preparerSaison(equipe, SAISON)
  await ajouterVoitureDeCourse(equipe)
  await rattacherPersonne(equipe, equipe.responsable, "Responsable", "E2E")
  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 1440, height: 900 })

  const { eventId, entryId } = await engagerLaVoiture(page)

  // Saisie de la dépense d'engagement dans Budget (entrée initiale par URL, le reste par clic).
  await page.goto(`/apps/budget/nouvelle?epreuve=${eventId}`)
  // Compteur lu avant l'action, sur une page chargée : Équipe ajoute ses demandes de disponibilités à la création de
  // l'engagement (5.1), donc le nombre de départ n'est pas zéro. L'attente porte sur N+1 exactement.
  const avant = nombreEnAttente(await compteurBoite(page))
  await page.getByLabel("Montant (€)").fill("450")
  await page.getByLabel("Catégorie", { exact: true }).selectOption({ label: "Engagement" })
  await page.getByLabel(/Engagement concerné/).selectOption({ index: 1 })
  await page.getByRole("button", { name: "Ajouter la dépense" }).click()
  await expect(page.getByText("Enregistré. La dépense part")).toBeVisible()

  // Navigation client jusqu'au QG, par le lien de la barre haute (pas de rechargement).
  await page.getByRole("link", { name: /retour au QG/ }).click()
  await expect(page).toHaveURL(/\/qg$/)

  // L'action est créée côté serveur quand la dépense part (synchro). On attend le serveur, pas l'écran.
  await expect.poll(async () => statutAction(equipe, `marquer_paye:${entryId}`), { timeout: 60_000 }).toBe("en_attente")

  // Sans rechargement ni nouvelle navigation : le compteur doit passer à exactement N+1 (la seule action nouvelle).
  await expect.poll(async () => nombreEnAttente(await compteurBoite(page)), { timeout: 10_000 }).toBe(avant + 1)
  const compteur = await compteurBoite(page)
  await page.getByRole("button", { name: /Boîte d'actions/ }).first().click()
  const visible = await expect
    .poll(async () => page.getByText("Marquer l'engagement comme payé ?").first().isVisible().catch(() => false), { timeout: 5_000 })
    .toBe(true)
    .then(() => true)
    .catch(() => false)
  console.log(`[point 2] compteur : « ${compteur} » ; action visible sans rechargement : ${visible}`)

  // Rechargement : l'action doit apparaître (c'est ce que John observait).
  await page.reload()
  await page.getByRole("button", { name: /Boîte d'actions/ }).first().click()
  await expect(page.getByText("Marquer l'engagement comme payé ?").first()).toBeVisible()

  // Constat : l'action est visible après rechargement. Sans rechargement, on l'affiche, mais l'écran doit le prouver.
  expect(visible, "la boîte doit montrer l'action sans rechargement").toBe(true)
})
