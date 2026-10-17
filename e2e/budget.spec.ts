import type { Browser, Page } from "@playwright/test"

import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import {
  ajouterMembreConnectable,
  depensesBudgetEnBase,
  preparerSaison,
  proposerMouvementBudget,
  rattacherPersonne,
  rembourseEnBase,
  type Membre,
} from "./aide/session"

// Budget (tâche 2.6) : une dépense en trois champs depuis le bouton +, le solde du membre, un remboursement
// partiel puis complet, un mouvement proposé confirmé depuis « À confirmer », et l'assistance limitée à ses
// dépenses. Les données passent par la base réelle (synchro comprise).

const SAISON = 2026

async function connecterMembre(browser: Browser, membre: Membre & { secretLien: string }): Promise<{ page: Page; fermer: () => Promise<void> }> {
  const contexte = await browser.newContext()
  const page = await contexte.newPage()
  await page.goto(`/connexion/lien?t=${membre.secretLien}`)
  await page.waitForURL(/\/qg$/)
  return { page, fermer: () => contexte.close() }
}

// Premier accès : l'écran de découverte, puis « Commencer ».
async function ouvrirBudget(page: Page): Promise<void> {
  await page.goto("/apps/budget")
  const commencer = page.getByRole("button", { name: "Commencer" })
  if (await commencer.isVisible().catch(() => false)) await commencer.click()
}

test("budget : dépense, solde, remboursement partiel puis complet, proposition confirmée, assistance limitée", async ({ browser, page, equipe }) => {
  test.setTimeout(300_000)
  await preparerSaison(equipe, SAISON)
  const assistante = await ajouterMembreConnectable(equipe, "assistance")
  const personneResponsable = await rattacherPersonne(equipe, equipe.responsable, "Responsable", "E2E")
  await rattacherPersonne(equipe, assistante, "Assistante", "E2E")

  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 1440, height: 900 })

  // Une dépense en trois champs, depuis le bouton + du QG.
  await page.goto("/qg")
  await page.getByRole("button", { name: "Ajouter" }).first().click()
  await page.getByRole("menuitem", { name: "Dépense" }).click()
  await expect(page).toHaveURL(/\/apps\/budget\/nouvelle/)
  await page.getByLabel("Montant (€)").fill("45,50")
  await page.getByLabel("Catégorie", { exact: true }).selectOption({ label: "Pneus" })
  await page.getByRole("button", { name: "Ajouter la dépense" }).click()
  await expect(page.getByText("Enregistré. La dépense part")).toBeVisible()
  await expect.poll(async () => (await depensesBudgetEnBase(equipe)).some((d) => d.libelle === "Pneus" && d.montant === 4550)).toBe(true)

  // Le solde du membre : 45,50 € dus, à rembourser.
  await page.goto("/apps/budget/membres")
  await expect(page.getByText(/La team doit\s+45,50/)).toBeVisible()

  // Remboursement partiel (20 €) depuis la caisse, puis le reste.
  await page.goto(`/apps/budget/membres?rembourser=${personneResponsable}`)
  await page.getByRole("checkbox", { name: "Rembourser Pneus" }).check()
  await page.getByLabel("Montant pour Pneus").fill("20,00")
  await page.getByLabel("Payé depuis").selectOption({ label: "Caisse de la team" })
  await page.getByRole("button", { name: "Rembourser" }).click()
  await expect(page.getByText("Remboursement enregistré")).toBeVisible()
  await expect.poll(async () => rembourseEnBase(equipe, personneResponsable)).toBe(2000)
  await expect.poll(async () => (await depensesBudgetEnBase(equipe)).find((d) => d.libelle === "Pneus")?.remboursement).toBe("partiel")

  await page.goto(`/apps/budget/membres?rembourser=${personneResponsable}`)
  await page.getByRole("checkbox", { name: "Rembourser Pneus" }).check()
  await page.getByLabel("Payé depuis").selectOption({ label: "Caisse de la team" })
  await page.getByRole("button", { name: "Rembourser" }).click()
  await expect(page.getByText("Remboursement enregistré")).toBeVisible()
  await expect.poll(async () => (await depensesBudgetEnBase(equipe)).find((d) => d.libelle === "Pneus")?.remboursement).toBe("rembourse")

  // Un mouvement proposé par le garage : confirmé depuis « À confirmer ».
  proposerMouvementBudget(equipe, "Pièce proposée", 12_000)
  await page.goto("/apps/budget/a-confirmer")
  await expect(page.getByRole("heading", { name: "Pièce proposée" })).toBeVisible()
  await page.getByRole("button", { name: "Confirmer" }).click()
  await expect(page.getByRole("heading", { name: "Pièce proposée" })).toHaveCount(0)
  await expect.poll(async () => (await depensesBudgetEnBase(equipe)).some((d) => d.libelle === "Pièce proposée" && d.origine === "proposee")).toBe(true)

  // L'assistance : ne voit que ses dépenses, ni les autres ni le solde de la team.
  const assist = await connecterMembre(browser, assistante)
  try {
    await ouvrirBudget(assist.page)
    await assist.page.goto("/apps/budget/nouvelle")
    await expect(assist.page.getByLabel("Payé par")).toHaveCount(1)
    await assist.page.getByLabel("Montant (€)").fill("12,00")
    await assist.page.getByLabel("Catégorie", { exact: true }).selectOption({ label: "Repas" })
    await assist.page.getByRole("button", { name: "Ajouter la dépense" }).click()
    await expect(assist.page.getByText("Enregistré. La dépense part")).toBeVisible()
    await expect.poll(async () => (await depensesBudgetEnBase(equipe)).some((d) => d.libelle === "Repas")).toBe(true)

    await assist.page.goto("/apps/budget")
    await expect(assist.page.locator("ul li", { hasText: "Repas" })).toBeVisible()
    await expect(assist.page.locator("ul li", { hasText: "Pneus" })).toHaveCount(0)
    await expect(assist.page.getByText("Pièce proposée")).toHaveCount(0)
    await assist.page.goto("/apps/budget/membres")
    await expect(assist.page.getByText("Responsable E2E")).toHaveCount(0)
    await assist.page.goto("/apps/budget/a-confirmer")
    await expect(assist.page.getByText("Tu n'as pas accès à cette app")).toBeVisible()
  } finally {
    await assist.fermer()
  }
})

// Le CSV reprend les mouvements filtrés, en UTF-8 avec BOM et point-virgule.
test("budget : export CSV des mouvements", async ({ page, equipe }) => {
  await preparerSaison(equipe, SAISON)
  await rattacherPersonne(equipe, equipe.responsable, "Responsable", "E2E")
  await connecterParLien(page, equipe)
  await ouvrirBudget(page)
  await page.goto("/apps/budget/nouvelle")
  await page.getByLabel("Montant (€)").fill("3,20")
  await page.getByLabel("Catégorie", { exact: true }).selectOption({ label: "Péages" })
  await page.getByRole("button", { name: "Ajouter la dépense" }).click()
  await expect.poll(async () => (await depensesBudgetEnBase(equipe)).some((d) => d.libelle === "Péages")).toBe(true)

  const reponse = await page.request.get("/apps/budget/export")
  expect(reponse.headers()["content-type"]).toContain("text/csv")
  const corps = await reponse.text()
  expect(corps.startsWith("﻿")).toBe(true)
  expect(corps).toContain("Date;Sens;Libellé;Catégorie;Payeur;Montant (€);Statut")
  expect(corps).toContain("Péages;Responsable E2E;3,20;")
})

// Captures : Mouvements, Nouvelle dépense, Par membre et Prévisionnel, en PC et en téléphone.
test("captures de Budget : mouvements, nouvelle dépense, par membre, prévisionnel", async ({ page, equipe }) => {
  await preparerSaison(equipe, SAISON)
  await rattacherPersonne(equipe, equipe.responsable, "Responsable", "E2E")
  await connecterParLien(page, equipe)
  await ouvrirBudget(page)
  await page.goto("/apps/budget/nouvelle")
  await page.getByLabel("Montant (€)").fill("45,50")
  await page.getByLabel("Catégorie", { exact: true }).selectOption({ label: "Pneus" })
  await page.getByRole("button", { name: "Ajouter la dépense" }).click()
  await expect.poll(async () => (await depensesBudgetEnBase(equipe)).some((d) => d.libelle === "Pneus")).toBe(true)

  for (const [largeur, hauteur, suffixe] of [[1440, 900, "1440x900"], [360, 740, "360x740"]] as const) {
    await page.setViewportSize({ width: largeur, height: hauteur })
    await page.goto("/apps/budget")
    await expect(page.getByRole("heading", { name: "Mouvements" })).toBeVisible()
    await page.screenshot({ path: `docs/captures/budget-mouvements-${suffixe}.png`, fullPage: true })
    await page.goto("/apps/budget/nouvelle")
    await page.screenshot({ path: `docs/captures/budget-nouvelle-depense-${suffixe}.png`, fullPage: true })
    await page.goto("/apps/budget/membres")
    await page.screenshot({ path: `docs/captures/budget-par-membre-${suffixe}.png`, fullPage: true })
    await page.goto("/apps/budget/previsionnel")
    await page.screenshot({ path: `docs/captures/budget-previsionnel-${suffixe}.png`, fullPage: true })
  }
})
