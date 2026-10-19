import { expect, test } from "./aide/fixtures"
import { compterEvenements } from "./aide/session"
import { connecterParLien } from "./aide/navigation"

const NOUVELLE_COULEUR = "#2e7d32"

// Une rubrique de Réglages se lit en fiche ; « Modifier » ouvre le tiroir du formulaire (brief 3.13b).
test("d. identité : la couleur enregistrée est relue après rechargement, et l'événement est émis", async ({ page, equipe }) => {
  await connecterParLien(page, equipe)
  await page.goto("/apps/settings/identite")

  await page.getByRole("button", { name: "Modifier l'identité", exact: true }).click()
  const tiroir = page.getByRole("dialog")
  await tiroir.locator("#couleurPrincipale").fill(NOUVELLE_COULEUR)
  await tiroir.getByRole("button", { name: "Enregistrer", exact: true }).click()
  await expect(tiroir).toHaveCount(0)

  await page.reload()
  // La base enregistre les couleurs en majuscules : la comparaison ignore la casse.
  await page.getByRole("button", { name: "Modifier l'identité", exact: true }).click()
  await expect(page.locator("#couleurPrincipale")).toHaveValue(NOUVELLE_COULEUR)

  expect(await compterEvenements(equipe, "settings.identite_modifiee")).toBeGreaterThanOrEqual(1)
})

// Brief 3.5, point 2 : la rubrique Association porte l'identité juridique (forme, numéro d'inscription, signataire).
test("g. association : forme juridique, numéro d'inscription et signataire sont enregistrés et relus ; capture de la rubrique", async ({ page, equipe }) => {
  await connecterParLien(page, equipe)
  await page.goto("/apps/settings/association")

  await page.getByRole("button", { name: "Modifier l'association", exact: true }).click()
  const tiroir = page.getByRole("dialog")
  await tiroir.getByLabel("Forme juridique").fill("association de droit local d'Alsace-Moselle")
  await expect(tiroir.getByLabel("Numéro d'inscription")).not.toHaveAttribute("placeholder", /.+/)
  await tiroir.getByLabel("Numéro d'inscription").fill("ASSO-EXEMPLE-42")
  const signataire = tiroir.getByRole("group", { name: "Signataire des conventions" })
  await signataire.getByLabel("Nom", { exact: true }).fill("Jo Koehling")
  await signataire.getByLabel("Qualité").fill("président")
  await tiroir.getByRole("button", { name: "Enregistrer", exact: true }).click()
  await expect(tiroir).toHaveCount(0)

  await page.reload()
  await page.getByRole("button", { name: "Modifier l'association", exact: true }).click()
  await expect(tiroir.getByLabel("Forme juridique")).toHaveValue("association de droit local d'Alsace-Moselle")
  await expect(tiroir.getByLabel("Numéro d'inscription")).toHaveValue("ASSO-EXEMPLE-42")
  const signataireRelu = tiroir.getByRole("group", { name: "Signataire des conventions" })
  await expect(signataireRelu.getByLabel("Nom", { exact: true })).toHaveValue("Jo Koehling")
  await expect(signataireRelu.getByLabel("Qualité")).toHaveValue("président")
  await expect(tiroir.getByText("RNA, ou numéro du registre des associations du tribunal en Alsace-Moselle")).toBeVisible()

  expect(await compterEvenements(equipe, "settings.identite_modifiee")).toBeGreaterThanOrEqual(1)
})
