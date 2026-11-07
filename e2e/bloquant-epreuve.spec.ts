// Priorité 1 « Bloquant » pour une épreuve proche (tâche 5.9, 960 §5). Une épreuve dans 5 jours ; le pilote a une licence qui
// expire avant, et l'engagement n'est pas payé. La boîte doit mettre les deux actions en tête, avec « Bloquant pour <épreuve> » ;
// le paiement lève l'action de Saison, le renouvellement lève celle d'Équipe. Les données de base sont lues par des requêtes,
// jamais à l'écran seul.
import path from "node:path"

import type { Page } from "@playwright/test"

import { jourParis } from "./aide/dates"
import { DOSSIER_CAPTURES, creerPersonne, choisirTheme, ajouterLicence, ouvrirOnglet } from "./aide/equipe"
import { envoyer } from "./aide/envoi"
import { expect, test } from "./aide/fixtures"
import { connecterParLien, tuilesDuQg } from "./aide/navigation"
import { preparerEpreuveChecklist } from "./aide/checklist"
import {
  definirEquipageEnBase,
  engagerVehiculeEnBase,
  inscrireEngagementEnBase,
  montantPayeEnBase,
  statutActionTitreEnBase,
} from "./aide/session"

const TITRE_LICENCE = "Renouveler la licence de Théo Pilote"

// « AAAA-MM-JJ » → « JJ/MM/AAAA », comme le titre de l'action.
const dateCourte = (aaaammjj: string) => `${aaaammjj.slice(8)}/${aaaammjj.slice(5, 7)}/${aaaammjj.slice(0, 4)}`

// Retour au QG par le lien de la barre haute (les étapes s'enchaînent là où la précédente s'est arrêtée).
async function retourAuQg(page: Page): Promise<void> {
  await page.getByRole("link", { name: /retour au QG/ }).click()
  await expect(page).toHaveURL(/\/qg$/)
}

// Ouvre la boîte d'actions et rend son contenu (le dialogue modal).
async function ouvrirBoite(page: Page) {
  await page.getByRole("button", { name: /Boîte d'actions/ }).click()
  const boite = page.getByRole("dialog")
  await expect(boite).toBeVisible()
  return boite
}

// Capture de la boîte : 1440 et 360 px, clair et sombre. Le thème est une préférence du membre (Réglages).
async function capturerBoite(page: Page, nom: string): Promise<void> {
  for (const theme of ["clair", "sombre"] as const) {
    await choisirTheme(page, theme)
    await retourAuQg(page)
    const boite = await ouvrirBoite(page)
    for (const [largeur, hauteur, suffixe] of [
      [1440, 900, "1440x900"],
      [360, 740, "360x740"],
    ] as const) {
      await page.setViewportSize({ width: largeur, height: hauteur })
      await boite.waitFor()
      await page.screenshot({ path: path.join(DOSSIER_CAPTURES, `bloquant-epreuve-${nom}-${suffixe}-${theme}.png`), fullPage: true, animations: "disabled" })
    }
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toHaveCount(0)
  }
  await page.setViewportSize({ width: 1440, height: 900 })
}

test("bloquant pour une épreuve proche : boîte, paiement de l'engagement, renouvellement de la licence", async ({ page, equipe }) => {
  test.setTimeout(900_000)
  await page.setViewportSize({ width: 1440, height: 900 })

  // Épreuve dans 5 jours et sa voiture ; l'engagement est inscrit, sans paiement, à l'équipage choisi plus bas.
  const { eventId, vehicleId } = await preparerEpreuveChecklist(equipe, { debutDans: 5 })
  const nomEpreuve = `Rallye Check-lists ${equipe.horodatage}`
  const entryId = await engagerVehiculeEnBase(equipe, eventId, vehicleId, "inscrit")
  // Le dossier est envoyé, pas payé : le paiement se saisit sur la fiche de l'engagement (sans inscription, pas de formulaire).
  await inscrireEngagementEnBase(equipe, entryId)

  await connecterParLien(page, equipe)

  // Le pilote, puis une licence qui expire dans 3 jours : valable aujourd'hui, plus le jour de l'épreuve (J+5).
  const piloteId = await creerPersonne(page, "Théo", "Pilote", "Pilote")
  await ajouterLicence(page, "Licence FFSA régionale", "L-BLOQ-5", jourParis(3))
  const copiloteId = await creerPersonne(page, "Nina", "Copilote", "Copilote")
  await definirEquipageEnBase(equipe, entryId, piloteId, copiloteId)

  await test.step("1. Boîte : la licence et l'engagement à payer sont en tête, avec « Bloquant pour <épreuve> »", async () => {
    await retourAuQg(page)
    const boite = await ouvrirBoite(page)

    const licence = boite.locator("article").filter({ hasText: TITRE_LICENCE })
    await expect(licence).toHaveCount(1)
    await expect(licence).toContainText(`Bloquant pour ${nomEpreuve}`)

    const payer = boite.locator("article").filter({ hasText: "Engagement à payer" })
    await expect(payer).toHaveCount(1)
    await expect(payer).toContainText(`Bloquant pour ${nomEpreuve}`)

    // La première carte de la boîte est une action de rang 1.
    await expect(boite.locator("article").first()).toContainText("Bloquant pour")

    // En base : l'action de la licence est ouverte, à la date de fin de validité (« expire le JJ/MM/AAAA »).
    await expect.poll(() => statutActionTitreEnBase(equipe, "licence:", `${TITRE_LICENCE} : expire le ${dateCourte(jourParis(3))}`)).toBe("en_attente")
    await page.keyboard.press("Escape")
  })

  await test.step("2. Captures : la boîte avec les actions bloquantes, 1440 et 360 px, clair et sombre", async () => {
    await capturerBoite(page, "boite")
  })

  await test.step("3. Paiement : l'engagement est payé ; l'action « Engagement à payer » sort de la boîte au retour au QG", async () => {
    await retourAuQg(page)
    const boite = await ouvrirBoite(page)
    await boite.locator("article").filter({ hasText: "Engagement à payer" }).getByRole("link", { name: "Voir l'engagement", exact: true }).click()
    await expect(page).toHaveURL(/\/apps\/saison\/engagements\/[0-9a-f-]+/)
    // La boîte, Sheet modal, reste ouverte après le lien : on la ferme avant de saisir le paiement.
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toHaveCount(0)

    await page.getByRole("button", { name: "Enregistrer un paiement", exact: true }).click()
    await page.getByLabel("Montant payé (€)").fill("450")
    await page.getByLabel("Payeur").selectOption({ index: 1 })
    await envoyer(page, page.getByRole("dialog").getByRole("button", { name: "Enregistrer le paiement", exact: true }))
    await expect.poll(() => montantPayeEnBase(equipe, entryId)).toBe(45_000)

    await retourAuQg(page)
    const apresPaiement = await ouvrirBoite(page)
    await expect(apresPaiement.locator("article").filter({ hasText: "Engagement à payer" })).toHaveCount(0)
    // La licence reste à renouveler : son action est toujours là, en rang 1.
    await expect(apresPaiement.locator("article").filter({ hasText: TITRE_LICENCE })).toContainText(`Bloquant pour ${nomEpreuve}`)
    await page.keyboard.press("Escape")
  })

  await test.step("4. Renouvellement : la licence est reportée à plus d'un an ; son action sort de la boîte", async () => {
    await retourAuQg(page)
    await tuilesDuQg(page)
      .filter({ has: page.getByRole("heading", { name: "Équipe", exact: true }) })
      .click()
    await page.getByRole("link", { name: /Théo Pilote/ }).first().click()
    await ouvrirOnglet(page, "Licences")
    await page.getByRole("button", { name: "Modifier", exact: true }).first().click()
    await page.getByRole("dialog").getByLabel("Valable jusqu'au").fill(jourParis(400))
    await envoyer(page, page.getByRole("dialog").getByRole("button", { name: "Enregistrer", exact: true }))

    await retourAuQg(page)
    const boite = await ouvrirBoite(page)
    await expect(boite.locator("article").filter({ hasText: TITRE_LICENCE })).toHaveCount(0)
    await page.keyboard.press("Escape")
  })
})
