// Parcours Check-lists (tâche 5.6) par des clics : le responsable traite la proposition dans la boîte, prépare une
// liste en phase Retour (avertissement avant phase), coche, met un point en problème, ajoute une photo et renomme un
// modèle ; l'assistance ne voit ni Modèles ni Débrief. La partie hors ligne n'est pas ici (tâche 5.6b).
import path from "node:path"

import type { Response } from "@playwright/test"

import { preparerEngagementChecklist } from "./aide/checklist"
import { envoyer, envoyerSansFermeture } from "./aide/envoi"
import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { ajouterMembreConnectable, statutAction, statutPointChecklistEnBase } from "./aide/session"

const PHOTO = path.join(__dirname, "fichiers", "photo.jpg")
// Réponse d'une server action : à attendre après un envoi qui ne ferme pas de tiroir (cf. envoi.ts).
const RESPONSE_ACTION = (r: Response) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined

test("Check-lists · responsable : boîte, liste en phase Retour, coche, problème, photo, modèle renommé", async ({ page, equipe }) => {
  test.setTimeout(300_000)
  const { entryId } = await preparerEngagementChecklist(equipe)
  await connecterParLien(page, equipe)

  // 1. La boîte propose de créer les listes de l'engagement ; Accepter les crée (proposition traitée).
  await page.getByRole("button", { name: /Boîte d'actions/ }).click()
  const boite = page.getByRole("dialog")
  await expect(boite.getByRole("heading", { name: "Créer les listes de l'engagement" })).toBeVisible()
  // Les listes se créent après la décision, dans la même requête : on attend la réponse avant de naviguer (envoi.ts).
  await envoyerSansFermeture(page, boite.getByRole("button", { name: "Accepter", exact: true }))
  await expect.poll(() => statutAction(equipe, `creer_listes:${entryId}`)).toBe("decidee")

  // 2. Préparation : les listes de l'engagement sont là, sous « Par engagement ».
  await page.goto("/apps/checklist")
  await expect(page.getByRole("region", { name: "Par engagement" }).getByRole("link").first()).toBeVisible()

  // 3. Une liste vierge en phase Retour : ouverte, elle affiche l'avertissement avant phase (phases d'avant non finies).
  await page.getByRole("button", { name: "+ Nouvelle liste vierge", exact: true }).click()
  const nouvelle = page.getByRole("dialog")
  await nouvelle.getByLabel("Titre", { exact: true }).fill("Test retour")
  // Le libellé entoure le select : son nom accessible contient les options, on cible le champ par son nom.
  await nouvelle.locator('select[name="phase"]').selectOption("retour")
  await envoyer(page, nouvelle.getByRole("button", { name: "Créer la liste", exact: true }))

  await page.getByRole("link", { name: /Test retour/ }).click()
  await expect(page).toHaveURL(/\/apps\/checklist\/liste\/[^?]+\?avertir=1$/)
  const avertissement = page.getByRole("alert", { name: "Avertissement avant phase" })
  await expect(avertissement).toBeVisible()
  await avertissement.getByRole("link", { name: "Démarrer quand même", exact: true }).click()
  await expect(page.getByRole("alert", { name: "Avertissement avant phase" })).toHaveCount(0)

  // 4. Deux points dans la liste : un critique, et un simple.
  for (const [libelle, critique] of [
    ["Pression des pneus", true],
    ["Niveau d'huile", false],
  ] as const) {
    await page.getByRole("button", { name: "+ Ajouter un point", exact: true }).click()
    const ajout = page.getByRole("dialog")
    await ajout.getByLabel("Libellé du point", { exact: true }).fill(libelle)
    if (critique) await ajout.getByLabel("Point critique", { exact: true }).check()
    await envoyer(page, ajout.getByRole("button", { name: "Ajouter le point", exact: true }))
  }
  await expect(page.locator("li").filter({ hasText: "Pression des pneus" }).getByText("Critique")).toBeVisible()

  // 5. Coche d'un appui : « Niveau d'huile » passe à Fait (en base aussi).
  const ligneHuile = page.locator("li").filter({ hasText: "Niveau d'huile" })
  const reponseCoche = page.waitForResponse(RESPONSE_ACTION)
  await ligneHuile.getByRole("button", { name: "Faire", exact: true }).click()
  await reponseCoche
  await expect.poll(() => statutPointChecklistEnBase(equipe, "Niveau d'huile")).toBe("fait")

  // 6. Fiche du point critique : Problème. La fiche reste ouverte (c'est le même écran), le statut change en base.
  await page.locator("li").filter({ hasText: "Pression des pneus" }).getByRole("link", { name: "Détail", exact: true }).click()
  const fiche = page.getByRole("dialog").first()
  await expect(fiche.getByText("Pression des pneus").first()).toBeVisible()
  const reponseProbleme = page.waitForResponse(RESPONSE_ACTION)
  await fiche.getByRole("button", { name: "Problème", exact: true }).click()
  await reponseProbleme
  await expect.poll(() => statutPointChecklistEnBase(equipe, "Pression des pneus")).toBe("probleme")

  // 7. Photo sur le point : envoyée, puis affichée dans la fiche (vignette servie par /api/fichiers).
  await fiche.getByRole("button", { name: "Ajouter une photo", exact: true }).click()
  const photo = page.getByRole("dialog").last()
  await photo.locator('input[type="file"]').setInputFiles(PHOTO)
  const reponsePhoto = page.waitForResponse(RESPONSE_ACTION)
  await photo.getByRole("button", { name: "Envoyer la photo", exact: true }).click()
  await reponsePhoto
  await expect(page.getByRole("dialog")).toHaveCount(1)
  await expect(fiche.locator('img[src^="/api/fichiers/"]')).toHaveCount(1)

  // 8. Modèle : créé dans la team, puis renommé depuis sa fiche.
  await page.goto("/apps/checklist/modeles")
  await page.getByRole("button", { name: "+ Nouveau modèle", exact: true }).click()
  const nouveauModele = page.getByRole("dialog")
  await nouveauModele.getByLabel("Nom", { exact: true }).fill("Modèle e2e")
  await envoyer(page, nouveauModele.getByRole("button", { name: "Créer le modèle", exact: true }))

  await page.getByRole("link", { name: "Modifier", exact: true }).first().click()
  await page.getByRole("button", { name: "Modifier le modèle", exact: true }).click()
  const renommage = page.getByRole("dialog")
  await renommage.getByLabel("Nom", { exact: true }).fill("Modèle e2e renommé")
  await envoyer(page, renommage.getByRole("button", { name: "Enregistrer", exact: true }))
  await expect(page.getByRole("heading", { name: "Modèle e2e renommé", exact: true })).toBeVisible()
})

test("Check-lists · assistance : la préparation s'ouvre, Modèles et Débrief ne sont pas dans le menu", async ({ page, equipe }) => {
  // Une épreuve à venir : la préparation affiche ses sections (sans épreuve, elle n'en affiche aucune).
  await preparerEngagementChecklist(equipe)
  const assistance = await ajouterMembreConnectable(equipe, "assistance")
  await connecterParLien(page, { ...equipe, secretLien: assistance.secretLien })

  await page.goto("/apps/checklist")
  await expect(page.getByRole("region", { name: "Avancement" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Modèles", exact: true })).toHaveCount(0)
  await expect(page.getByRole("link", { name: "Débrief", exact: true })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "+ Nouvelle liste vierge", exact: true })).toHaveCount(0)
})
