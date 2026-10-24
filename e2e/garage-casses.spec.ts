// Casse de bout en bout (954 §1, §3, §5 ; tâche 4.4, brief §4) : un membre saisit un abandon dans Saison, un autre le
// valide ; la fiche casse s'ouvre au Garage, à compléter ; le responsable la complète, puis ouvre la réparation depuis
// l'organe touché. Le parcours part de la tuile Garage ; seule l'entrée est une URL. Les captures partent dans
// docs/captures/ (garage-casses-*) et sont relues avant commit.
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
  donnerAccesSaison,
  engagerVehiculeEnBase,
  passerEpreuveDansLePasseEnBase,
  preparerSaison,
  type Membre,
} from "./aide/session"

const DOSSIER = path.join(__dirname, "..", "docs", "captures")
const BUREAU = { width: 1440, height: 900 }
const TELEPHONE = { width: 360, height: 740 }
const ANNEE = 2025
const DATE_CASSE = `${ANNEE}-05-10`

// Capture pleine page : éléments fixes masqués, sauf le tiroir ouvert (même convention que garage-reparation.spec.ts).
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

// Un membre connecté dans son propre contexte, comme dans saison-resultats.spec.ts.
async function connecterMembre(browser: Browser, membre: Membre & { secretLien: string }): Promise<{ page: Page; fermer: () => Promise<void> }> {
  const contexte = await browser.newContext()
  const page = await contexte.newPage()
  await page.goto(`/connexion/lien?t=${membre.secretLien}`)
  await page.waitForURL(/\/qg$/)
  return { page, fermer: () => contexte.close() }
}

test("casse de bout en bout : abandon validé dans Saison, fiche au Garage, complétée, réparation ouverte", async ({ browser, page, equipe }) => {
  test.setTimeout(300_000)

  // Données : une voiture Saxo avec son atelier, une épreuve passée avec une spéciale, la voiture engagée.
  const vehicleId = await ajouterVoitureSaxo(equipe, "Saxo casse e2e")
  await preparerAtelierSaxo(equipe, vehicleId)
  const saisonId = await preparerSaison(equipe, ANNEE)
  const epreuve = await ajouterEpreuveEnBase(equipe, saisonId, "Rallye casse e2e", DATE_CASSE, `${ANNEE}-05-11`)
  await ajouterSpecialeEnBase(equipe, epreuve, 1, "ES 3 casse", 12.5, 1)
  await engagerVehiculeEnBase(equipe, epreuve, vehicleId, "parti")
  await passerEpreuveDansLePasseEnBase(equipe, epreuve, DATE_CASSE, `${ANNEE}-05-11`)

  const equipierA = await ajouterMembreConnectable(equipe, "equipage")
  const equipierB = await ajouterMembreConnectable(equipe, "equipage", "-b")
  await donnerAccesSaison(equipe, equipierA, "ecriture")
  await donnerAccesSaison(equipe, equipierB, "ecriture")
  const fiche = `/apps/saison/epreuves/${epreuve}?onglet=resultats`

  // A saisit un abandon : statut, cause et spéciale d'abandon.
  const a = await connecterMembre(browser, equipierA)
  try {
    await a.page.goto(fiche)
    await a.page.getByRole("button", { name: /^(Saisir|Modifier) le résultat$/ }).click()
    await a.page.getByLabel("Statut final").selectOption({ label: "Abandon" })
    await a.page.getByRole("button", { name: "Plus de détails", exact: true }).click()
    await a.page.getByLabel("Cause de l'abandon").fill("Casse de cardan")
    await a.page.getByLabel("Spéciale d'abandon").selectOption({ label: "1. ES 3 casse" })
    await a.page.getByRole("dialog").getByRole("button", { name: "Enregistrer le résultat", exact: true }).click()
    await expect(a.page.getByRole("dialog")).toHaveCount(0)
  } finally {
    await a.fermer()
  }

  // B valide : l'abandon est déclaré, et la fiche casse s'ouvre au Garage.
  const b = await connecterMembre(browser, equipierB)
  try {
    await b.page.goto("/apps/saison/a-valider")
    await b.page.getByRole("button", { name: "Valider", exact: true }).click()
    await expect(b.page.locator("main").getByRole("link", { name: /Rallye casse e2e/ })).toHaveCount(0)
  } finally {
    await b.fermer()
  }

  // Le responsable entre par la tuile Garage, puis le menu Casses.
  await connecterParLien(page, equipe)
  await page.setViewportSize(BUREAU)
  await page.locator('a[href="/apps/garage"]').filter({ has: page.locator("h2") }).click()
  await page.getByRole("link", { name: "Casses", exact: true }).click()
  await expect(page).toHaveURL(/\/apps\/garage\/casses/)
  await expect(page.getByRole("link", { name: /10 mai 2025 · Rallye casse e2e/ })).toBeVisible()
  await expect(page.getByText("À compléter", { exact: true })).toBeVisible()
  await capturerPage(page, "garage-casses-liste-1440.png")

  // La fiche : type et cause saisis, organe touché choisi, puis enregistrée.
  await page.getByRole("link", { name: /10 mai 2025 · Rallye casse e2e/ }).click()
  await expect(page).toHaveURL(/\/apps\/garage\/casses\/[0-9a-f-]+$/)
  await expect(page.getByRole("heading", { name: "Casse du 10 mai 2025", exact: true, level: 1 })).toBeVisible()
  await page.getByLabel("Type de casse").selectOption({ label: "Casse mécanique" })
  await page.getByLabel("Cause (facultatif)").fill("Casse de cardan")
  await page.getByRole("checkbox", { name: "Boîte de vitesses", exact: true }).check()
  await envoyer(page, page.getByRole("button", { name: "Enregistrer la fiche", exact: true }))
  await expect(page.getByText("À compléter", { exact: true })).toHaveCount(0)

  // La réparation s'ouvre depuis l'organe touché : elle part dans les travaux, titrée « Casse : <épreuve> ».
  await envoyer(page, page.getByRole("button", { name: "Ouvrir une réparation : Boîte de vitesses", exact: true }))
  await expect(page).toHaveURL(/\/apps\/garage\/travaux\/[0-9a-f-]+$/)
  await expect(page.getByText("Casse : Rallye casse e2e").first()).toBeVisible()

  // Retour à la fiche : elle garde le lien vers la réparation, qu'on ne peut pas ouvrir une seconde fois.
  await page.getByRole("link", { name: "Casses", exact: true }).click()
  await page.getByRole("link", { name: /10 mai 2025 · Rallye casse e2e/ }).click()
  await expect(page.getByRole("link", { name: "Voir la réparation liée", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: /Ouvrir une réparation/ })).toHaveCount(0)
  await capturerPage(page, "garage-casses-fiche-1440.png")

  // Téléphone : la fiche tient dans la largeur, sans défilement horizontal.
  await page.setViewportSize(TELEPHONE)
  await expect(page.getByRole("heading", { name: "Casse du 10 mai 2025", exact: true, level: 1 })).toBeVisible()
  await sansDefilementHorizontal(page)
  await capturerPage(page, "garage-casses-fiche-360.png")
})
