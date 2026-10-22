// Atelier du Garage (tâche 4.2, brief §1) : l'écran principal sur une Saxo avec ses organes, à 1440 et à 360 px. Les
// captures partent dans docs/captures/ (garage-atelier-*). Le parcours complet du Garage viendra dans garage.spec.ts.
import path from "node:path"

import type { Page } from "@playwright/test"

import { preparerAtelierSaxo } from "./aide/garage"
import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { ajouterVoitureSaxo } from "./aide/session"

const DOSSIER = path.join(__dirname, "..", "docs", "captures")
const BUREAU = { width: 1440, height: 900 }
const TELEPHONE = { width: 360, height: 740 }

// Capture pleine page : les éléments fixes sont masqués, comme dans voiture-deco.spec.ts.
async function capturer(page: Page, nom: string): Promise<void> {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" })
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>("body *").forEach((element) => {
      if (element.closest('[role="dialog"]')) return
      if (getComputedStyle(element).position === "fixed") element.style.display = "none"
    })
  })
  await page.screenshot({ path: path.join(DOSSIER, nom), fullPage: true })
}

test("captures · l'atelier de la Saxo, à 1440 et à 360 px", async ({ page, equipe }) => {
  const vehicleId = await ajouterVoitureSaxo(equipe, "Saxo 2")
  await preparerAtelierSaxo(equipe, vehicleId)
  await connecterParLien(page, equipe)

  await page.setViewportSize(BUREAU)
  await page.goto(`/apps/garage?vehicule=${vehicleId}`)
  await expect(page.getByRole("heading", { name: "Atelier", exact: true })).toBeVisible()
  // La vue de dessus, nez en haut, avec ses repères. Aucune clé technique (« unique », « avant_gauche ») à l'écran.
  await expect(page.getByRole("group", { name: /^Silhouette de Saxo 2, vue de dessus/ })).toBeVisible()
  await expect(page.getByText("Zone rouge : embrayage", { exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "Embrayage, Zone rouge, 2%" })).toBeVisible()
  await expect(page.getByText(/avant_gauche|avant_droit|unique|train/)).toHaveCount(0)
  await capturer(page, "garage-atelier-1440.png")

  await page.setViewportSize(TELEPHONE)
  await expect(page.getByRole("heading", { name: "Atelier", exact: true })).toBeVisible()
  // Téléphone : le repère porte la forme et le pourcentage, et sa zone de contact fait au moins 44 px.
  const repere = page.getByRole("link", { name: "Embrayage, Zone rouge, 2%" })
  await expect(repere).toBeVisible()
  const cible = await repere.boundingBox()
  expect(cible?.width ?? 0, "cible du repère à 360 px").toBeGreaterThanOrEqual(44)
  expect(cible?.height ?? 0, "cible du repère à 360 px").toBeGreaterThanOrEqual(44)
  const deborde = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(deborde, "défilement horizontal sur la page").toBe(false)
  await capturer(page, "garage-atelier-360.png")
})
