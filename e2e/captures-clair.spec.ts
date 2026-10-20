import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { preparerSaison } from "./aide/session"

// Brief 2.11, point 6 : trois captures en thème clair à 360 px (bouton principal Budget, Prévisionnel
// saison, Nouvelle dépense), et contrôle de lisibilité. Les contrastes se calculent sur les styles
// calculés de la page, comme dans contraste-marque.spec.ts.

const SAISON = 2032

function luminance(rgb: number[]): number {
  const [r, g, b] = rgb.map((valeur) => {
    const c = valeur / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contraste(premier: number[], second: number[]): number {
  const [clair, sombre] = [luminance(premier), luminance(second)].sort((a, b) => b - a)
  return (clair + 0.05) / (sombre + 0.05)
}

function lireRgb(couleur: string): number[] {
  const valeurs = couleur.match(/\d+(\.\d+)?/g)?.slice(0, 3).map(Number)
  if (!valeurs || valeurs.length < 3) throw new Error(`Couleur illisible : ${couleur}`)
  return valeurs
}

async function passerEnThemeClair(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/apps/settings/affichage")
  await page.getByRole("button", { name: "Modifier l'affichage", exact: true }).click()
  const tiroir = page.getByRole("dialog")
  await tiroir.locator("#theme").selectOption("clair")
  await tiroir.getByRole("button", { name: "Enregistrer", exact: true }).click()
  await expect(tiroir).toHaveCount(0)
  await page.reload()
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/)
}

async function ouvrirBudgetSansIntro(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/apps/budget")
  const commencer = page.getByRole("button", { name: "Commencer" })
  if (await commencer.waitFor({ state: "visible", timeout: 5_000 }).then(() => true).catch(() => false)) await commencer.click()
}

test("thème clair, 360 px : bouton principal Budget, Prévisionnel saison, Nouvelle dépense ; lisibilité", async ({ page, equipe }) => {
  await preparerSaison(equipe, SAISON)
  await connecterParLien(page, equipe)
  await passerEnThemeClair(page)
  await page.setViewportSize({ width: 360, height: 740 })

  // 1. Bouton principal de Budget : texte posé sur la couleur de team, 4,5:1 au moins (WCAG 1.4.3).
  await ouvrirBudgetSansIntro(page)
  const bouton = page.getByRole("link", { name: "Ajouter une dépense" })
  await expect(bouton).toBeVisible()
  const styleBouton = await bouton.evaluate((element) => {
    const calcule = getComputedStyle(element)
    return { texte: calcule.color, fond: calcule.backgroundColor }
  })
  expect(contraste(lireRgb(styleBouton.texte), lireRgb(styleBouton.fond))).toBeGreaterThanOrEqual(4.5)
  await page.screenshot({ path: "docs/captures/budget-bouton-principal-clair-360x740.png", fullPage: true })

  // 2. Prévisionnel de la saison.
  await page.goto("/apps/budget/previsionnel")
  await expect(page.getByRole("heading", { name: "Prévisionnel" })).toBeVisible()
  await page.screenshot({ path: "docs/captures/budget-previsionnel-saison-clair-360x740.png", fullPage: true })

  // 3. Nouvelle dépense : le contour du champ Montant tient 3:1 sur le fond (WCAG 1.4.11).
  await page.goto("/apps/budget/nouvelle")
  const champ = page.getByLabel("Montant (€)")
  await expect(champ).toBeVisible()
  const styleChamp = await champ.evaluate((element) => {
    const calcule = getComputedStyle(element)
    const fondPage = getComputedStyle(document.body).backgroundColor
    return { contour: calcule.borderTopColor, fondPage }
  })
  expect(contraste(lireRgb(styleChamp.contour), lireRgb(styleChamp.fondPage))).toBeGreaterThanOrEqual(3)
  await page.screenshot({ path: "docs/captures/budget-nouvelle-depense-clair-360x740.png", fullPage: true })
})
