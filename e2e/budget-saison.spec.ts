import type { Browser, Page } from "@playwright/test"

import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import {
  ajouterMembreConnectable,
  ajouterVoitureDeCourse,
  depenseBudgetParLibelle,
  depensesBudgetEnBase,
  donnerAccesSaison,
  preparerSaison,
  preverEpreuveEnBase,
  rattacherPersonne,
  statutAction,
} from "./aide/session"

// Liaisons Saison et Budget (tâche 2.7) : un paiement d'engagement dans Saison propose une dépense dans Budget ;
// une dépense d'engagement saisie dans Budget demande « marquer payé » à Saison, sans boucle. Plus l'onglet
// Dépenses de la fiche épreuve, le tiroir de filtres sur téléphone, le solde de la barre haute, et la
// modification et suppression d'une dépense.

const SAISON = 2026

// Crée une épreuve, puis engage la voiture de test. Renvoie l'adresse de la fiche épreuve et celle de l'engagement.
async function engagerLaVoiture(page: Page): Promise<{ fiche: string; engagement: string; entryId: string }> {
  await page.goto("/apps/saison/nouvelle")
  await page.getByLabel("Nom de l'épreuve").fill("Rallye liaison e2e")
  await page.getByLabel("Premier jour").fill(`${SAISON}-06-10`)
  await page.getByLabel("Dernier jour").fill(`${SAISON}-06-11`)
  await page.getByRole("button", { name: "Ajouter l'épreuve" }).click()
  await expect(page).toHaveURL(/\/apps\/saison\/epreuves\/[0-9a-f-]+/)
  const fiche = page.url().split("?")[0]
  await page.goto(`${fiche}?onglet=engagements`)
  await page.getByLabel("Voiture").selectOption({ label: "Saxo test e2e" })
  await page.getByRole("button", { name: "Engager la voiture" }).click()
  await expect(page.getByText("Saxo test e2e").first()).toBeVisible()
  await page.getByRole("link", { name: /Saxo test e2e/ }).first().click()
  // Attendre la page de l'engagement : sinon l'URL lue est encore celle de l'épreuve.
  await expect(page).toHaveURL(/\/apps\/saison\/engagements\/[0-9a-f-]+/)
  const engagement = page.url().split("?")[0]
  return { fiche, engagement, entryId: engagement.split("/").pop() ?? "" }
}

test("liaison : un paiement d'engagement propose une dépense, confirmée depuis À confirmer, sans doublon", async ({ page, equipe }) => {
  test.setTimeout(240_000)
  await preparerSaison(equipe, SAISON)
  await ajouterVoitureDeCourse(equipe)
  await rattacherPersonne(equipe, equipe.responsable, "Responsable", "E2E")
  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 1440, height: 900 })

  const { engagement } = await engagerLaVoiture(page)
  await page.getByLabel("Montant payé (€)").fill("450")
  await page.getByLabel("Payeur").selectOption({ index: 1 })
  await page.getByRole("button", { name: "Enregistrer le paiement" }).click()
  await expect(page.getByText("Enregistré.")).toBeVisible()

  // Une seule proposition dans À confirmer, de 450 €.
  await page.goto("/apps/budget/a-confirmer")
  await expect(page.getByRole("heading", { name: /Engagement Rallye liaison e2e/ })).toBeVisible()
  await expect(page.getByRole("heading", { name: /Engagement Rallye liaison e2e/ })).toHaveCount(1)
  await page.getByRole("button", { name: "Confirmer" }).click()
  await expect(page.getByRole("heading", { name: /Engagement Rallye liaison e2e/ })).toHaveCount(0)
  await expect.poll(async () => (await depensesBudgetEnBase(equipe)).some((d) => d.libelle.startsWith("Engagement Rallye") && d.montant === 45_000)).toBe(true)

  // Une seule dépense pour cet engagement, après la confirmation (le second paiement est couvert par db:verifier-bus).
  expect((await depensesBudgetEnBase(equipe)).filter((d) => d.libelle.startsWith("Engagement Rallye")).length).toBe(1)
  void engagement
})

test("liaison : une dépense d'engagement saisie dans Budget demande « marquer payé » à Saison, sans nouvelle proposition", async ({ page, equipe }) => {
  test.setTimeout(240_000)
  await preparerSaison(equipe, SAISON)
  await ajouterVoitureDeCourse(equipe)
  await rattacherPersonne(equipe, equipe.responsable, "Responsable", "E2E")
  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 1440, height: 900 })

  const { fiche, engagement } = await engagerLaVoiture(page)
  const eventId = fiche.split("/").pop() ?? ""

  // La dépense d'engagement, saisie dans Budget et rattachée à l'engagement.
  await page.goto(`/apps/budget/nouvelle?epreuve=${eventId}`)
  await page.getByLabel("Montant (€)").fill("450")
  await page.getByLabel("Catégorie", { exact: true }).selectOption({ label: "Engagement" })
  await page.getByText("Plus de détails").click()
  await page.getByLabel(/Engagement concerné/).selectOption({ index: 1 })
  await page.getByRole("button", { name: "Ajouter la dépense" }).click()
  await expect(page.getByText("Enregistré. La dépense part")).toBeVisible()

  // Dans la boîte d'actions du QG : Saison demande de marquer l'engagement payé. On décide : il est payé.
  await expect.poll(async () => (await depensesBudgetEnBase(equipe)).some((d) => d.libelle === "Engagement" && d.montant === 45_000)).toBe(true)
  // La demande part après l'écriture (suite de la transaction) : on attend l'action elle-même, pas seulement la dépense.
  const entryId = engagement.split("/").pop() ?? ""
  await expect.poll(async () => statutAction(equipe, `marquer_paye:${entryId}`)).toBe("en_attente")
  await page.goto("/qg")
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
  await expect(boite.getByText("Marquer l'engagement comme payé ?").first()).toBeVisible()
  await boite.getByRole("button", { name: "Marquer payé" }).first().click()
  await page.goto(engagement)
  await expect(page.getByText("Payé").first()).toBeVisible()

  // Le paiement qui suit ne propose rien à Budget : aucune proposition pour cet engagement.
  await page.goto("/apps/budget/a-confirmer")
  await expect(page.getByRole("heading", { name: /Engagement Rallye liaison e2e/ })).toHaveCount(0)
})

test("budget : tiroir de filtres et pastilles sur téléphone, onglet Dépenses, solde, modification et suppression", async ({ page, equipe }) => {
  test.setTimeout(240_000)
  await preparerSaison(equipe, SAISON)
  await ajouterVoitureDeCourse(equipe)
  await rattacherPersonne(equipe, equipe.responsable, "Responsable", "E2E")
  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 1440, height: 900 })

  const { fiche } = await engagerLaVoiture(page)
  const eventId = fiche.split("/").pop() ?? ""
  await page.goto(`/apps/budget/nouvelle?epreuve=${eventId}`)
  await page.getByLabel("Montant (€)").fill("30,00")
  await page.getByLabel("Catégorie", { exact: true }).selectOption({ label: "Péages" })
  await page.getByRole("button", { name: "Ajouter la dépense" }).click()
  await expect.poll(async () => (await depensesBudgetEnBase(equipe)).some((d) => d.libelle === "Péages")).toBe(true)

  // Solde de la barre haute : une dépense confirmée, pas de recette, donc négatif.
  await page.goto("/apps/budget")
  const commencer = page.getByRole("button", { name: "Commencer" })
  if (await commencer.isVisible().catch(() => false)) await commencer.click()
  await expect(page.getByRole("link", { name: /Solde de la saison/ })).toBeVisible()

  // Onglet Dépenses de la fiche épreuve : la dépense y figure, avec le bouton de saisie prérempli.
  await page.goto(`${fiche}?onglet=depenses`)
  await expect(page.getByRole("link", { name: "Ajouter une dépense" })).toHaveAttribute("href", `/apps/budget/nouvelle?epreuve=${eventId}`)
  await expect(page.getByText("Péages").first()).toBeVisible()

  // Téléphone : les filtres sont dans un tiroir ; un filtre actif devient une pastille retirable.
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto("/apps/budget")
  await page.getByRole("button", { name: /^Filtres/ }).click()
  await page.getByRole("dialog").getByRole("combobox", { name: "Catégorie" }).selectOption({ label: "Péages" })
  await page.keyboard.press("Escape")
  await expect(page.getByRole("list", { name: "Filtres actifs" }).getByText("Péages")).toBeVisible()
  // Brief 2.12 : la pastille tient une cible tactile de 44 px.
  expect((await page.getByRole("list", { name: "Filtres actifs" }).locator("li > *").first().boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)

  // Modification puis suppression de la dépense (case de confirmation).
  const depense = await depenseBudgetParLibelle(equipe, "Péages")
  await page.goto(`/apps/budget/mouvement/${depense?.id ?? ""}`)
  await page.getByLabel("Montant (€)").fill("35,00")
  await page.getByRole("button", { name: "Enregistrer les modifications" }).click()
  await expect(page.getByText("Enregistré.")).toBeVisible()
  await expect.poll(async () => (await depenseBudgetParLibelle(equipe, "Péages"))?.montant).toBe(3500)
  await page.getByLabel("Je confirme la suppression de ce mouvement.").check()
  await page.getByRole("button", { name: "Supprimer" }).click()
  await expect.poll(async () => depenseBudgetParLibelle(equipe, "Péages")).toBeNull()
})

// Captures : barre haute avec le solde, onglet Dépenses de la fiche épreuve, tiroir de filtres (téléphone).
test("captures des liaisons : barre haute, onglet Dépenses, tiroir de filtres", async ({ page, equipe }) => {
  test.setTimeout(240_000)
  await preparerSaison(equipe, SAISON)
  await ajouterVoitureDeCourse(equipe)
  await rattacherPersonne(equipe, equipe.responsable, "Responsable", "E2E")
  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 1440, height: 900 })
  const { fiche } = await engagerLaVoiture(page)
  const eventId = fiche.split("/").pop() ?? ""
  await page.goto(`/apps/budget/nouvelle?epreuve=${eventId}`)
  await page.getByLabel("Montant (€)").fill("120,00")
  await page.getByLabel("Catégorie", { exact: true }).selectOption({ label: "Péages" })
  await page.getByRole("button", { name: "Ajouter la dépense" }).click()
  await expect.poll(async () => (await depensesBudgetEnBase(equipe)).some((d) => d.libelle === "Péages")).toBe(true)

  await page.goto("/apps/budget")
  const commencer = page.getByRole("button", { name: "Commencer" })
  if (await commencer.isVisible().catch(() => false)) await commencer.click()
  await expect(page.getByRole("link", { name: /Solde de la saison/ })).toBeVisible()
  await page.screenshot({ path: "docs/captures/budget-barre-haute-1440x900.png" })
  await page.goto(`${fiche}?onglet=depenses`)
  await page.screenshot({ path: "docs/captures/budget-onglet-depenses-1440x900.png", fullPage: true })

  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto(`${fiche}?onglet=depenses`)
  await page.screenshot({ path: "docs/captures/budget-onglet-depenses-360x740.png", fullPage: true })
  await page.goto("/apps/budget")
  await page.getByRole("button", { name: /^Filtres/ }).click()
  await page.screenshot({ path: "docs/captures/budget-filtres-tiroir-360x740.png" })
})

// Connexion d'un autre membre dans son propre contexte (l'assistance, ici).
async function connecterMembre(browser: Browser, membre: { secretLien: string }): Promise<{ page: Page; fermer: () => Promise<void> }> {
  const contexte = await browser.newContext()
  const page = await contexte.newPage()
  await page.goto(`/connexion/lien?t=${membre.secretLien}`)
  await page.waitForURL(/\/qg$/)
  return { page, fermer: () => contexte.close() }
}

// Correction 2.8 : le prévu de l'épreuve est un chiffre de la team. L'assistance voit l'onglet, mais pas le prévu.
test("onglet Dépenses : l'assistance ne voit pas le prévu de l'épreuve", async ({ browser, page, equipe }) => {
  test.setTimeout(240_000)
  await preparerSaison(equipe, SAISON)
  await ajouterVoitureDeCourse(equipe)
  await rattacherPersonne(equipe, equipe.responsable, "Responsable", "E2E")
  const assistante = await ajouterMembreConnectable(equipe, "assistance")
  await rattacherPersonne(equipe, assistante, "Assistante", "E2E")
  await donnerAccesSaison(equipe, assistante, "lecture")
  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 1440, height: 900 })

  const { fiche } = await engagerLaVoiture(page)
  const eventId = fiche.split("/").pop() ?? ""
  await preverEpreuveEnBase(equipe, eventId, 150_000)
  await page.goto(`${fiche}?onglet=depenses`)
  await expect(page.getByText(/prévu/).first()).toBeVisible()

  const assist = await connecterMembre(browser, assistante)
  try {
    await assist.page.setViewportSize({ width: 360, height: 740 })
    await assist.page.goto(`${fiche}?onglet=depenses`)
    await expect(assist.page.getByLabel("Dépenses de l'épreuve")).toBeVisible()
    await expect(assist.page.getByText(/prévu/)).toHaveCount(0)
    await assist.page.screenshot({ path: "docs/captures/budget-onglet-depenses-assistance-360x740.png", fullPage: true })
  } finally {
    await assist.fermer()
  }
})

// Correction 2.8 : sous md, les filtres du calendrier de Saison sont dans un tiroir ; un filtre actif est une pastille.
test("calendrier de Saison : tiroir de filtres et pastilles retirables sur téléphone", async ({ page, equipe }) => {
  test.setTimeout(120_000)
  await preparerSaison(equipe, SAISON)
  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 1440, height: 900 })
  // Le calendrier n'affiche ses filtres qu'avec au moins une épreuve.
  await page.goto("/apps/saison/nouvelle")
  await page.getByLabel("Nom de l'épreuve").fill("Calendrier e2e")
  await page.getByLabel("Premier jour").fill(`${SAISON}-07-10`)
  await page.getByLabel("Dernier jour").fill(`${SAISON}-07-11`)
  await page.getByRole("button", { name: "Ajouter l'épreuve" }).click()
  await expect(page).toHaveURL(/\/apps\/saison\/epreuves\/[0-9a-f-]+/)

  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto("/apps/saison")
  await page.getByRole("button", { name: /^Filtres/ }).click()
  await page.getByRole("dialog").getByRole("combobox", { name: "Type" }).selectOption({ index: 1 })
  await page.keyboard.press("Escape")
  const pastilles = page.getByRole("list", { name: "Filtres actifs" })
  await expect(pastilles).toBeVisible()
  // Brief 2.12 : la première pastille tient une cible tactile de 44 px.
  expect((await pastilles.locator("li > *").first().boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
  await expect(page.getByRole("button", { name: /Filtres \(1\)/ })).toBeVisible()
  await page.screenshot({ path: "docs/captures/saison-filtres-tiroir-360x740.png" })

  await pastilles.getByRole("button").first().click()
  await expect(page.getByRole("list", { name: "Filtres actifs" })).toHaveCount(0)
})

// Correction 2.8 : sur téléphone, le solde de Budget tient en une ligne compacte sous la barre haute.
test("solde sur téléphone : ligne compacte sous la barre haute", async ({ page, equipe }) => {
  test.setTimeout(120_000)
  await preparerSaison(equipe, SAISON)
  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto("/apps/budget")
  const commencer = page.getByRole("button", { name: "Commencer" })
  if (await commencer.isVisible().catch(() => false)) await commencer.click()

  await expect(page.getByRole("link", { name: /Solde de la saison/ })).toBeVisible()
  await page.screenshot({ path: "docs/captures/budget-solde-telephone-360x740.png" })
})
