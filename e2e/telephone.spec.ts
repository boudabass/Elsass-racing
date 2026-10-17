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

test("i-bis. téléphone : le + ouvre un tiroir entièrement visible, Note mène aux notes", async ({ page, equipe }) => {
  await connecterParLien(page, equipe)

  // Un seul « Ajouter » est visible à cette largeur : le bouton du tiroir (le menu PC est masqué).
  const plus = page.getByRole("button", { name: "Ajouter" })
  await expect(plus).toHaveCount(1)
  await plus.click()

  const tiroir = page.getByRole("dialog")
  await expect(tiroir).toBeVisible()
  // Attend la fin de l'animation de glissement : pendant elle, la boîte est décalée hors écran.
  await expect.poll(async () => { const b = await tiroir.boundingBox(); return b ? b.y + b.height : 9999 }).toBeLessThanOrEqual(740)
  const boite = await tiroir.boundingBox()
  expect(boite).not.toBeNull()
  expect(boite!.x).toBeGreaterThanOrEqual(0)
  expect(boite!.x + boite!.width).toBeLessThanOrEqual(360)
  expect(boite!.y).toBeGreaterThanOrEqual(0)
  expect(boite!.y + boite!.height).toBeLessThanOrEqual(740)

  const note = tiroir.getByRole("link", { name: "Note", exact: true })
  await expect(note).toBeVisible()
  const cible = await note.boundingBox()
  expect(cible!.height).toBeGreaterThanOrEqual(44)

  await note.click()
  await expect(page).toHaveURL(/\/notes/)
})
