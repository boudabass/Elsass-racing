// Pneus (954 §2, tâche 4.4 étape 2) : un train se saisit sans prix, se monte sur l'organe Pneus, son usure et son statut se
// saisissent à la main, et le filtre des trains usés les montre à part. Le parcours part de la tuile Garage et du menu ;
// seule l'entrée est une URL. Les captures partent dans docs/captures/ (garage-pneus-*) et sont relues avant commit.
import path from "node:path"

import type { Page } from "@playwright/test"

import { preparerAtelierSaxo } from "./aide/garage"
import { envoyer } from "./aide/envoi"
import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { ajouterVoitureSaxo } from "./aide/session"

const DOSSIER = path.join(__dirname, "..", "docs", "captures")
const BUREAU = { width: 1440, height: 900 }
const TELEPHONE = { width: 360, height: 740 }

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

test("responsable · un train de pneus : ajouté, monté, usure saisie, filtre des trains usés", async ({ page, equipe }) => {
  test.setTimeout(180_000)
  const vehicleId = await ajouterVoitureSaxo(equipe, "Saxo pneus e2e")
  await preparerAtelierSaxo(equipe, vehicleId)
  await connecterParLien(page, equipe)
  await page.setViewportSize(BUREAU)

  // Entrée depuis la tuile Garage, puis le menu Pneus. Le lien se repère à son adresse : l'atelier affiche aussi un lien « Pneus » vers l'organe.
  await page.locator('a[href="/apps/garage"]').filter({ has: page.locator("h2") }).click()
  await page.locator('a[href="/apps/garage/pneus"]').click()
  await expect(page).toHaveURL(/\/apps\/garage\/pneus/)
  await expect(page.getByRole("heading", { name: "Pneus", exact: true, level: 1 })).toBeVisible()

  // Ajout sans prix : marque, type, modèle, dimensions. Le train entre à la team, non monté.
  await page.getByRole("link", { name: "Ajouter un train", exact: true }).click()
  await page.getByLabel("Marque", { exact: true }).fill("Michelin")
  // Les listes déroulantes sont dans leur libellé : leur nom accessible est « Type », mais getByLabel y lit aussi les options.
  await page.getByRole("combobox", { name: "Type", exact: true }).selectOption({ label: "Pluie" })
  await page.getByLabel("Modèle (facultatif)").fill("Alpin")
  await page.getByLabel("Dimensions (facultatif)").fill("195/55 R15")
  await envoyer(page, page.getByRole("button", { name: "Ajouter le train", exact: true }))
  await expect(page).toHaveURL(/\/apps\/garage\/pneus\?vehicule=/)
  await expect(page.getByText("Michelin").first()).toBeVisible()

  // Monter le train sur l'organe Pneus : le bouton disparaît, le train est monté.
  await page.getByRole("link", { name: "Ouvrir le train", exact: true }).click()
  await expect(page).toHaveURL(/\/apps\/garage\/pneus\/[0-9a-f-]+$/)
  await envoyer(page, page.getByRole("button", { name: "Monter ce train", exact: true }))
  await expect(page.getByRole("button", { name: "Monter ce train", exact: true })).toHaveCount(0)

  // Usure et statut saisis à la main : 42 %, usé.
  await page.getByLabel("Usure estimée, en % (0 à 100)").fill("42")
  await page.getByRole("combobox", { name: "Statut", exact: true }).selectOption({ label: "Usé" })
  await envoyer(page, page.getByRole("button", { name: "Enregistrer l'usure", exact: true }))
  await expect(page.getByLabel("Usure estimée, en % (0 à 100)")).toHaveValue("42")
  await capturerPage(page, "garage-pneus-fiche-1440.png")

  // Un train usé quitte la liste des trains en service, et se retrouve dans le filtre des usés.
  await page.locator('a[href="/apps/garage/pneus"]').click()
  await expect(page.getByText("Michelin")).toHaveCount(0)
  await page.getByRole("link", { name: "Voir les trains usés", exact: true }).click()
  await expect(page.getByText("Michelin").first()).toBeVisible()
  await capturerPage(page, "garage-pneus-usés-1440.png")

  // Téléphone : la liste des usés tient dans la largeur, sans défilement horizontal.
  await page.setViewportSize(TELEPHONE)
  await expect(page.getByText("Michelin").first()).toBeVisible()
  await sansDefilementHorizontal(page)
  await capturerPage(page, "garage-pneus-usés-360.png")
})
