import { expect, test } from "./aide/fixtures"
import { ajouterEquipement, ajouterLicence, creerPersonne, ouvrirOnglet } from "./aide/equipe"
import { envoyer } from "./aide/envoi"
import { connecterParLien, tuilesDuQg } from "./aide/navigation"
import { ajouterEpreuveEnBase, ajouterMembreConnectable, preparerSaison } from "./aide/session"

// Tâche 5.2, brief §3 : parcours d'Équipe par clics depuis le QG. Une personne créée, une licence et un casque saisis,
// une réponse « vient » pour la prochaine épreuve. L'assistance voit la fiche sans l'onglet Ressenti, et ne peut pas
// modifier la licence d'un autre : le bouton reste là, désactivé, avec la raison.

const SAISON = 2032

test("parcours : créer une personne, licence, casque, répondre « vient » ; l'assistance ne gère pas le dossier d'un autre", async ({
  page,
  equipe,
  browser,
}) => {
  test.setTimeout(300_000)
  const saisonId = await preparerSaison(equipe, SAISON)
  await ajouterEpreuveEnBase(equipe, saisonId, "Rallye équipe e2e", `${SAISON}-07-10`, `${SAISON}-07-11`)
  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 1440, height: 900 })

  await creerPersonne(page, "Anne", "Lenoir", "Assistance")
  await ajouterLicence(page, "Licence FFSA régionale", "R-2032", `${SAISON}-12-31`)
  await ajouterEquipement(page, "Casque", "Arai")

  // Réponse « vient » pour la prochaine épreuve, dans l'onglet Disponibilités.
  await ouvrirOnglet(page, "Disponibilités")
  await page.getByRole("button", { name: "Répondre", exact: true }).click()
  await page.getByRole("dialog").getByLabel("Vient", { exact: true }).check()
  await envoyer(page, page.getByRole("dialog").getByRole("button", { name: "Enregistrer ma réponse", exact: true }))
  await expect(page.getByText("Réponse : Vient", { exact: true })).toBeVisible()

  // La carte de l'équipe porte la réponse pour la prochaine épreuve.
  await page.getByRole("link", { name: "Retour à l'équipe", exact: true }).click()
  await expect(page.getByRole("link", { name: /Anne Lenoir/ })).toContainText("Prochaine épreuve : vient")

  // Assistance : la fiche s'ouvre sans l'onglet Ressenti ; la licence d'un autre ne se modifie pas, et la raison est dite.
  const assistance = await ajouterMembreConnectable(equipe, "assistance")
  const contexte = await browser.newContext()
  const assist = await contexte.newPage()
  try {
    await assist.goto(`/connexion/lien?t=${assistance.secretLien}`)
    await assist.waitForURL(/\/qg$/)
    await tuilesDuQg(assist)
      .filter({ has: assist.getByRole("heading", { name: "Équipe", exact: true }) })
      .click()
    await expect(assist.getByRole("heading", { name: "L'équipe", exact: true })).toBeVisible()
    await assist.getByRole("link", { name: /Anne Lenoir/ }).click()
    await expect(assist.getByRole("heading", { name: "Anne Lenoir", exact: true })).toBeVisible()
    await expect(assist.getByRole("link", { name: "Ressenti", exact: true })).toHaveCount(0)

    await ouvrirOnglet(assist, "Licences")
    await assist.getByRole("button", { name: "Modifier", exact: true }).click()
    const tiroir = assist.getByRole("dialog")
    await expect(tiroir.getByText("Tu ne peux gérer que ton propre dossier.")).toBeVisible()
    await expect(tiroir.getByRole("button", { name: "Enregistrer", exact: true })).toBeDisabled()
  } finally {
    await contexte.close()
  }
})
