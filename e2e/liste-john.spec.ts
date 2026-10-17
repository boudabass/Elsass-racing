import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { ajouterVoitureDeCourse, rattacherPersonne, statutAction } from "./aide/session"

// Brief 2.9, point 9 : la liste de test de John, sur une team créée vide, par clic. Le parcours part de la
// création de la saison, à la main dans l'écran. Seule l'entrée initiale se fait par l'URL du QG.

// Même année que la saison ouverte à l'écran (sa proposition est l'année en cours).
const ANNEE = new Date().getUTCFullYear()

test("liste de John : saison créée à l'écran, épreuve, engagement, paiement en espèces, Budget par clic", async ({ page, equipe }) => {
  test.setTimeout(420_000)
  await ajouterVoitureDeCourse(equipe, "Saxo liste John")
  // Fiche personne du responsable, comme le crée team:creer.
  await rattacherPersonne(equipe, equipe.responsable, "Responsable", "E2E")
  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 1280, height: 900 })

  // Saison : team vide, l'écran propose de la créer, puis ouvre le calendrier.
  await page.getByRole("navigation", { name: "Apps" }).getByRole("link", { name: "Saison" }).click()
  await expect(page.getByRole("heading", { name: "Créer la saison" })).toBeVisible()
  await page.getByRole("button", { name: "Ouvrir la saison" }).click()
  await expect(page.getByRole("link", { name: "Ajouter une épreuve" })).toBeVisible()

  // Épreuve, puis engagement de la voiture, depuis la fiche.
  await page.getByRole("link", { name: "Ajouter une épreuve" }).click()
  await page.getByLabel("Nom de l'épreuve").fill("Rallye liste John")
  await page.getByLabel("Premier jour").fill(`${ANNEE}-06-10`)
  await page.getByLabel("Dernier jour").fill(`${ANNEE}-06-11`)
  await page.getByRole("button", { name: "Ajouter l'épreuve" }).click()
  await expect(page).toHaveURL(/\/apps\/saison\/epreuves\/[0-9a-f-]+/)
  await page.getByRole("navigation", { name: "Onglets de l'épreuve" }).getByRole("link", { name: "Engagements" }).click()
  await page.getByLabel("Voiture").selectOption({ label: "Saxo liste John" })
  await page.getByRole("button", { name: "Engager la voiture" }).click()
  await page.getByRole("link", { name: /Saxo liste John/ }).first().click()
  await expect(page).toHaveURL(/\/apps\/saison\/engagements\/[0-9a-f-]+/)
  const entryId = page.url().split("?")[0].split("/").pop() ?? ""

  // Paiement en espèces : Saison le saisit, Budget reçoit une proposition.
  await page.getByLabel("Mode de paiement").selectOption({ label: "Espèces" })
  await page.getByLabel("Montant payé (€)").fill("450")
  await page.getByLabel("Payeur").selectOption({ index: 1 })
  await page.getByRole("button", { name: "Enregistrer le paiement" }).click()
  await expect(page.getByText("Enregistré.")).toBeVisible()

  // Budget : la proposition est confirmée depuis À confirmer, par clic.
  await page.getByRole("navigation", { name: "Apps" }).getByRole("link", { name: "Budget" }).click()
  // Premier accès à Budget : l'écran de découverte, puis « Commencer ».
  const commencer = page.getByRole("button", { name: "Commencer" })
  if (await commencer.waitFor({ state: "visible", timeout: 5_000 }).then(() => true).catch(() => false)) await commencer.click()
  await expect(page.getByRole("link", { name: "Ajouter une dépense" })).toBeVisible()
  const menuBudget = page.getByRole("navigation", { name: "Menu de Budget" })
  await menuBudget.getByRole("link", { name: "À confirmer" }).click()
  await expect(page.getByRole("heading", { name: /Engagement Rallye liste John/ })).toBeVisible()
  await page.getByRole("button", { name: "Confirmer" }).click()
  await expect(page.getByRole("heading", { name: /Engagement Rallye liste John/ })).toHaveCount(0)

  // Dépense saisie, puis modifiée et supprimée depuis la fiche du mouvement.
  await menuBudget.getByRole("link", { name: "Mouvements" }).click()
  await page.getByRole("link", { name: "Ajouter une dépense" }).click()
  await page.getByLabel("Montant (€)").fill("80")
  await page.getByLabel("Catégorie", { exact: true }).selectOption({ index: 1 })
  await page.getByText("Plus de détails").click()
  await page.getByLabel(/Libellé/).fill("Pneus liste John")
  await page.getByRole("button", { name: "Ajouter la dépense" }).click()
  await expect(page.getByText("Enregistré. La dépense part")).toBeVisible()
  await menuBudget.getByRole("link", { name: "Mouvements" }).click()
  await expect(page.getByRole("link", { name: /Pneus liste John/ }).first()).toBeVisible()

  // Modifier depuis la fiche du mouvement (aside), puis supprimer depuis la même fiche.
  await page.getByRole("link", { name: /Pneus liste John/ }).first().click()
  await page.getByRole("complementary", { name: "Fiche du mouvement" }).getByRole("link", { name: "Modifier" }).click()
  await expect(page.getByRole("heading", { name: "Modifier la dépense" })).toBeVisible()
  await page.getByLabel(/Libellé/).fill("Pneus modifiés John")
  await page.getByRole("button", { name: "Enregistrer les modifications" }).click()
  await page.getByRole("link", { name: "← Mouvements" }).click()
  await page.getByRole("link", { name: /Pneus modifiés John/ }).first().click()
  await page.getByRole("complementary", { name: "Fiche du mouvement" }).getByRole("link", { name: "Supprimer" }).click()
  await expect(page).toHaveURL(/#supprimer/)
  await page.getByRole("checkbox", { name: "Je confirme la suppression de ce mouvement." }).check()
  await page.locator("#supprimer").getByRole("button", { name: "Supprimer" }).click()
  await page.getByRole("link", { name: "Mouvements" }).first().click()
  await expect(page.getByRole("link", { name: /Pneus modifiés John/ })).toHaveCount(0)

  // Par épreuve, Par membre, Recette : chaque écran s'ouvre par clic depuis le menu de Budget.
  await menuBudget.getByRole("link", { name: "Par épreuve" }).click()
  await expect(page).toHaveURL(/\/apps\/budget\/epreuves/)
  await menuBudget.getByRole("link", { name: "Par membre" }).click()
  await expect(page.getByRole("heading", { name: "Par membre" })).toBeVisible()
  await menuBudget.getByRole("link", { name: "Recette" }).click()
  await expect(page).toHaveURL(/\/apps\/budget\/recette/)

  // Le paiement saisi dans Saison a levé « marquer payé » : aucune action de cet engagement ne reste en attente.
  expect(await statutAction(equipe, `marquer_paye:${entryId}`)).not.toBe("en_attente")
})
