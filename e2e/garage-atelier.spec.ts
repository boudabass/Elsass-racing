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
  await expect(page.getByRole("group", { name: /^Silhouette de Saxo 2, vue droite/ })).toBeVisible()
  await capturer(page, "garage-atelier-1440.png")

  await page.setViewportSize(TELEPHONE)
  await expect(page.getByRole("heading", { name: "Atelier", exact: true })).toBeVisible()
  const deborde = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(deborde, "défilement horizontal sur la page").toBe(false)
  await capturer(page, "garage-atelier-360.png")
})
