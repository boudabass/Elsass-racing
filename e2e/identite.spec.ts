import path from "node:path"

import { expect, test } from "./aide/fixtures"
import { compterEvenements } from "./aide/session"
import { connecterParLien } from "./aide/navigation"

const NOUVELLE_COULEUR = "#2e7d32"
const DOSSIER = path.join(__dirname, "..", "docs", "captures")

test("d. identité : la couleur enregistrée est relue après rechargement, et l'événement est émis", async ({ page, equipe }) => {
  await connecterParLien(page, equipe)
  await page.goto("/apps/settings/identite")

  const couleur = page.locator("#couleurPrincipale")
  await couleur.fill(NOUVELLE_COULEUR)

  const formulaire = page.locator("form", { has: couleur })
  await formulaire.getByRole("button", { name: "Enregistrer" }).click()
  await page.waitForURL(/ok=1/)

  await page.reload()
  // La base enregistre les couleurs en majuscules : la comparaison ignore la casse.
  await expect(page.locator("#couleurPrincipale")).toHaveValue(NOUVELLE_COULEUR)

  expect(await compterEvenements(equipe, "settings.identite_modifiee")).toBeGreaterThanOrEqual(1)
})

// Brief 3.5, point 2 : la rubrique Association porte l'identité juridique (forme, numéro d'inscription, signataire).
test("g. association : forme juridique, numéro d'inscription et signataire sont enregistrés et relus ; capture de la rubrique", async ({ page, equipe }) => {
  await connecterParLien(page, equipe)
  await page.goto("/apps/settings/association")

  await page.getByLabel("Forme juridique").fill("association de droit local d'Alsace-Moselle")
  await expect(page.getByLabel("Numéro d'inscription")).not.toHaveAttribute("placeholder", /.+/)
  await page.getByLabel("Numéro d'inscription").fill("ASSO-EXEMPLE-42")
  const signataire = page.getByRole("group", { name: "Signataire des conventions" })
  await signataire.getByLabel("Nom", { exact: true }).fill("Jo Koehling")
  await signataire.getByLabel("Qualité").fill("président")

  const formulaire = page.locator("form", { has: page.getByLabel("Forme juridique") })
  await formulaire.getByRole("button", { name: "Enregistrer" }).click()
  await page.waitForURL(/ok=1/)

  await page.reload()
  await expect(page.getByLabel("Forme juridique")).toHaveValue("association de droit local d'Alsace-Moselle")
  await expect(page.getByLabel("Numéro d'inscription")).toHaveValue("ASSO-EXEMPLE-42")
  await expect(signataire.getByLabel("Nom", { exact: true })).toHaveValue("Jo Koehling")
  await expect(signataire.getByLabel("Qualité")).toHaveValue("président")
  await expect(page.getByText("RNA, ou numéro du registre des associations du tribunal en Alsace-Moselle")).toBeVisible()

  expect(await compterEvenements(equipe, "settings.identite_modifiee")).toBeGreaterThanOrEqual(1)

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.screenshot({ path: path.join(DOSSIER, "reglages-association-1440x900.png"), fullPage: true })
})
