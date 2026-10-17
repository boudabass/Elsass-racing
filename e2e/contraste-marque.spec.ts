import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"

// Brief 2.10, point 1 : le texte posé sur le bouton principal reste lisible en thème sombre (WCAG 1.4.3, 4,5:1).
// Le contraste se calcule sur les styles calculés de la page, pas sur les valeurs de configuration.

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

test("bouton principal : texte lisible sur la couleur de team en thème sombre (4,5:1 au moins)", async ({ page, equipe }) => {
  await connecterParLien(page, equipe)
  await page.goto("/apps/budget")
  const commencer = page.getByRole("button", { name: "Commencer" })
  if (await commencer.waitFor({ state: "visible", timeout: 5_000 }).then(() => true).catch(() => false)) await commencer.click()
  const bouton = page.getByRole("link", { name: "Ajouter une dépense" })
  await expect(bouton).toBeVisible()

  const theme = await page.evaluate(() => document.documentElement.classList.contains("dark"))
  expect(theme).toBe(true)

  const styles = await bouton.evaluate((element) => {
    const calcule = getComputedStyle(element)
    return { texte: calcule.color, fond: calcule.backgroundColor }
  })
  const ratio = contraste(lireRgb(styles.texte), lireRgb(styles.fond))
  expect(ratio, `texte ${styles.texte} sur fond ${styles.fond}`).toBeGreaterThanOrEqual(4.5)
})
