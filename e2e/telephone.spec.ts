import { expect, test } from "./aide/fixtures"
import { connecterParLien, tuilesDuQg } from "./aide/navigation"

test.use({ viewport: { width: 360, height: 740 } })

test("i. téléphone : pas de défilement horizontal, barre basse visible", async ({ page, equipe }) => {
  await connecterParLien(page, equipe)
  await expect(tuilesDuQg(page)).toHaveCount(11)

  const largeurPage = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(largeurPage).toBeLessThanOrEqual(360)

  const barreBasse = page.getByRole("navigation", { name: "Navigation rapide" })
  await expect(barreBasse).toBeVisible()
  const boite = await barreBasse.boundingBox()
  expect(boite).not.toBeNull()
  expect(boite!.y + boite!.height).toBeGreaterThan(700)
})
