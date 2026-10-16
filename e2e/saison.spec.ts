import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { ajouterMembreConnectable, ajouterVoitureDeCourse, preparerSaison } from "./aide/session"

// Saison (tâche 2.2) : création par le bouton +, fiche épreuve, engagement, paiement ; et ce que
// voit l'assistance (lecture seule, sans montants). Les captures du calendrier et de la fiche sont
// écrites dans docs/captures/ pour être commitées avec la tâche.

const ANNEE = 2031

test("j. saison : une épreuve créée par le +, une voiture engagée, un paiement, statut « Payé »", async ({ page, equipe }) => {
  await preparerSaison(equipe, ANNEE)
  await ajouterVoitureDeCourse(equipe)
  await connecterParLien(page, equipe)

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole("button", { name: "Ajouter" }).click()
  await page.getByRole("menuitem", { name: "Épreuve" }).click()
  await expect(page).toHaveURL(/\/apps\/saison\/nouvelle$/)

  await page.getByLabel("Nom de l'épreuve").fill("Rallye test e2e")
  await page.getByLabel("Premier jour").fill(`${ANNEE}-05-10`)
  await page.getByLabel("Dernier jour").fill(`${ANNEE}-05-11`)
  await page.getByRole("button", { name: "Ajouter l'épreuve" }).click()

  // Après création, la fiche s'ouvre.
  await expect(page).toHaveURL(/\/apps\/saison\/epreuves\/[0-9a-f-]+/)
  const adresseFiche = page.url()
  await expect(page.getByRole("heading", { name: "Rallye test e2e" })).toBeVisible()

  await page.goto(`${adresseFiche}?onglet=engagements`)
  await page.getByLabel("Voiture").selectOption({ label: "Saxo test e2e" })
  await page.getByRole("button", { name: "Engager la voiture" }).click()
  await expect(page.getByText("Saxo test e2e").first()).toBeVisible()

  await page.getByRole("link", { name: /Saxo test e2e/ }).first().click()
  await expect(page).toHaveURL(/\/apps\/saison\/engagements\/[0-9a-f-]+/)
  await page.getByLabel("Montant payé (€)").fill("450")
  await page.getByRole("button", { name: "Enregistrer le paiement" }).click()
  await expect(page.getByText("Payé", { exact: true }).first()).toBeVisible()

  // Captures du calendrier et de la fiche, en PC et en téléphone.
  await page.goto("/apps/saison")
  await page.screenshot({ path: "docs/captures/saison-calendrier-1440x900.png", fullPage: true })
  await page.setViewportSize({ width: 360, height: 740 })
  await page.screenshot({ path: "docs/captures/saison-calendrier-360x740.png", fullPage: true })
  await page.goto(`${adresseFiche}?onglet=engagements`)
  await page.screenshot({ path: "docs/captures/saison-fiche-360x740.png", fullPage: true })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.screenshot({ path: "docs/captures/saison-fiche-1440x900.png", fullPage: true })
})

test("j-bis. saison : l'assistance voit l'épreuve, sans montant ni bouton d'écriture", async ({ browser, page, equipe }) => {
  await preparerSaison(equipe, ANNEE)
  await ajouterVoitureDeCourse(equipe)
  await connecterParLien(page, equipe)
  await page.goto("/apps/saison/nouvelle")
  await page.getByLabel("Nom de l'épreuve").fill("Rallye assistance e2e")
  await page.getByLabel("Premier jour").fill(`${ANNEE}-06-01`)
  await page.getByLabel("Dernier jour").fill(`${ANNEE}-06-02`)
  await page.getByRole("button", { name: "Ajouter l'épreuve" }).click()
  await expect(page).toHaveURL(/\/apps\/saison\/epreuves\/[0-9a-f-]+/)
  const adresseFiche = page.url()
  await page.goto(`${adresseFiche}?onglet=engagements`)
  await page.getByLabel("Voiture").selectOption({ label: "Saxo test e2e" })
  await page.getByRole("button", { name: "Engager la voiture" }).click()
  await expect(page.getByText("Saxo test e2e").first()).toBeVisible()

  const membre = await ajouterMembreConnectable(equipe, "assistance")
  const contexteAssistance = await browser.newContext()
  const pageAssistance = await contexteAssistance.newPage()
  try {
    await pageAssistance.goto(`/connexion/lien?t=${membre.secretLien}`)
    await pageAssistance.waitForURL(/\/qg$/)

    await pageAssistance.goto(adresseFiche)
    await expect(pageAssistance.getByRole("heading", { name: "Rallye assistance e2e" })).toBeVisible()
    await expect(pageAssistance.getByRole("button", { name: "Annuler l'épreuve" })).toHaveCount(0)
    await expect(pageAssistance.getByRole("button", { name: "Ajouter l'épreuve" })).toHaveCount(0)

    await pageAssistance.goto(`${adresseFiche}?onglet=engagements`)
    await expect(pageAssistance.getByRole("button", { name: "Engager la voiture" })).toHaveCount(0)
    await expect(pageAssistance.getByText("Saxo test e2e").first()).toBeVisible()

    const adresseEngagement = await pageAssistance.getByRole("link", { name: /Saxo test e2e/ }).first().getAttribute("href")
    await pageAssistance.goto(adresseEngagement ?? "/apps/saison")
    await expect(pageAssistance.getByRole("button", { name: "Enregistrer le paiement" })).toHaveCount(0)
    await expect(pageAssistance.getByText("Montant")).toHaveCount(0)
    await expect(pageAssistance.getByText("Tarif")).toHaveCount(0)
  } finally {
    await contexteAssistance.close()
  }
})
