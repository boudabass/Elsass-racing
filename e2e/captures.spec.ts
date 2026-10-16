// Captures pleine page, commitées dans docs/captures/ pour la documentation.
import path from "node:path"

import type { Page } from "@playwright/test"

import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"

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

test("captures : QG en 1440×900, QG en 360×740, Identité en 1440×900", async ({ page, equipe }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await connecterParLien(page, equipe)
  await expect(page.locator('a[href^="/apps/"]').filter({ has: page.locator("h2") })).toHaveCount(11)
  await preparerCapture(page)
  await page.screenshot({ path: path.join(DOSSIER, "qg-1440x900.png"), fullPage: true })

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
