// Captures d'Équipe pour le point d'arrêt de la tâche 5.2 : l'équipe en cartes, la fiche (Statistiques, Licences), à 1440 et
// à 360 px, en thème sombre et en thème clair. Les captures partent dans docs/captures/ (equipe-*) ; elles sont téléchargées
// du run, relues, puis commitées à la main.
import { ajouterEquipement, ajouterLicence, capturer, choisirTheme, creerPersonne } from "./aide/equipe"
import { envoyer } from "./aide/envoi"
import { expect, test } from "./aide/fixtures"
import { connecterParLien, tuilesDuQg } from "./aide/navigation"
import {
  ajouterEpreuveEnBase,
  ajouterResultatValideEnBase,
  ajouterVoitureSaxo,
  definirEquipageEnBase,
  engagerVehiculeEnBase,
  passerEpreuveDansLePasseEnBase,
  preparerSaison,
  statutEpreuveEnBase,
} from "./aide/session"

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
  const luc = await creerPersonne(page, "Luc", "Martin", "Pilote")
  await ajouterLicence(page, "Licence FFSA nationale", "N-2032", `${SAISON}-12-31`)
  await ajouterEquipement(page, "Casque", "Bell")
  await page.getByRole("link", { name: "Retour à l'équipe", exact: true }).click()
  await creerPersonne(page, "Anne", "Lenoir", "Assistance")
  const theo = await creerPersonne(page, "Théo", "Roux", "Copilote")

  // Vivier et prochaine épreuve avec des données : Luc au vivier pour la logistique, Anne affectée à l'épreuve.
  const menu = page.getByRole("navigation", { name: "Menu de Équipe" })
  await menu.getByRole("link", { name: "Vivier", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Vivier", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Ajouter au vivier", exact: true }).click()
  await page.getByRole("dialog").getByLabel("Personne", { exact: true }).selectOption({ label: "Luc Martin" })
  await page.getByRole("dialog").getByLabel("Rôle recherché", { exact: true }).selectOption({ label: "Logistique" })
  await envoyer(page, page.getByRole("dialog").getByRole("button", { name: "Ajouter", exact: true }))
  await expect(page.getByText("Recherché : Logistique", { exact: false }).first()).toBeVisible()

  await menu.getByRole("link", { name: "Prochaine épreuve", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Rallye captures équipe", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Affecter une personne", exact: true }).click()
  await page.getByRole("dialog").getByLabel("Personne", { exact: true }).selectOption({ label: "Anne Lenoir" })
  await page.getByRole("dialog").getByLabel("Rôle d'épreuve", { exact: true }).selectOption({ label: "Logistique" })
  await envoyer(page, page.getByRole("dialog").getByRole("button", { name: "Affecter", exact: true }))
  await expect(page.getByText("Logistique · à faire")).toBeVisible()

  // Des chiffres réels, pas de chiffres de test : une épreuve passée à résultat validé, Luc pilote et Théo copilote.
  // Elle devient « terminée » au QG, qui compte l'arrivée. Les cartes, les statistiques et les binômes la lisent.
  const annee = new Date().getFullYear()
  const epreuvePassee = await ajouterEpreuveEnBase(equipe, saisonId, "Rallye passé captures", `${SAISON}-03-10`, `${SAISON}-03-11`)
  const vehiculeBinome = await ajouterVoitureSaxo(equipe, "Saxo binôme")
  const entreeBinome = await engagerVehiculeEnBase(equipe, epreuvePassee, vehiculeBinome, "parti")
  await definirEquipageEnBase(equipe, entreeBinome, luc, theo)
  await ajouterResultatValideEnBase(equipe, entreeBinome, 12)
  await passerEpreuveDansLePasseEnBase(equipe, epreuvePassee, `${annee}-03-01`, `${annee}-03-02`)
  await page.goto("/qg")
  await expect.poll(() => statutEpreuveEnBase(equipe, epreuvePassee), { timeout: 30_000 }).toBe("terminee")

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
      // Attendre le contenu de l'onglet, avec son chiffre : sans cela, la capture part encore sur le Profil ou à zéro.
      await expect(page.locator("dl > div").filter({ has: page.getByText("Épreuves", { exact: true }) }).locator("dd")).toHaveText("1")
      await capturer(page, `equipe-fiche-statistiques-${taille.largeur}-${theme}.png`)

      await page.getByRole("link", { name: "Licences", exact: true }).click()
      await expect(page.getByText("N° N-2032", { exact: false }).first()).toBeVisible()
      await capturer(page, `equipe-fiche-licences-${taille.largeur}-${theme}.png`)

      // Les écrans du menu de l'app : vivier, prochaine épreuve, binômes (à partir de la fiche, par clic).
      await menu.getByRole("link", { name: "Vivier", exact: true }).click()
      await expect(page.getByRole("heading", { name: "Vivier", exact: true })).toBeVisible()
      await capturer(page, `equipe-vivier-${taille.largeur}-${theme}.png`)

      await menu.getByRole("link", { name: "Prochaine épreuve", exact: true }).click()
      await expect(page.getByText("Logistique · à faire")).toBeVisible()
      await capturer(page, `equipe-epreuve-${taille.largeur}-${theme}.png`)

      await menu.getByRole("link", { name: "Binômes", exact: true }).click()
      await expect(page.getByRole("heading", { name: "Binômes", exact: true })).toBeVisible()
      await expect(page.getByText("Théo Roux", { exact: true })).toBeVisible()
      await capturer(page, `equipe-binomes-${taille.largeur}-${theme}.png`)

      // Retour au QG : chaque taille repart de la tuile Équipe du QG.
      await page.getByRole("link", { name: /retour au QG/ }).click()
      await expect(page).toHaveURL(/\/qg$/)
    }
  }
})
