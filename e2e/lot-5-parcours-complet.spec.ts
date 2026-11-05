// Parcours du lot 5 (tâche 5.8, brief §2) : ce que la team vit à travers Équipe, Documents, Check-lists et Saison, par clics
// depuis le QG. Chaque étape reprend un parcours d'app déjà testé à part ; celui-ci les enchaîne sur une seule team.
// Les étapes qui ne sont pas encore couvertes ici sont listées en tête de section, avec leur raison : ne pas les
// présumer vérifiées.
import path from "node:path"

import type { Page } from "@playwright/test"

import { preparerEngagementChecklist } from "./aide/checklist"
import { jourParis } from "./aide/dates"
import { accesDocumentEnBase, documentEnBase, rattacherPersonneAuCompte } from "./aide/documents"
import { ajouterEquipement, ajouterLicence, creerPersonne } from "./aide/equipe"
import { envoyer } from "./aide/envoi"
import { expect, test } from "./aide/fixtures"
import { connecterParLien, tuilesDuQg } from "./aide/navigation"
import { ajouterEquipier, ajouterMembreConnectable, definirEquipageEnBase, retirerAdhesion, statutAction } from "./aide/session"

// Non couvert ici, à faire ou à reprendre ailleurs :
// - étape 1 : le paiement de licence (une seule dépense à Budget, décidée dans Budget) et l'ASA ;
// - étape 3 : affectation sur Prochaine épreuve et marquage de la tâche (couvert par equipe.spec.ts, pas encore enchaîné) ;
// - étape 5 : fait ici pour le fichier d'un document ; reste à faire : la licence d'une autre personne et la photo d'une liste fermée (404), le logo affiché par Voiture (200) ;
// - étape 7 et 8 : liaisons à un organe, ordre Garage, propositions d'organe en zone rouge (garage-parcours-complet.spec.ts) ;
// - étape 9 : palier et statistiques après un résultat validé, et Binômes avec données ;
// - captures 1440 et 360 px, clair et sombre (étapes 2, 7, 9).

const ANNEE = new Date().getFullYear() + 1
const PDF = path.resolve("e2e/fichiers/preuve.pdf")
const NOM_DOSSIER_GESTION = "Gestion du lot 5"
const TITRE_PLAN = "Plan de sécurité du lot 5"

// Ouvre une épreuve de Saison par clics : tuile, liste, puis l'épreuve. Son panneau « Prêt pour l'épreuve ? » est l'onglet par défaut.
async function ouvrirEpreuveDansSaison(page: Page, nom: string): Promise<void> {
  await tuilesDuQg(page)
    .filter({ has: page.getByRole("heading", { name: "Saison", exact: true }) })
    .click()
  await page.getByRole("link", { name: "Liste", exact: true }).click()
  await page.getByRole("link", { name: nom }).first().click()
  await expect(page).toHaveURL(/\/apps\/saison\/epreuves\/[0-9a-f-]{36}/)
}

test("lot 5 · parcours : Équipe, Saison, Documents, Check-lists, membre retiré", async ({ page, equipe, browser }) => {
  test.setTimeout(600_000)
  await page.setViewportSize({ width: 1440, height: 900 })

  // Données de l'engagement : une épreuve à venir avec sa Saxo, un engagement, et le modèle de Check-lists de la team.
  const { entryId } = await preparerEngagementChecklist(equipe)
  const nomEpreuve = `Rallye Check-lists ${equipe.horodatage}`

  await connecterParLien(page, equipe)

  await test.step("1. Équipe : pilote et copilote, licence et casque", async () => {
    const piloteId = await creerPersonne(page, "Théo", "Pilote", "Pilote")
    await ajouterLicence(page, "Licence FFSA régionale", "L-PIL-5", `${ANNEE}-12-31`)
    await ajouterEquipement(page, "Casque", "Arai")

    const copiloteId = await creerPersonne(page, "Nina", "Copilote", "Copilote")
    await ajouterLicence(page, "Licence FFSA régionale", "L-COP-5", `${ANNEE}-12-31`)

    // L'équipage se choisit dans Saison : on le pose en base pour l'engagement (étape 2 le lit dans le panneau).
    await definirEquipageEnBase(equipe, entryId, piloteId, copiloteId)
    await page.goto("/qg")
  })

  await test.step("2. Saison : « Prêt pour l'épreuve ? » affiche l'engagement et son équipage", async () => {
    await ouvrirEpreuveDansSaison(page, nomEpreuve)
    await expect(page.getByText("Prêt pour l'épreuve ?", { exact: false }).first()).toBeVisible()
    await page.goto("/qg")
  })

  await test.step("4. Documents : une assurance à vingt jours, l'action de renouvellement sort par « Reporter »", async () => {
    await tuilesDuQg(page)
      .filter({ has: page.getByRole("heading", { name: "Documents", exact: true }) })
      .click()
    await expect(page.getByRole("heading", { name: "Coffre-fort", exact: true })).toBeVisible()
    await page.getByRole("link", { name: "Coffre-fort", exact: true }).click()
    await page.getByRole("button", { name: "Document", exact: true }).click()
    const tiroir = page.getByRole("dialog")
    await tiroir.getByLabel("Titre", { exact: true }).fill("Assurance de l'association")
    await tiroir.getByLabel("Type de document", { exact: true }).selectOption("assurance_asso")
    await tiroir.getByLabel("Dossier", { exact: true }).selectOption({ label: "Assurances" })
    await tiroir.getByLabel("Date de validité", { exact: true }).fill(jourParis(20))
    await envoyer(page, tiroir.getByRole("button", { name: "Ajouter le document", exact: true }))
    expect(await documentEnBase(equipe, "Assurance de l'association")).not.toBeNull()

    await page.goto("/qg")
    await page.getByRole("button", { name: /Boîte d'actions/ }).click()
    const boite = page.getByRole("dialog")
    await expect(boite.getByText(/Renouveler Assurance de l'association : expire le/)).toBeVisible()
    const reponse = page.waitForResponse((r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined)
    await boite.getByRole("button", { name: "Reporter d'une semaine", exact: true }).click()
    await reponse
    await expect(boite.getByText(/Renouveler Assurance de l'association/)).toHaveCount(0)
    await page.keyboard.press("Escape")
  })

  // Preuve principale du §3.1 : un fichier de dossier caché répond 404 à l'assistance, 200 une fois partagé, 404 après retrait.
  // Le fichier s'ouvre par son URL directe /api/fichiers/<id> : elle se lit sur la fiche du document, comme pour la responsable.
  await test.step("5. Assistance : dossier caché, fichier 404, 200 après partage interne, 404 après retrait", async () => {
    const assistance = await ajouterMembreConnectable(equipe, "assistance", "-l5")
    const personneAssistance = await rattacherPersonneAuCompte(equipe, assistance, "Anne", "Assistance")

    await tuilesDuQg(page)
      .filter({ has: page.getByRole("heading", { name: "Documents", exact: true }) })
      .click()
    await expect(page.getByRole("heading", { name: "Coffre-fort", exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Dossier", exact: true }).click()
    const tiroirDossier = page.getByRole("dialog")
    await tiroirDossier.getByLabel("Nom", { exact: true }).fill(NOM_DOSSIER_GESTION)
    await tiroirDossier.getByLabel("Qui peut voir", { exact: true }).selectOption("gestion")
    await envoyer(page, tiroirDossier.getByRole("button", { name: "Créer le dossier", exact: true }))

    await page.getByRole("button", { name: "Document", exact: true }).click()
    const tiroirPlan = page.getByRole("dialog")
    await tiroirPlan.getByLabel("Titre", { exact: true }).fill(TITRE_PLAN)
    await tiroirPlan.getByLabel("Type de document", { exact: true }).selectOption("autre")
    await tiroirPlan.getByLabel("Dossier", { exact: true }).selectOption({ label: NOM_DOSSIER_GESTION })
    await tiroirPlan.locator('input[type="file"]').setInputFiles(PDF)
    await expect(tiroirPlan.getByRole("button", { name: "Remplacer", exact: true })).toBeVisible()
    await envoyer(page, tiroirPlan.getByRole("button", { name: "Ajouter le document", exact: true }))

    const plan = await documentEnBase(equipe, TITRE_PLAN)
    expect(plan).not.toBeNull()
    // Le plan est rangé dans le dossier « gestion » : le coffre n'affiche que le dossier, on l'ouvre avant le document.
    await page.getByRole("link", { name: new RegExp(NOM_DOSSIER_GESTION) }).click()
    await page.getByRole("link", { name: TITRE_PLAN }).click()
    const urlFichier = await page.locator('a[href^="/api/fichiers/"]').first().getAttribute("href")
    expect(urlFichier).toMatch(/^\/api\/fichiers\/[^/?#]+$/)

    const contexteAssistance = await browser.newContext()
    try {
      const assist = await contexteAssistance.newPage()
      await assist.goto(`/connexion/lien?t=${assistance.secretLien}`)
      await assist.waitForURL(/\/qg$/)
      await tuilesDuQg(assist)
        .filter({ has: assist.getByRole("heading", { name: "Documents", exact: true }) })
        .click()
      await expect(assist.getByRole("heading", { name: "Coffre-fort", exact: true })).toBeVisible()
      await expect(assist.getByRole("link", { name: new RegExp(NOM_DOSSIER_GESTION) })).toHaveCount(0)
      expect((await contexteAssistance.request.get(urlFichier!)).status()).toBe(404)

      // La responsable partage le plan : le fichier s'ouvre, le dossier apparaît avec ce seul document.
      await page.getByRole("button", { name: "Partager avec un membre", exact: true }).click()
      const tiroirPartage = page.getByRole("dialog")
      await tiroirPartage.getByLabel("Membre", { exact: true }).selectOption({ label: "Anne Assistance" })
      await envoyer(page, tiroirPartage.getByRole("button", { name: "Partager", exact: true }))
      expect(await accesDocumentEnBase(equipe, plan!.id, personneAssistance)).toBe("lecture")

      await assist.reload()
      await expect(assist.getByRole("link", { name: new RegExp(NOM_DOSSIER_GESTION) })).toContainText("1 document")
      expect((await contexteAssistance.request.get(urlFichier!)).status()).toBe(200)

      // Retrait du partage : l'accès est retiré en base et le fichier répond de nouveau 404.
      await page.getByRole("button", { name: "Retirer", exact: true }).click()
      const tiroirRetrait = page.getByRole("dialog")
      await envoyer(page, tiroirRetrait.getByRole("button", { name: "Retirer le partage", exact: true }))
      expect(await accesDocumentEnBase(equipe, plan!.id, personneAssistance)).toBeNull()

      await assist.reload()
      expect((await contexteAssistance.request.get(urlFichier!)).status()).toBe(404)
    } finally {
      await contexteAssistance.close()
    }
  })

  await test.step("6. Check-lists : la proposition « Créer les listes » est acceptée, la liste apparaît", async () => {
    await page.goto("/qg")
    await page.getByRole("button", { name: /Boîte d'actions/ }).click()
    const boite = page.getByRole("dialog")
    await expect(boite.getByRole("heading", { name: "Créer les listes de l'engagement" })).toBeVisible()
    await boite.getByRole("button", { name: "Accepter", exact: true }).click()
    await expect.poll(() => statutAction(equipe, `creer_listes:${entryId}`)).toBe("decidee")

    await page.goto("/apps/checklist")
    await expect(page.getByRole("region", { name: "Par engagement" }).getByRole("link").first()).toBeVisible()
  })

  await test.step("10. Membre retiré : « Anciens membres » garde son nom, sa fiche reste", async () => {
    const membre = await ajouterEquipier(equipe)
    await creerPersonne(page, "Lou", "Retiree", "Bénévole")
    await rattacherPersonneAuCompte(equipe, membre, "Lou", "Retiree")
    await retirerAdhesion(membre)

    await page.goto("/apps/equipe")
    await expect(page.getByRole("heading", { name: "L'équipe", exact: true })).toBeVisible()
    // Le bouton porte le compteur : « Anciens membres (1) ».
    await page.getByRole("button", { name: /^Anciens membres/ }).click()
    await expect(page.getByRole("dialog").getByText("Lou Retiree", { exact: false })).toBeVisible()
  })
})
