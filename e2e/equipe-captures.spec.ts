// Captures d'Équipe pour le point d'arrêt de la tâche 5.2 : l'équipe en cartes, la fiche (Statistiques, Licences), à 1440 et
// à 360 px, en thème sombre et en thème clair. Les captures partent dans docs/captures/ (equipe-*) ; elles sont téléchargées
// du run, relues, puis commitées à la main.
import { ajouterEquipement, ajouterLicence, capturer, choisirTheme, creerPersonne } from "./aide/equipe"
import { expect, test } from "./aide/fixtures"
import { connecterParLien, tuilesDuQg } from "./aide/navigation"
import { ajouterEpreuveEnBase, preparerSaison } from "./aide/session"

const SAISON = 2032
const BUREAU = { largeur: "1440", width: 1440, height: 900 }
const TELEPHONE = { largeur: "360", width: 360, height: 740 }

test("captures · équipe en cartes et fiche personne (Statistiques, Licences), 1440 et 360 px, sombre et clair", async ({ page, equipe }) => {
  test.setTimeout(420_000)
  const saisonId = await preparerSaison(equipe, SAISON)
  await ajouterEpreuveEnBase(equipe, saisonId, "Rallye captures équipe", `${SAISON}-07-10`, `${SAISON}-07-11`)
  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: BUREAU.width, height: BUREAU.height })

  // Des données réelles du parcours : deux personnes, une licence et un casque pour Luc.
  await creerPersonne(page, "Luc", "Martin", "Pilote")
  await ajouterLicence(page, "Licence FFSA nationale", "N-2032", `${SAISON}-12-31`)
  await ajouterEquipement(page, "Casque", "Bell")
  await page.getByRole("link", { name: "Retour à l'équipe", exact: true }).click()
  await creerPersonne(page, "Anne", "Lenoir", "Assistance")

  for (const theme of ["sombre", "clair"] as const) {
    await choisirTheme(page, theme)
    await page.getByRole("link", { name: /retour au QG/ }).click()
    await expect(page).toHaveURL(/\/qg$/)

    for (const taille of [BUREAU, TELEPHONE]) {
      await page.setViewportSize({ width: taille.width, height: taille.height })
      await tuilesDuQg(page)
        .filter({ has: page.getByRole("heading", { name: "Équipe", exact: true }) })
        .click()
      await expect(page.getByRole("heading", { name: "L'équipe", exact: true })).toBeVisible()
      await capturer(page, `equipe-cartes-${taille.largeur}-${theme}.png`)

      await page.getByRole("link", { name: /Luc Martin/ }).click()
      await expect(page.getByRole("heading", { name: "Luc Martin", exact: true })).toBeVisible()
      await page.getByRole("link", { name: "Statistiques", exact: true }).click()
      await capturer(page, `equipe-fiche-statistiques-${taille.largeur}-${theme}.png`)

      await page.getByRole("link", { name: "Licences", exact: true }).click()
      await expect(page.getByText("N° N-2032", { exact: false }).first()).toBeVisible()
      await capturer(page, `equipe-fiche-licences-${taille.largeur}-${theme}.png`)

      // Retour au QG : chaque taille repart de la tuile Équipe du QG.
      await page.getByRole("link", { name: /retour au QG/ }).click()
      await expect(page).toHaveURL(/\/qg$/)
    }
  }
})
