// Captures commitées dans docs/captures/ pour la documentation. La team de test reçoit les
// données de Koehling Racing, une alerte et une action en attente, pour que les écrans soient
// représentatifs (compte à rebours, bouton Prochaine étape, badge, pastille).
import path from "node:path"

import type { Page } from "@playwright/test"

import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { preparerDonneesCaptures } from "./aide/session"

const DOSSIER = path.join(__dirname, "..", "docs", "captures")

// Une capture pleine page place les éléments fixes à leur position d'écran : la barre basse
// se retrouverait au milieu de la page. Elle est posée en absolu, au bas du document. Les
// autres éléments fixes (bouton « Prochaine étape » flottant) et l'indicateur de développement
// de Next sont masqués. Seul le rendu de la capture change, pas la page testée.
async function preparerCapture(page: Page): Promise<void> {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" })
  await page.evaluate(() => {
    const barre = document.querySelector<HTMLElement>('nav[aria-label="Navigation rapide"]')
    document.querySelectorAll<HTMLElement>("body *").forEach((element) => {
      if (element !== barre && getComputedStyle(element).position === "fixed") element.style.display = "none"
    })
    if (!barre) return
    barre.style.position = "absolute"
    barre.style.left = "0"
    barre.style.right = "0"
    barre.style.bottom = "auto"
    barre.style.top = `${document.documentElement.scrollHeight - barre.offsetHeight}px`
  })
}

test("captures : QG, Identité et boîte d'actions", async ({ page, equipe }) => {
  preparerDonneesCaptures(equipe)

  await page.setViewportSize({ width: 1440, height: 900 })
  await connecterParLien(page, equipe)
  await expect(page.locator('a[href^="/apps/"]').filter({ has: page.locator("h2") })).toHaveCount(11)
  await preparerCapture(page)
  await page.screenshot({ path: path.join(DOSSIER, "qg-1440x900.png"), fullPage: true })

  // La boîte d'actions s'ouvre dans un panneau fixe : pas de préparation de la page, sinon
  // le panneau serait masqué.
  await page.goto("/qg")
  await page.getByRole("button", { name: /Boîte d'actions/ }).click()
  const panneau = page.getByRole("dialog")
  await expect(panneau.getByText("Valider le résultat du Gaschney")).toBeVisible()
  // Le panneau glisse depuis la droite : on attend la fin de l'animation avant la capture.
  await expect(panneau).toHaveCSS("transform", "none")
  await page.screenshot({ path: path.join(DOSSIER, "boite-actions-1440x900.png") })
  await page.keyboard.press("Escape")

  await page.goto("/apps/settings/identite")
  await expect(page.locator("#couleurPrincipale")).toBeVisible()
  await preparerCapture(page)
  await page.screenshot({ path: path.join(DOSSIER, "identite-1440x900.png"), fullPage: true })

  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto("/qg")
  await expect(page.getByRole("navigation", { name: "Navigation rapide" })).toBeVisible()
  await preparerCapture(page)
  await page.screenshot({ path: path.join(DOSSIER, "qg-360x740.png"), fullPage: true })
})
