// Garage (tâche 4.2, brief §2 à §5) : le parcours du responsable entre par la tuile, puis clique (menu, bouton +,
// fiches, tiroirs). Le roulage fait passer la boîte en zone rouge ; on vérifie la carte, puis les km écrits en base. Le
// parcours de l'assistance vérifie qu'aucun bouton d'écriture n'est actif et qu'aucun prix n'apparaît. Les captures
// partent dans docs/captures/ (garage-*). Les aides d'écriture directe sont dans e2e/aide/garage.ts.
import path from "node:path"

import type { Page } from "@playwright/test"

import { kmPieceMonteeEnBase, preparerAtelierSaxo } from "./aide/garage"
import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { ajouterMembreConnectable, ajouterVoitureSaxo } from "./aide/session"

const DOSSIER = path.join(__dirname, "..", "docs", "captures")
const BUREAU = { width: 1440, height: 900 }
const TELEPHONE = { width: 360, height: 740 }

// Capture de l'écran visible (tiroir compris, qui est un dialogue).
async function capturerEcran(page: Page, nom: string): Promise<void> {
  await page.screenshot({ path: path.join(DOSSIER, nom), fullPage: false, animations: "disabled" })
}

// Capture pleine page : éléments fixes masqués, sauf le tiroir ouvert.
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

// Entrée par la tuile du QG, comme un membre le fait.
async function ouvrirGarageDepuisQg(page: Page): Promise<void> {
  await page.goto("/qg")
  await page.locator('a[href="/apps/garage"]').filter({ has: page.locator("h2") }).click()
  await expect(page.getByRole("heading", { name: "Atelier", exact: true })).toBeVisible()
}

// Le menu « + » (bureau) : ouvre l'entrée demandée puis la clique.
async function ouvrirDepuisPlus(page: Page, libelle: string): Promise<void> {
  await page.getByRole("button", { name: "Ajouter", exact: true }).click()
  await page.getByRole("menuitem", { name: libelle, exact: true }).click()
}

test("responsable · tuile, durée, pièces, remplacement et roulage jusqu'à la zone rouge", async ({ page, equipe }) => {
  const vehicleId = await ajouterVoitureSaxo(equipe, "Saxo 2")
  const organes = await preparerAtelierSaxo(equipe, vehicleId)
  await connecterParLien(page, equipe)
  await page.setViewportSize(BUREAU)

  await ouvrirGarageDepuisQg(page)

  // Durée de vie des freins, jamais renseignée : « À renseigner », puis la zone verte à 100 %.
  const freins = page.getByRole("listitem").filter({ hasText: "Freins" })
  await freins.getByRole("button", { name: "Renseigner la durée de vie" }).click()
  await page.getByLabel("Durée en kilomètres").fill("40000")
  await page.getByLabel("Durée en épreuves").fill("10")
  await page.getByRole("button", { name: "Enregistrer la durée" }).click()
  await expect(page.getByRole("link", { name: "Freins, Bon, 100%" })).toBeVisible()

  // Bouton + « Pièce » : une rechange pour l'embrayage, sur sa page.
  await ouvrirDepuisPlus(page, "Pièce")
  await expect(page.getByRole("heading", { name: "Nouvelle pièce", exact: true })).toBeVisible()
  await page.getByLabel("Organe").selectOption({ label: "Embrayage" })
  await page.getByLabel("Désignation").fill("Kit d'embrayage renforcé")
  await page.getByLabel("Marque").fill("Sachs")
  await page.getByLabel("Référence").fill("3000 951 800")
  await page.getByLabel("Emplacement").fill("Remorque")
  await page.getByRole("button", { name: "Ajouter la pièce", exact: true }).click()
  await expect(page).toHaveURL(/\/apps\/garage\/stock/)
  await expect(page.getByText("Kit d'embrayage renforcé", { exact: true })).toBeVisible()

  // Le stock : une seconde rechange, par le tiroir de la page (même formulaire, autre porte d'entrée).
  await page.getByRole("button", { name: "Ajouter une pièce", exact: true }).click()
  await page.getByLabel("Organe").selectOption({ label: "Amortisseurs" })
  await page.getByLabel("Désignation").fill("Amortisseurs arrière")
  await page.getByLabel("Marque").fill("Koni")
  await page.getByRole("button", { name: "Ajouter la pièce", exact: true }).click()
  await expect(page.getByText("Amortisseurs arrière", { exact: true })).toBeVisible()
  await expect(page.getByRole("dialog")).toBeHidden()
  await capturerPage(page, "garage-stock-1440.png")

  // Remplacer l'embrayage : depuis son repère à l'atelier, la fiche de l'organe, puis le tiroir.
  await page.getByRole("link", { name: "Atelier", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Atelier", exact: true })).toBeVisible()
  await page.getByRole("link", { name: "Embrayage, Zone rouge, 2%" }).click()
  await expect(page).toHaveURL(new RegExp(`/apps/garage/organes/${organes.embrayage}$`))
  await page.getByRole("button", { name: "Remplacer", exact: true }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await capturerEcran(page, "garage-remplacer-1440.png")
  await page.getByRole("button", { name: "Remplacer la pièce", exact: true }).click()
  await expect(page.getByRole("dialog")).toBeHidden()
  // La fiche la nomme deux fois (pièce montée, puis historique de pose) : la première occurrence suffit, la base tranche.
  await expect(page.getByText("Kit d'embrayage renforcé", { exact: true }).first()).toBeVisible()
  expect(await kmPieceMonteeEnBase(organes.embrayage), "km de la rechange posée").toBe(0)
  await capturerPage(page, "garage-fiche-organe-1440.png")

  // Retour à l'atelier par le menu de l'app, puis roulage : 16 000 km, épreuve non comptée.
  await page.getByRole("link", { name: "Atelier", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Atelier", exact: true })).toBeVisible()
  await ouvrirDepuisPlus(page, "Roulage")
  await page.getByLabel("Kilomètres roulés").fill("16000")
  await page.getByRole("button", { name: "Enregistrer le roulage", exact: true }).click()
  await expect(page).toHaveURL(/\/apps\/garage\?vehicule=/)

  // La boîte passe en zone rouge (8 000 km restants sur 120 000 : 7 %). Le mot de l'indice la nomme.
  await expect(page.getByRole("link", { name: "Boîte de vitesses, Zone rouge, 7%" })).toBeVisible()
  await expect(page.getByText("Zone rouge : boîte de vitesses", { exact: true })).toBeVisible()
  expect(await kmPieceMonteeEnBase(organes.boite), "km de la boîte en base").toBe(112000)
  expect(await kmPieceMonteeEnBase(organes.embrayage), "km de la rechange en base").toBe(16000)

  // Téléphone : la fiche de l'organe tient dans la largeur, sans défilement horizontal.
  await page.setViewportSize(TELEPHONE)
  await page.goto(`/apps/garage/organes/${organes.boite}`)
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  await sansDefilementHorizontal(page)
  await capturerPage(page, "garage-fiche-organe-360.png")
})

test("assistance · lecture de l'atelier et du stock, aucun prix, aucun bouton d'écriture actif", async ({ page, equipe }) => {
  const vehicleId = await ajouterVoitureSaxo(equipe, "Saxo 2")
  await preparerAtelierSaxo(equipe, vehicleId)
  const assistance = await ajouterMembreConnectable(equipe, "assistance")
  await page.goto(`/connexion/lien?t=${assistance.secretLien}`)
  await page.waitForURL(/\/qg$/)
  await page.setViewportSize(BUREAU)

  await ouvrirGarageDepuisQg(page)

  // Les freins sans durée : le bouton est là, désactivé, avec la raison.
  const freins = page.getByRole("listitem").filter({ hasText: "Freins" })
  await expect(freins.getByRole("button", { name: "Renseigner la durée de vie" })).toBeDisabled()
  await expect(page.getByText("Seul l'équipage peut renseigner la durée de vie.", { exact: true }).first()).toBeVisible()

  // Le « + » ne propose ni Pièce ni Roulage à l'assistance.
  await page.getByRole("button", { name: "Ajouter", exact: true }).click()
  await expect(page.getByRole("menuitem", { name: "Pièce", exact: true })).toHaveCount(0)
  await expect(page.getByRole("menuitem", { name: "Roulage", exact: true })).toHaveCount(0)
  await page.keyboard.press("Escape")

  // Le stock : lecture seule, aucun prix, bouton d'ajout désactivé avec la raison.
  await page.getByRole("link", { name: "Stock", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Stock", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Ajouter une pièce", exact: true })).toBeDisabled()
  await expect(page.getByText("Seul l'équipage peut ajouter une pièce.", { exact: true })).toBeVisible()
  await expect(page.getByText("Prix", { exact: true })).toHaveCount(0)
  await expect(page.getByText("Fournisseur", { exact: true })).toHaveCount(0)

  // Le filtre des pièces usées : vide, et le message le dit.
  await page.getByRole("link", { name: "Usées, cassées, vendues", exact: true }).click()
  await expect(page.getByText("Aucune pièce usée, cassée ou vendue pour cette voiture.", { exact: true })).toBeVisible()
  await capturerPage(page, "garage-stock-vide-1440.png")

  // La fiche d'un organe : aucun bouton d'écriture actif.
  await page.getByRole("link", { name: "Atelier", exact: true }).click()
  await page.getByRole("link", { name: "Embrayage, Zone rouge, 2%" }).click()
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  await expect(page.locator("button:enabled").filter({ hasText: /Remplacer|Régler|Retirer/ })).toHaveCount(0)
})
