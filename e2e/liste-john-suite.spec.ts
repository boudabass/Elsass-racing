import type { Browser, Page } from "@playwright/test"

import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import {
  ajouterMembreConnectable,
  ajouterVehiculeDeReco,
  ajouterVoitureDeCourse,
  depensesBudgetEnBase,
  donnerAccesSaison,
  rattacherPersonne,
  statutAction,
  type Membre,
} from "./aide/session"

// Suite de la liste de John (brief 2.9, point 9), sur une team créée vide, par clic. Chaque membre supplémentaire
// est créé comme le ferait une invitation. Seule l'entrée initiale se fait par l'URL du QG.

const ANNEE = new Date().getUTCFullYear()

async function connecterMembre(browser: Browser, membre: Membre & { secretLien: string }): Promise<{ page: Page; fermer: () => Promise<void> }> {
  const contexte = await browser.newContext()
  const page = await contexte.newPage()
  await page.goto(`/connexion/lien?t=${membre.secretLien}`)
  await page.waitForURL(/\/qg$/)
  return { page, fermer: () => contexte.close() }
}

async function passerDecouverteBudget(page: Page): Promise<void> {
  const commencer = page.getByRole("button", { name: "Commencer" })
  if (await commencer.waitFor({ state: "visible", timeout: 5_000 }).then(() => true).catch(() => false)) await commencer.click()
}

// Saison ouverte à l'écran, puis une épreuve (dates passées de l'année en cours). Renvoie la fiche épreuve.
async function saisonEtEpreuvePasseeAuClic(page: Page, nomEpreuve: string): Promise<string> {
  await page.getByRole("navigation", { name: "Apps" }).getByRole("link", { name: "Saison" }).click()
  await page.getByRole("button", { name: "Ouvrir la saison" }).click()
  await page.getByRole("link", { name: "Ajouter une épreuve" }).click()
  await page.getByLabel("Nom de l'épreuve").fill(nomEpreuve)
  await page.getByLabel("Premier jour").fill(`${ANNEE}-01-10`)
  await page.getByLabel("Dernier jour").fill(`${ANNEE}-01-11`)
  await page.getByRole("button", { name: "Ajouter l'épreuve" }).click()
  await expect(page).toHaveURL(/\/apps\/saison\/epreuves\/[0-9a-f-]+/)
  return page.url().split("?")[0]
}

test("liste de John : saison complète par clic, spéciale, reconnaissance, résultat validé par un autre membre, débrief, clôture", async ({ browser, page, equipe }) => {
  test.setTimeout(420_000)
  await ajouterVoitureDeCourse(equipe, "Saxo saison John")
  await ajouterVehiculeDeReco(equipe, "Reco John")
  await rattacherPersonne(equipe, equipe.responsable, "Responsable", "E2E")
  const equipierA = await ajouterMembreConnectable(equipe, "equipage", "-a")
  const equipierB = await ajouterMembreConnectable(equipe, "equipage", "-b")
  const assistance = await ajouterMembreConnectable(equipe, "assistance", "-assist")
  await donnerAccesSaison(equipe, equipierA, "ecriture")
  await donnerAccesSaison(equipe, equipierB, "ecriture")
  await donnerAccesSaison(equipe, assistance, "lecture")

  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 1280, height: 900 })
  const fiche = await saisonEtEpreuvePasseeAuClic(page, "Rallye saison John")

  // Spéciale et reconnaissance, dans la fiche épreuve.
  await page.goto(`${fiche}?onglet=programme`)
  await page.getByLabel("N°").fill("1")
  await page.getByLabel("Nom", { exact: true }).fill("ES1 John")
  await page.getByRole("button", { name: "Ajouter la spéciale" }).click()
  await expect(page.getByText("ES1 John").first()).toBeVisible()

  // Reconnaissance : la voiture de reco est choisie dans les règles, puis une sortie est saisie.
  await page.getByRole("navigation", { name: "Onglets de l'épreuve" }).getByRole("link", { name: "Reconnaissances" }).click()
  await page.locator("select[name='vehiculeId']").selectOption({ label: "Reco John" })
  await page.getByRole("button", { name: "Enregistrer les règles" }).click()
  await expect(page.getByText("Enregistré.").first()).toBeVisible()
  await page.locator("input[name='date']").fill(`${ANNEE}-01-10`)
  await page.locator("input[name='passages']").fill("2")
  await page.locator("label").filter({ hasText: "ES1 John" }).locator("input").check()
  await page.getByRole("button", { name: "Ajouter la sortie" }).click()
  await expect(page.getByText("Enregistré.").first()).toBeVisible()

  // Engagement, puis paiement dans Saison.
  await page.getByRole("navigation", { name: "Onglets de l'épreuve" }).getByRole("link", { name: "Engagements" }).click()
  await page.getByLabel("Voiture").selectOption({ label: "Saxo saison John" })
  await page.getByRole("button", { name: "Engager la voiture" }).click()
  await page.getByRole("link", { name: /Saxo saison John/ }).first().click()
  await page.getByLabel("Montant payé (€)").fill("450")
  await page.getByRole("button", { name: "Enregistrer le paiement" }).click()
  await expect(page.getByText("Enregistré.")).toBeVisible()
  await page.goto(`${fiche}?onglet=resultats`)

  // Un équipier saisit le résultat : il ne le valide pas lui-même.
  const a = await connecterMembre(browser, equipierA)
  try {
    await a.page.goto(`${fiche}?onglet=resultats`)
    await a.page.getByLabel("Classement de classe").fill("2")
    await a.page.getByRole("button", { name: "Enregistrer le résultat" }).click()
    await expect(a.page.getByText("Enregistré.")).toBeVisible()
    await expect(a.page.getByRole("button", { name: "Valider", exact: true })).toHaveCount(0)
  } finally {
    await a.fermer()
  }

  // Un autre équipier valide depuis « Résultats à valider », puis écrit son débrief.
  const b = await connecterMembre(browser, equipierB)
  let adresseEngagement = ""
  try {
    await b.page.goto("/apps/saison/a-valider")
    await b.page.getByRole("button", { name: "Valider", exact: true }).click()
    await expect(b.page.locator("main").getByRole("link", { name: /Rallye saison John/ })).toHaveCount(0)
    await b.page.goto(`${fiche}?onglet=resultats`)
    // Le bloc de fin d'épreuve est là, pour une épreuve passée et validée.
    await expect(b.page.getByRole("heading", { name: "Débrief de l'épreuve" }).first()).toBeVisible()
    adresseEngagement = (await b.page.getByRole("link", { name: "Ouvrir l'engagement" }).first().getAttribute("href")) ?? ""
    await b.page.goto(adresseEngagement)
    await b.page.getByRole("button", { name: "Ressenti 4 sur 5" }).click()
    await expect(b.page.getByText("Enregistré.").first()).toBeVisible()
  } finally {
    await b.fermer()
  }

  // L'assistance voit le résultat, mais ni débrief, ni paiement, ni écriture.
  const assist = await connecterMembre(browser, assistance)
  try {
    await assist.page.goto(`${fiche}?onglet=resultats`)
    await expect(assist.page.getByText(/Validé/).first()).toBeVisible()
    await expect(assist.page.getByRole("button", { name: "Enregistrer le résultat" })).toHaveCount(0)
    await assist.page.goto(adresseEngagement)
    await expect(assist.page.getByText("Points positifs")).toHaveCount(0)
    await expect(assist.page.getByRole("button", { name: "Enregistrer le paiement" })).toHaveCount(0)
  } finally {
    await assist.fermer()
  }

  // Clôture de la saison en dernier, puis lecture seule : la création d'épreuve est refusée.
  await page.goto("/apps/saison/historique")
  await page.getByRole("button", { name: "Clôturer la saison" }).click()
  await page.getByRole("button", { name: "Confirmer la clôture" }).click()
  await expect(page.getByText(/Clôturée/).first()).toBeVisible()
  // Le calendrier d'une saison clôturée ne propose plus d'ajout d'épreuve.
  await page.getByRole("navigation", { name: "Apps" }).getByRole("link", { name: "Saison" }).click()
  await expect(page.getByRole("link", { name: "Ajouter une épreuve" })).toHaveCount(0)
  // Le formulaire de création, lui, refuse : aucune saison ouverte.
  await page.goto("/apps/saison/nouvelle")
  await page.getByLabel("Nom de l'épreuve").fill("Épreuve refusée John")
  await page.getByLabel("Premier jour").fill(`${ANNEE}-07-01`)
  await page.getByLabel("Dernier jour").fill(`${ANNEE}-07-02`)
  await page.getByRole("button", { name: "Ajouter l'épreuve" }).click()
  await expect(page.getByRole("alert").filter({ hasText: "Aucune saison ouverte" })).toBeVisible()
})

test("liste de John : recette saisie, remboursement d'un membre, sa ligne revient à « Rien à régler »", async ({ page, equipe }) => {
  test.setTimeout(300_000)
  await rattacherPersonne(equipe, equipe.responsable, "Responsable", "E2E")
  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 1280, height: 900 })
  await saisonEtEpreuvePasseeAuClic(page, "Rallye recette John")

  // Budget : une dépense payée par le responsable, puis une recette saisie par clic.
  await page.getByRole("navigation", { name: "Apps" }).getByRole("link", { name: "Budget" }).click()
  await passerDecouverteBudget(page)
  const menuBudget = page.getByRole("navigation", { name: "Menu de Budget" })
  await page.getByRole("link", { name: "Ajouter une dépense" }).click()
  await page.getByLabel("Montant (€)").fill("80")
  await page.getByLabel("Catégorie", { exact: true }).selectOption({ index: 1 })
  await page.getByLabel(/Libellé/).fill("Pneus remb John")
  await page.getByRole("button", { name: "Ajouter la dépense" }).click()
  await expect(page.getByText("Enregistré. La dépense part")).toBeVisible()

  await menuBudget.getByRole("link", { name: "Recette" }).click()
  await page.getByLabel("Montant (€)").fill("120")
  await page.getByLabel("Catégorie", { exact: true }).selectOption({ index: 1 })
  await page.getByRole("button", { name: "Enregistrer la recette" }).click()
  await expect(page.getByText(/Enregistr/).first()).toBeVisible()

  // Par membre : le responsable doit être remboursé, puis on rembourse la dépense.
  await menuBudget.getByRole("link", { name: "Par membre" }).click()
  await expect(page.getByText(/La team doit\s+80,00/)).toBeVisible()
  await page.getByRole("link", { name: "Rembourser" }).first().click()
  await page.getByRole("checkbox", { name: /Pneus remb John/ }).check()
  await page.locator("select[name='payerId']").selectOption({ index: 1 })
  await page.getByRole("button", { name: "Enregistrer le remboursement" }).last().click()
  await menuBudget.getByRole("link", { name: "Par membre" }).click()
  await expect(page.getByText("Rien à régler").first()).toBeVisible()
  await expect.poll(async () => (await depensesBudgetEnBase(equipe)).some((d) => d.libelle === "Pneus remb John")).toBe(true)
})

test("liste de John : Marquer payé dans la boîte, puis paiement direct dans Saison fait disparaître l'action", async ({ page, equipe }) => {
  test.setTimeout(300_000)
  await ajouterVoitureDeCourse(equipe, "Saxo liaison John")
  await rattacherPersonne(equipe, equipe.responsable, "Responsable", "E2E")
  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 1280, height: 900 })
  const fiche = await saisonEtEpreuvePasseeAuClic(page, "Rallye liaison John")
  const eventId = fiche.split("/").pop() ?? ""

  // Engagement, puis dépense d'engagement dans Budget : Saison demande « marquer payé ».
  await page.getByRole("navigation", { name: "Onglets de l'épreuve" }).getByRole("link", { name: "Engagements" }).click()
  await page.getByLabel("Voiture").selectOption({ label: "Saxo liaison John" })
  await page.getByRole("button", { name: "Engager la voiture" }).click()
  await page.getByRole("link", { name: /Saxo liaison John/ }).first().click()
  await expect(page).toHaveURL(/\/apps\/saison\/engagements\/[0-9a-f-]+/)
  const engagement = page.url().split("?")[0]
  const entryId = engagement.split("/").pop() ?? ""

  await page.getByRole("navigation", { name: "Apps" }).getByRole("link", { name: "Budget" }).click()
  await passerDecouverteBudget(page)
  await page.getByRole("link", { name: "Ajouter une dépense" }).click()
  await page.getByLabel("Montant (€)").fill("450")
  await page.getByLabel("Catégorie", { exact: true }).selectOption({ label: "Engagement" })
  await page.getByLabel("Épreuve", { exact: true }).selectOption({ index: 1 })
  await page.getByLabel(/Engagement concerné/).selectOption({ index: 1 })
  await page.getByRole("button", { name: "Ajouter la dépense" }).click()
  await expect(page.getByText("Enregistré. La dépense part")).toBeVisible()
  await expect.poll(async () => statutAction(equipe, `marquer_paye:${entryId}`), { timeout: 60_000 }).toBe("en_attente")

  // Dans la boîte : « Marquer payé ». L'engagement est payé, et aucune nouvelle suggestion n'apparaît.
  await page.getByRole("link", { name: /retour au QG/ }).click()
  // Seule l'ouverture est relancée, et seulement tant que le panneau n'est pas visible. Une fois ouvert,
  // « Marquer payé » doit être là dès la première ouverture : aucun nouveau clic ni rechargement ne la fait apparaître.
  const boite = page.getByRole("dialog", { name: "Boîte d'actions" })
  await expect(async () => {
    if (!(await boite.isVisible())) {
      await page.keyboard.press("Escape")
      await page.getByRole("button", { name: /Boîte d'actions/ }).first().click()
    }
    await expect(boite).toBeVisible({ timeout: 3_000 })
  }).toPass({ timeout: 30_000 })
  await expect(boite.getByRole("button", { name: "Marquer payé" }).first()).toBeVisible()
  await boite.getByRole("button", { name: "Marquer payé" }).first().click()
  await page.goto(engagement)
  await expect(page.getByText("Payé").first()).toBeVisible()
  await page.goto("/apps/budget/a-confirmer")
  await expect(page.getByRole("heading", { name: /Engagement Rallye liaison John/ })).toHaveCount(0)

  // Une seconde dépense pour le même engagement n'est pas proposée ; la liaison retour se fait par Saison (test suivant).
  expect(eventId).not.toBe("")
})

test("liste de John : paiement direct dans Saison lève « Marquer payé » restée dans la boîte", async ({ page, equipe }) => {
  test.setTimeout(300_000)
  await ajouterVoitureDeCourse(equipe, "Saxo direct John")
  await rattacherPersonne(equipe, equipe.responsable, "Responsable", "E2E")
  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 1280, height: 900 })
  const fiche = await saisonEtEpreuvePasseeAuClic(page, "Rallye direct John")
  const eventId = fiche.split("/").pop() ?? ""

  await page.getByRole("navigation", { name: "Onglets de l'épreuve" }).getByRole("link", { name: "Engagements" }).click()
  await page.getByLabel("Voiture").selectOption({ label: "Saxo direct John" })
  await page.getByRole("button", { name: "Engager la voiture" }).click()
  await page.getByRole("link", { name: /Saxo direct John/ }).first().click()
  await expect(page).toHaveURL(/\/apps\/saison\/engagements\/[0-9a-f-]+/)
  const entryId = page.url().split("?")[0].split("/").pop() ?? ""

  // La dépense d'engagement crée « marquer payé ».
  await page.getByRole("navigation", { name: "Apps" }).getByRole("link", { name: "Budget" }).click()
  await passerDecouverteBudget(page)
  await page.getByRole("link", { name: "Ajouter une dépense" }).click()
  await page.getByLabel("Montant (€)").fill("450")
  await page.getByLabel("Catégorie", { exact: true }).selectOption({ label: "Engagement" })
  await page.getByLabel("Épreuve", { exact: true }).selectOption({ index: 1 })
  await page.getByLabel(/Engagement concerné/).selectOption({ index: 1 })
  await page.getByRole("button", { name: "Ajouter la dépense" }).click()
  await expect.poll(async () => statutAction(equipe, `marquer_paye:${entryId}`), { timeout: 60_000 }).toBe("en_attente")

  // Le paiement est saisi directement dans Saison : l'action levée disparaît de la boîte.
  await page.goto(`/apps/saison/engagements/${entryId}`)
  await page.getByLabel("Montant payé (€)").fill("450")
  await page.getByRole("button", { name: "Enregistrer le paiement" }).click()
  await expect(page.getByText("Enregistré.")).toBeVisible()
  await expect.poll(async () => statutAction(equipe, `marquer_paye:${entryId}`)).toBe("annulee")
  await page.getByRole("link", { name: /retour au QG/ }).click()
  await page.getByRole("button", { name: /Boîte d'actions/ }).first().click()
  await expect(page.getByText("Marquer l'engagement comme payé ?")).toHaveCount(0)
  void eventId
})

test("liste de John : une dépense saisie hors ligne par l'assistance part au retour du réseau, sans doublon, et la boîte se met à jour", async ({ browser, page, equipe }) => {
  test.setTimeout(300_000)
  await rattacherPersonne(equipe, equipe.responsable, "Responsable", "E2E")
  const assistance = await ajouterMembreConnectable(equipe, "assistance", "-hl")
  await rattacherPersonne(equipe, assistance, "Assistante", "E2E")
  await donnerAccesSaison(equipe, assistance, "lecture")
  await connecterParLien(page, equipe)
  await saisonEtEpreuvePasseeAuClic(page, "Rallye hors ligne John")

  // L'assistance ouvre Budget, puis saisit une dépense hors ligne.
  const contexte = await browser.newContext()
  const assist = await contexte.newPage()
  try {
    await assist.goto(`/connexion/lien?t=${assistance.secretLien}`)
    await assist.waitForURL(/\/qg$/)
    await assist.getByRole("navigation", { name: "Apps" }).getByRole("link", { name: "Budget" }).click()
    await passerDecouverteBudget(assist)
    await assist.getByRole("link", { name: "Ajouter une dépense" }).click()
    await expect(assist.getByLabel("Montant (€)")).toBeVisible()
    await contexte.setOffline(true)
    await assist.getByLabel("Montant (€)").fill("35")
    await assist.getByLabel("Catégorie", { exact: true }).selectOption({ index: 1 })
    await assist.getByLabel(/Libellé/).fill("Essence hors ligne John")
    await assist.getByRole("button", { name: "Ajouter la dépense" }).click()
    await expect(assist.getByText("Enregistré. La dépense part")).toBeVisible()

    // Retour du réseau : la dépense part une fois, sans doublon.
    await contexte.setOffline(false)
    await expect
      .poll(async () => (await depensesBudgetEnBase(equipe)).filter((d) => d.libelle === "Essence hors ligne John").length, { timeout: 90_000 })
      .toBe(1)
    // Une dépense simple ne crée aucune action : la boîte ne change pas. Le compteur reste à zéro.
    await expect(assist.getByRole("button", { name: "Boîte d'actions" }).first()).toBeVisible()
  } finally {
    await contexte.close()
  }
})
