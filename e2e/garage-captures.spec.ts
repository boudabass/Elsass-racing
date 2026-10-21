// Captures du Garage pour la tâche 4.3 : Travaux, Intervention (1440 et 360 px) et Commandes. Chaque capture suit un
// parcours réel (une intervention saisie, une commande saisie), pas une base écrite à la main. Les captures partent dans
// docs/captures/ (garage-travaux-*, garage-intervention-*, garage-commandes-*) ; elles sont relues avant d'être commitées.
import path from "node:path"

import type { Page } from "@playwright/test"

import { TYPES_DEFAUT } from "../src/apps/garage/types-defaut"

import { envoyer } from "./aide/envoi"
import { fournisseurDeTest, personneResponsableDeTest, preparerAtelierSaxo } from "./aide/garage"
import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { ajouterVoitureSaxo } from "./aide/session"

const DOSSIER = path.join(__dirname, "..", "docs", "captures")
const BUREAU = { width: 1440, height: 900 }
const TELEPHONE = { width: 360, height: 740 }

// Capture pleine page : éléments fixes masqués, sauf le tiroir ouvert (même convention que garage.spec.ts).
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

test("captures · travaux, intervention et commandes du Garage, à 1440 et à 360 px", async ({ page, equipe }) => {
  test.setTimeout(240_000)
  const vehicleId = await ajouterVoitureSaxo(equipe, "Saxo captures garage")
  const organes = await preparerAtelierSaxo(equipe, vehicleId)
  await personneResponsableDeTest(equipe)
  const fournisseurId = await fournisseurDeTest(equipe, "Pièces rallye test")
  const nomFreins = TYPES_DEFAUT.find((type) => type.cle === "freins")?.nom ?? "Freins"

  await connecterParLien(page, equipe)

  // Intervention saisie sans pièce : le formulaire part, puis la liste des travaux montre l'ordre.
  await page.setViewportSize(BUREAU)
  await page.goto(`/apps/garage/intervention?vehicule=${vehicleId}`)
  await expect(page.getByRole("heading", { name: "Intervention", exact: true })).toBeVisible()
  await capturerPage(page, "garage-intervention-1440.png")
  await page.locator('select[name="vehicleComponentId"]').selectOption(organes.freins)
  await page.getByLabel("Ce qui a été fait").fill("Plaquettes avant changées")
  await envoyer(page, page.getByRole("button", { name: "Enregistrer l'intervention", exact: true }))
  await expect(page).toHaveURL(/\/apps\/garage\/travaux/)
  await expect(page.getByText("Plaquettes avant changées").first()).toBeVisible()
  await capturerPage(page, "garage-travaux-1440.png")

  // Le même formulaire sur téléphone.
  await page.setViewportSize(TELEPHONE)
  await page.goto(`/apps/garage/intervention?vehicule=${vehicleId}`)
  await expect(page.getByRole("heading", { name: "Intervention", exact: true })).toBeVisible()
  await capturerPage(page, "garage-intervention-360.png")

  // Commande saisie : elle apparaît dans les livraisons attendues.
  await page.setViewportSize(BUREAU)
  await page.goto(`/apps/garage/commandes?vehicule=${vehicleId}`)
  await page.getByRole("link", { name: "Nouvelle commande", exact: true }).click()
  await page.locator('select[name="supplierContactId"]').selectOption(fournisseurId)
  await page.locator('input[name="ligne1Designation"]').fill("Plaquettes avant")
  await page.locator('select[name="ligne1ComponentTypeId"]').selectOption({ label: nomFreins })
  await page.locator('input[name="ligne1Quantite"]').fill("2")
  await page.locator('input[name="ligne1Prix"]').fill("12,50")
  await envoyer(page, page.getByRole("button", { name: "Enregistrer la commande", exact: true }))
  await expect(page.getByRole("heading", { name: "Livraisons attendues (1)" })).toBeVisible()
  await capturerPage(page, "garage-commandes-1440.png")
})
