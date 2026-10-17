import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"

// Brief 2.9, point 3 : le menu de chaque app est rendu par le socle. On clique, on ne tape pas d'URL,
// sauf pour l'entrée initiale sur téléphone.

test("menus : Budget mène à ses pages par clic, l'entrée active est marquée (ordinateur)", async ({ page, equipe }) => {
  await connecterParLien(page, equipe)
  await page.getByRole("navigation", { name: "Apps" }).getByRole("link", { name: "Budget" }).click()
  await expect(page).toHaveURL(/\/apps\/budget/)

  const menu = page.getByRole("navigation", { name: "Menu de Budget" })
  await expect(menu).toBeVisible()
  await menu.getByRole("link", { name: "Par membre" }).click()
  await expect(page).toHaveURL(/\/apps\/budget\/membres/)
  await expect(page.getByRole("heading", { name: "Par membre" })).toBeVisible()
  await expect(menu.getByRole("link", { name: "Par membre" })).toHaveAttribute("aria-current", "page")

  await menu.getByRole("link", { name: "Prévisionnel" }).click()
  await expect(page).toHaveURL(/\/apps\/budget\/previsionnel/)
  await expect(page.getByRole("heading", { name: "Prévisionnel" })).toBeVisible()
})

test.describe("téléphone", () => {
  test.use({ viewport: { width: 360, height: 740 } })

  test("menus : la rangée de Budget défile sans déborder la page, et Par membre s'ouvre par clic", async ({ page, equipe }) => {
    await connecterParLien(page, equipe)
    // Entrée initiale directe : l'app elle-même. Ensuite, tout se fait par clic.
    await page.goto("/apps/budget")
    const menu = page.getByRole("navigation", { name: "Menu de Budget" })
    await expect(menu).toBeVisible()

    const largeurPage = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(largeurPage).toBeLessThanOrEqual(360)

    await menu.getByRole("link", { name: "Par membre" }).click()
    await expect(page).toHaveURL(/\/apps\/budget\/membres/)
    await expect(page.getByRole("heading", { name: "Par membre" })).toBeVisible()
  })
})
