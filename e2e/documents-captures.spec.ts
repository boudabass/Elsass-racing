// Captures de Documents pour le point d'arrêt de la tâche 5.3 : le coffre-fort, la liste d'un dossier et la fiche d'un
// document, à 1440 et à 360 px, en thème sombre et en thème clair. Les captures partent dans docs/captures/ (documents-*) ;
// elles sont téléchargées du run, relues une à une, puis commitées à la main.
import { capturer, choisirTheme } from "./aide/equipe"
import { envoyer } from "./aide/envoi"
import { expect, test } from "./aide/fixtures"
import { jourParis } from "./aide/dates"
import { connecterParLien, tuilesDuQg } from "./aide/navigation"

const BUREAU = { largeur: "1440", width: 1440, height: 900 }
const TELEPHONE = { largeur: "360", width: 360, height: 740 }

test("captures · coffre-fort, dossier et fiche de document, 1440 et 360 px, sombre et clair", async ({ page, equipe }) => {
  test.setTimeout(420_000)
  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: BUREAU.width, height: BUREAU.height })

  await tuilesDuQg(page)
    .filter({ has: page.getByRole("heading", { name: "Documents", exact: true }) })
    .click()
  await expect(page.getByRole("heading", { name: "Coffre-fort", exact: true })).toBeVisible()

  // Des données réelles, créées par l'interface : des statuts sans échéance, une assurance qui expire dans cinq jours.
  await page.getByRole("button", { name: "Document", exact: true }).click()
  const statuts = page.getByRole("dialog")
  await statuts.getByLabel("Titre", { exact: true }).fill("Statuts de l'association")
  await statuts.getByLabel("Type de document", { exact: true }).selectOption("statuts")
  await statuts.getByLabel("Dossier", { exact: true }).selectOption({ label: "Association" })
  await envoyer(page, statuts.getByRole("button", { name: "Ajouter le document", exact: true }))

  await page.getByRole("button", { name: "Document", exact: true }).click()
  const assurance = page.getByRole("dialog")
  await assurance.getByLabel("Titre", { exact: true }).fill("Assurance de l'association")
  await assurance.getByLabel("Type de document", { exact: true }).selectOption("assurance_asso")
  await assurance.getByLabel("Dossier", { exact: true }).selectOption({ label: "Assurances" })
  await assurance.getByLabel("Date de validité", { exact: true }).fill(jourParis(5))
  await envoyer(page, assurance.getByRole("button", { name: "Ajouter le document", exact: true }))
  await expect(page.getByRole("link", { name: /Assurances/ })).toBeVisible()
  await page.getByRole("link", { name: /retour au qg/i }).first().click()
  await expect(page).toHaveURL(/\/qg$/)

  for (const theme of ["sombre", "clair"] as const) {
    await choisirTheme(page, theme)
    await page.getByRole("link", { name: /retour au QG/ }).click()
    await expect(page).toHaveURL(/\/qg$/)

    for (const taille of [BUREAU, TELEPHONE]) {
      await page.setViewportSize({ width: taille.width, height: taille.height })
      await tuilesDuQg(page)
        .filter({ has: page.getByRole("heading", { name: "Documents", exact: true }) })
        .click()
      await expect(page.getByRole("heading", { name: "Coffre-fort", exact: true })).toBeVisible()
      await capturer(page, `documents-coffre-${taille.largeur}-${theme}.png`)

      await page.getByRole("link", { name: /Association/ }).click()
      await expect(page.getByRole("heading", { name: "Association", exact: true })).toBeVisible()
      await capturer(page, `documents-dossier-${taille.largeur}-${theme}.png`)

      await page.getByRole("link", { name: /Statuts de l'association/ }).click()
      await expect(page.getByRole("heading", { name: "Statuts de l'association", exact: true })).toBeVisible()
      await capturer(page, `documents-fiche-${taille.largeur}-${theme}.png`)

      // Retour au QG : chaque taille repart de la tuile Documents du QG.
      await page.getByRole("link", { name: /retour au qg/i }).first().click()
      await expect(page).toHaveURL(/\/qg$/)
    }
  }
})
