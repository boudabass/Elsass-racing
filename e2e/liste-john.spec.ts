import type { Page } from "@playwright/test"

import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { ajouterMembreConnectable, ajouterVoitureDeCourse, depensesBudgetEnBase, rattacherPersonne, statutAction } from "./aide/session"

// Brief 2.9, point 9 : la liste de test de John, sur une team créée vide, par clic. Le parcours part de la
// création de la saison, à la main dans l'écran. Seule l'entrée initiale se fait par l'URL du QG.

// Même année que la saison ouverte à l'écran (sa proposition est l'année en cours).
const ANNEE = new Date().getUTCFullYear()

// Premier accès à Budget : l'écran de découverte, puis « Commencer ».
async function passerDecouverteBudget(page: Page): Promise<void> {
  const commencer = page.getByRole("button", { name: "Commencer" })
  if (await commencer.waitFor({ state: "visible", timeout: 5_000 }).then(() => true).catch(() => false)) await commencer.click()
}

// Saison créée à l'écran (team vide), puis une épreuve, par clic. Renvoie l'adresse de la fiche épreuve.
async function saisonEtEpreuveAuClic(page: Page, nomEpreuve: string): Promise<string> {
  await page.getByRole("navigation", { name: "Apps" }).getByRole("link", { name: "Saison" }).click()
  await expect(page.getByRole("heading", { name: "Créer la saison" })).toBeVisible()
  await page.getByRole("button", { name: "Ouvrir la saison" }).click()
  await expect(page.getByRole("link", { name: "Ajouter une épreuve" })).toBeVisible()
  await page.getByRole("link", { name: "Ajouter une épreuve" }).click()
  await page.getByLabel("Nom de l'épreuve").fill(nomEpreuve)
  await page.getByLabel("Premier jour").fill(`${ANNEE}-06-10`)
  await page.getByLabel("Dernier jour").fill(`${ANNEE}-06-11`)
  await page.getByRole("button", { name: "Ajouter l'épreuve" }).click()
  await expect(page).toHaveURL(/\/apps\/saison\/epreuves\/[0-9a-f-]+/)
  return page.url().split("?")[0]
}

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
  // Captures de l'écran vide, à 1280 puis à 360 (pour le jugement de John).
  await page.screenshot({ path: "docs/captures/saison-vide-1280x900.png" })
  await page.setViewportSize({ width: 360, height: 740 })
  await page.screenshot({ path: "docs/captures/saison-vide-360x740.png" })
  await page.setViewportSize({ width: 1280, height: 900 })
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
  await passerDecouverteBudget(page)
  const menuBudget = page.getByRole("navigation", { name: "Menu de Budget" })
  await menuBudget.getByRole("link", { name: "À confirmer" }).click()
  await expect(page.getByRole("heading", { name: /Engagement Rallye liste John/ })).toBeVisible()
  await page.getByRole("button", { name: "Confirmer", exact: true }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Confirmer le mouvement" }).click()
  await expect(page.getByRole("heading", { name: /Engagement Rallye liste John/ })).toHaveCount(0)

  // Dépense saisie, puis modifiée et supprimée depuis la fiche du mouvement.
  await menuBudget.getByRole("link", { name: "Mouvements" }).click()
  await page.getByRole("link", { name: "Ajouter une dépense" }).click()
  await page.getByLabel("Montant (€)").fill("80")
  await page.getByLabel("Catégorie", { exact: true }).selectOption({ index: 1 })
  await page.getByLabel(/Libellé/).fill("Pneus liste John")
  await page.getByRole("button", { name: "Ajouter la dépense" }).click()
  await expect(page.getByText("Enregistré. La dépense part")).toBeVisible()
  await menuBudget.getByRole("link", { name: "Mouvements" }).click()
  await expect(page.getByRole("link", { name: /Pneus liste John/ }).first()).toBeVisible()

  // Modifier depuis la fiche du mouvement (aside), puis supprimer depuis la même fiche.
  await page.getByRole("link", { name: /Pneus liste John/ }).first().click()
  // Capture de la fiche avec ses boutons, à 1280 puis à 360.
  await page.screenshot({ path: "docs/captures/budget-fiche-mouvement-1280x900.png" })
  await page.setViewportSize({ width: 360, height: 740 })
  await page.screenshot({ path: "docs/captures/budget-fiche-mouvement-360x740.png" })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.getByRole("complementary", { name: "Fiche du mouvement" }).getByRole("link", { name: "Modifier" }).click()
  await expect(page.getByRole("heading", { name: "Modifier la dépense" })).toBeVisible()
  await page.getByRole("button", { name: "Modifier", exact: true }).click()
  await page.getByRole("dialog").getByLabel(/Libellé/).fill("Pneus modifiés John")
  await page.getByRole("button", { name: "Enregistrer les modifications" }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.getByRole("link", { name: "← Mouvements" }).click()
  await page.getByRole("link", { name: /Pneus modifiés John/ }).first().click()
  await page.getByRole("complementary", { name: "Fiche du mouvement" }).getByRole("link", { name: "Supprimer" }).click()
  await expect(page.getByRole("heading", { name: "Modifier la dépense" })).toBeVisible()
  await page.getByRole("button", { name: "Supprimer", exact: true }).click()
  await page.getByRole("dialog").getByRole("checkbox", { name: "Je confirme la suppression de ce mouvement." }).check()
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer", exact: true }).click()
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

test("liste de John : calendrier en vue mois et filtres sur téléphone, pastilles retirables", async ({ page, equipe }) => {
  test.setTimeout(240_000)
  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 1280, height: 900 })
  await saisonEtEpreuveAuClic(page, "Rallye filtres John")

  // Téléphone : la barre latérale est masquée, on passe par le QG (lien de la barre haute, puis la tuile Saison).
  await page.setViewportSize({ width: 360, height: 740 })
  await page.getByRole("link", { name: /retour au QG/ }).click()
  await page.locator('main a[href="/apps/saison"]').first().click()

  // Retour au calendrier, vue mois par clic.
  await page.getByRole("link", { name: "Mois", exact: true }).click()
  await page.getByRole("link", { name: "Mois", exact: true }).click()
  await expect(page).toHaveURL(/vue=mois/)

  // Filtres : le tiroir s'ouvre, un filtre se pose, il apparaît en pastille, et la pastille se retire.
  await page.getByRole("button", { name: /^Filtres/ }).click()
  const tiroir = page.getByRole("dialog")
  await tiroir.getByLabel("Type").selectOption({ index: 1 })
  await page.keyboard.press("Escape")
  const pastilles = page.getByRole("list", { name: "Filtres actifs" })
  await expect(pastilles).toBeVisible()
  await pastilles.getByRole("button").first().click()
  await expect(pastilles).toHaveCount(0)
})

test("liste de John : Budget, Par membre en phrase, Par épreuve, Prévisionnel saison et épreuve", async ({ page, equipe }) => {
  test.setTimeout(300_000)
  await ajouterVoitureDeCourse(equipe, "Saxo budget John")
  await rattacherPersonne(equipe, equipe.responsable, "Responsable", "E2E")
  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 1280, height: 900 })
  await saisonEtEpreuveAuClic(page, "Rallye budget John")

  // Une dépense payée par le responsable : la team lui doit ce montant, dit en clair dans Par membre.
  await page.getByRole("navigation", { name: "Apps" }).getByRole("link", { name: "Budget" }).click()
  await passerDecouverteBudget(page)
  await page.getByRole("link", { name: "Ajouter une dépense" }).click()
  await page.getByLabel("Montant (€)").fill("80")
  await page.getByLabel("Catégorie", { exact: true }).selectOption({ index: 1 })
  await page.getByRole("button", { name: "Ajouter la dépense" }).click()
  await expect(page.getByText("Enregistré. La dépense part")).toBeVisible()

  const menuBudget = page.getByRole("navigation", { name: "Menu de Budget" })
  await menuBudget.getByRole("link", { name: "Par membre" }).click()
  await expect(page.getByText(/La team doit\s+80,00/)).toBeVisible()

  // Par épreuve : l'épreuve est listée avec son réel.
  await menuBudget.getByRole("link", { name: "Par épreuve" }).click()
  await expect(page.getByText("Rallye budget John").first()).toBeVisible()

  // Prévisionnel : saison entière, puis l'épreuve, par le choix en haut de l'écran.
  await menuBudget.getByRole("link", { name: "Prévisionnel" }).click()
  await expect(page.getByRole("heading", { name: "Prévisionnel" })).toBeVisible()
  await page.getByRole("navigation", { name: "Portée du prévisionnel" }).getByRole("link", { name: "Rallye budget John" }).click()
  await expect(page).toHaveURL(/epreuve=/)
  await expect(page.getByText(/Le prévu de cette épreuve/)).toBeVisible()
})

test("liste de John : paiement dans Saison, confirmation dans la boîte d'actions, puis plus d'action", async ({ page, equipe }) => {
  test.setTimeout(300_000)
  await ajouterVoitureDeCourse(equipe, "Saxo boite John")
  await rattacherPersonne(equipe, equipe.responsable, "Responsable", "E2E")
  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 1280, height: 900 })
  await saisonEtEpreuveAuClic(page, "Rallye boite John")

  // Engagement, puis paiement dans Saison.
  await page.getByRole("navigation", { name: "Onglets de l'épreuve" }).getByRole("link", { name: "Engagements" }).click()
  await page.getByLabel("Voiture").selectOption({ label: "Saxo boite John" })
  await page.getByRole("button", { name: "Engager la voiture" }).click()
  await page.getByRole("link", { name: /Saxo boite John/ }).first().click()
  await expect(page).toHaveURL(/\/apps\/saison\/engagements\/[0-9a-f-]+/)
  await page.getByLabel("Montant payé (€)").fill("450")
  await page.getByLabel("Payeur").selectOption({ index: 1 })
  await page.getByRole("button", { name: "Enregistrer le paiement" }).click()
  await expect(page.getByText("Enregistré.")).toBeVisible()

  // La proposition se confirme dans la boîte d'actions (pas seulement dans la page À confirmer).
  await page.getByRole("link", { name: /retour au QG/ }).click()
  await page.getByRole("button", { name: /Boîte d'actions/ }).first().click()
  await expect(page.getByText(/Confirmer le mouvement : Engagement Rallye boite John/).first()).toBeVisible()
  await page.getByRole("button", { name: "Confirmer" }).first().click()
  await expect
    .poll(async () => (await depensesBudgetEnBase(equipe)).some((d) => d.libelle.startsWith("Engagement Rallye boite") && d.montant === 45_000))
    .toBe(true)
  await expect(page.getByText(/Confirmer le mouvement : Engagement Rallye boite John/)).toHaveCount(0)
})

test("liste de John : l'assistance ne voit ni Prévisionnel, ni À confirmer, ni Recette dans le menu Budget", async ({ page, equipe }) => {
  test.setTimeout(240_000)
  await ajouterVoitureDeCourse(equipe, "Saxo assistance John")
  await rattacherPersonne(equipe, equipe.responsable, "Responsable", "E2E")
  await connecterParLien(page, equipe)
  await saisonEtEpreuveAuClic(page, "Rallye assistance John")

  const assistance = await ajouterMembreConnectable(equipe, "assistance", "-john")
  await connecterParLien(page, { ...equipe, secretLien: assistance.secretLien })
  await page.getByRole("navigation", { name: "Apps" }).getByRole("link", { name: "Budget" }).click()
  await passerDecouverteBudget(page)

  const menuBudget = page.getByRole("navigation", { name: "Menu de Budget" })
  await expect(menuBudget.getByRole("link", { name: "Mouvements" })).toBeVisible()
  await expect(menuBudget.getByRole("link", { name: "Prévisionnel" })).toHaveCount(0)
  await expect(menuBudget.getByRole("link", { name: "À confirmer" })).toHaveCount(0)
  await expect(menuBudget.getByRole("link", { name: "Recette" })).toHaveCount(0)
})
