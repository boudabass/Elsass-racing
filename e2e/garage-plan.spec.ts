// Plan avant épreuve (tâche 4.5, brief §5 ; 954 v1.4 §2 et §5). Un organe en zone rouge apparaît dans le plan, et côté
// Saison sous « À surveiller », sans toucher à l'indice ; la réparation à 80 % lève l'alerte. Le plan ne montre aucun
// coût à l'assistance. Le parcours part des tuiles et des menus, depuis le QG ; seule l'entrée est une URL.
// Les captures partent dans docs/captures/ (garage-plan-*) et sont relues avant commit.
import path from "node:path"

import type { Browser, Page } from "@playwright/test"

import { preparerAtelierSaxo } from "./aide/garage"
import { envoyer } from "./aide/envoi"
import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import {
  ajouterEpreuveEnBase,
  ajouterMembreConnectable,
  ajouterSpecialeEnBase,
  ajouterVoitureSaxo,
  engagerVehiculeEnBase,
  preparerSaison,
  type Membre,
} from "./aide/session"

const DOSSIER = path.join(__dirname, "..", "docs", "captures")
const BUREAU = { width: 1440, height: 900 }
const TELEPHONE = { width: 360, height: 740 }
const ANNEE = 2027

// Capture pleine page : éléments fixes masqués, sauf le tiroir ouvert (même convention que garage-casses.spec.ts).
async function capturerPage(page: Page, nom: string): Promise<void> {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" })
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>("body *").forEach((element) => {
      if (element.closest('[role="dialog"]')) return
      if (getComputedStyle(element).position === "fixed") element.style.display = "none"
    })
  })
  await page.screenshot({ path: path.join(DOSSIER, nom), fullPage: true, animations: "disabled" })
}

// Aucun défilement horizontal sur la page, à la largeur courante.
async function sansDefilementHorizontal(page: Page): Promise<void> {
  const deborde = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(deborde, "défilement horizontal sur la page").toBe(false)
}

// Un membre connecté dans son propre contexte.
async function connecterMembre(browser: Browser, membre: Membre & { secretLien: string }): Promise<{ page: Page; fermer: () => Promise<void> }> {
  const contexte = await browser.newContext()
  const page = await contexte.newPage()
  await page.goto(`/connexion/lien?t=${membre.secretLien}`)
  await page.waitForURL(/\/qg$/)
  return { page, fermer: () => contexte.close() }
}

// Tuile d'une app sur le QG (le lien, pas le texte seul : les menus ont les mêmes libellés).
function tuile(page: Page, cle: string) {
  return page.locator(`a[href="/apps/${cle}"]`).filter({ has: page.locator("h2") })
}

// Retour au QG par le lien d'enveloppe, comme John.
async function retourAuQg(page: Page): Promise<void> {
  await page.getByRole("link", { name: /retour au QG/ }).filter({ visible: true }).first().click()
  await page.waitForURL(/\/qg$/)
}

// L'épreuve de test, ouverte par Saison (liste, puis l'épreuve) : son panneau « Prêt pour l'épreuve ? » est l'onglet par défaut.
async function ouvrirEpreuveDansSaison(page: Page): Promise<void> {
  await tuile(page, "saison").click()
  await page.getByRole("link", { name: "Liste", exact: true }).click()
  await page.getByRole("link", { name: /Rallye plan e2e/ }).first().click()
  await expect(page).toHaveURL(/\/apps\/saison\/epreuves\/[0-9a-f-]{36}/)
}

// Valeur lisible de l'indice de préparation (« Préparation : N pour cent »).
async function indiceDePreparation(page: Page): Promise<string | null> {
  return page.locator('[aria-label^="Préparation : "]').first().getAttribute("aria-label")
}

test("plan avant épreuve : zone rouge à surveiller dans Saison sans baisser l'indice, réparation, alerte levée", async ({ browser, page, equipe }) => {
  test.setTimeout(300_000)

  // Données : une Saxo avec son atelier (l'embrayage, à 2 %, est en zone rouge), une épreuve à venir avec une spéciale.
  const vehicleId = await ajouterVoitureSaxo(equipe, "Saxo plan e2e")
  await preparerAtelierSaxo(equipe, vehicleId)
  const saisonId = await preparerSaison(equipe, ANNEE)
  const epreuve = await ajouterEpreuveEnBase(equipe, saisonId, "Rallye plan e2e", `${ANNEE}-05-10`, `${ANNEE}-05-11`)
  await ajouterSpecialeEnBase(equipe, epreuve, 1, "ES 1 plan", 10, 2)
  await engagerVehiculeEnBase(equipe, epreuve, vehicleId, "inscrit")

  // Le responsable entre par le QG, puis la tuile Garage et le menu Plan avant épreuve.
  await connecterParLien(page, equipe)
  await page.setViewportSize(BUREAU)
  await tuile(page, "garage").click()
  await page.getByRole("link", { name: "Plan avant épreuve", exact: true }).click()
  await expect(page).toHaveURL(/\/apps\/garage\/plan/)
  await expect(page.getByRole("heading", { name: "Plan avant épreuve", level: 1 })).toBeVisible()
  await expect(page.getByRole("link", { name: "Embrayage", exact: true })).toBeVisible()
  await expect(page.getByText(/Zone rouge · 2\s%/).first()).toBeVisible()
  await capturerPage(page, "garage-plan-avant-epreuve-1440.png")
  await page.setViewportSize(TELEPHONE)
  await sansDefilementHorizontal(page)
  await capturerPage(page, "garage-plan-avant-epreuve-360.png")

  // Saison : l'organe en zone rouge est « À surveiller », sous les points, et l'indice ne le compte pas.
  await page.setViewportSize(BUREAU)
  await retourAuQg(page)
  await ouvrirEpreuveDansSaison(page)
  await expect(page.getByText("À surveiller, sans effet sur l'indice")).toBeVisible()
  await expect(page.getByText("Garage : 1 organe(s) en zone rouge")).toBeVisible()
  await expect(page.getByRole("link", { name: "Voir le plan avant épreuve" })).toBeVisible()
  const indiceAvant = await indiceDePreparation(page)
  expect(indiceAvant, "indice de préparation affiché").not.toBeNull()

  // Réparation depuis le plan : la fiche de l'embrayage, Réparer, puis la fin de l'ordre à 80 %.
  await retourAuQg(page)
  await tuile(page, "garage").click()
  await page.getByRole("link", { name: "Plan avant épreuve", exact: true }).click()
  await page.getByRole("link", { name: "Embrayage", exact: true }).click()
  await expect(page).toHaveURL(/\/apps\/garage\/organes\/[0-9a-f-]{36}$/)
  await page.getByRole("button", { name: "Réparer", exact: true }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.getByLabel("Ce qui est réparé").fill("Kit d'embrayage remplacé")
  await envoyer(page, page.getByRole("button", { name: "Ajouter la réparation", exact: true }))
  await expect(page).toHaveURL(/\/apps\/garage\/travaux/)
  await page.getByRole("link", { name: /Kit d'embrayage remplacé/ }).first().click()
  await expect(page).toHaveURL(/\/apps\/garage\/travaux\/[0-9a-f-]+$/)
  await page.getByRole("button", { name: "Terminer l'ordre", exact: true }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.getByLabel("État de la pièce après réparation (%)").fill("80")
  await envoyer(page, page.getByRole("dialog").getByRole("button", { name: "Terminer l'ordre", exact: true }))
  await expect(page.getByText("Cet ordre est terminé : il ne se modifie plus.")).toBeVisible()

  // Saison de nouveau : l'alerte est levée sans événement de sortie, et l'indice ne bouge pas.
  await retourAuQg(page)
  await ouvrirEpreuveDansSaison(page)
  await expect(page.getByText("Garage : aucun organe en zone rouge")).toBeVisible()
  await expect(page.getByText("Garage : 1 organe(s) en zone rouge")).toHaveCount(0)
  expect(await indiceDePreparation(page)).toBe(indiceAvant)

  // Assistance : le plan s'ouvre, sans aucun coût.
  const assistance = await ajouterMembreConnectable(equipe, "assistance")
  const a = await connecterMembre(browser, assistance)
  try {
    await tuile(a.page, "garage").click()
    await a.page.getByRole("link", { name: "Plan avant épreuve", exact: true }).click()
    await expect(a.page.getByRole("heading", { name: "Plan avant épreuve", level: 1 })).toBeVisible()
    await expect(a.page.getByText("Zone rouge", { exact: false }).first()).toBeVisible()
    // Le solde de l'en-tête peut afficher un montant : le contrôle ne porte que sur la zone principale.
    await expect(a.page.locator("main").getByText("de main-d'œuvre")).toHaveCount(0)
    await expect(a.page.locator("main").getByText("€")).toHaveCount(0)
  } finally {
    await a.fermer()
  }
})
