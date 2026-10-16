import { expect, test } from "./aide/fixtures"
import { modeTerrainEnBase } from "./aide/session"
import { connecterParLien } from "./aide/navigation"

test("h. mode terrain : activé, conservé au rechargement, enregistré pour le membre", async ({ page, equipe }) => {
  await connecterParLien(page, equipe)

  await page.getByRole("button", { name: "Mode terrain", exact: true }).click()
  await expect(page.getByRole("button", { name: "Terrain : activé" })).toBeVisible()

  await page.reload()
  await expect(page.locator("html")).toHaveClass(/\bterrain\b/)
  await expect(page.getByRole("button", { name: "Terrain : activé" })).toBeVisible()

  expect(await modeTerrainEnBase(equipe)).toBe(true)
})
