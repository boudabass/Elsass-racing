// Captures de Check-lists (tâche 5.6) : préparation, liste, fiche d'un point, mode terrain, avertissement avant phase,
// débrief, modèles vide et rempli, à 1440 et à 360 px, en thème sombre et en thème clair. Elles partent dans
// docs/captures/ (checklist-*) ; elles sont téléchargées du run, relues une à une, puis commitées à la main.
import path from "node:path"

import { capturer, choisirTheme } from "./aide/equipe"
import { preparerEngagementChecklist } from "./aide/checklist"
import { envoyer } from "./aide/envoi"
import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { passerEpreuveDansLePasseEnBase, statutAction } from "./aide/session"

const BUREAU = { largeur: "1440", width: 1440, height: 900 }
const TELEPHONE = { largeur: "360", width: 360, height: 740 }
const PHOTO = path.join(__dirname, "fichiers", "photo.jpg")

test("captures · préparation, liste, fiche, mode terrain, avertissement, débrief, 1440 et 360 px, sombre et clair", async ({ page, equipe }) => {
  test.setTimeout(600_000)
  const { entryId, eventId } = await preparerEngagementChecklist(equipe)
  await connecterParLien(page, equipe)

  // Données réelles, créées par l'interface : la proposition acceptée, une liste en phase Retour, deux points.
  await page.getByRole("button", { name: /Boîte d'actions/ }).click()
  const boite = page.getByRole("dialog")
  await boite.getByRole("button", { name: "Accepter", exact: true }).click()
  await expect.poll(() => statutAction(equipe, `creer_listes:${entryId}`)).toBe("decidee")

  await page.goto("/apps/checklist")
  await page.getByRole("button", { name: "+ Nouvelle liste vierge", exact: true }).click()
  const nouvelle = page.getByRole("dialog")
  await nouvelle.getByLabel("Titre", { exact: true }).fill("Test retour")
  await nouvelle.getByLabel("Phase", { exact: true }).selectOption("retour")
  await envoyer(page, nouvelle.getByRole("button", { name: "Créer la liste", exact: true }))

  await page.getByRole("link", { name: /Test retour/ }).click()
  await page.getByRole("link", { name: "Démarrer quand même", exact: true }).click()
  const listeUrl = page.url()
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
  const reponseCoche = page.waitForResponse((r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined)
  await page.locator("li").filter({ hasText: "Niveau d'huile" }).getByRole("button", { name: "Faire", exact: true }).click()
  await reponseCoche

  // Fiche du point critique : Problème, puis une photo.
  await page.locator("li").filter({ hasText: "Pression des pneus" }).getByRole("link", { name: "Détail", exact: true }).click()
  const ficheUrl = page.url()
  const fiche = page.getByRole("dialog").first()
  const reponseProbleme = page.waitForResponse((r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined)
  await fiche.getByRole("button", { name: "Problème", exact: true }).click()
  await reponseProbleme
  await fiche.getByRole("button", { name: "Ajouter une photo", exact: true }).click()
  const photo = page.getByRole("dialog").last()
  await photo.locator('input[type="file"]').setInputFiles(PHOTO)
  // La fiche reste ouverte sous le tiroir de photo : on attend la réponse, puis la fermeture de ce seul tiroir.
  const reponsePhoto = page.waitForResponse((r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined)
  await photo.getByRole("button", { name: "Envoyer la photo", exact: true }).click()
  await reponsePhoto
  await expect(page.getByRole("dialog")).toHaveCount(1)
  await expect(fiche.locator('img[src^="/api/fichiers/"]')).toHaveCount(1)

  // Chaque écran se rejoint par son URL, en thème et en taille donnés.
  for (const theme of ["sombre", "clair"] as const) {
    await choisirTheme(page, theme)

    for (const taille of [BUREAU, TELEPHONE]) {
      await page.setViewportSize({ width: taille.width, height: taille.height })

      await page.goto("/apps/checklist")
      await expect(page.getByRole("region", { name: "Avancement" })).toBeVisible()
      await capturer(page, `checklist-preparation-${taille.largeur}-${theme}.png`)

      await page.goto(listeUrl)
      await expect(page.getByRole("heading", { name: "Test retour", exact: true })).toBeVisible()
      await capturer(page, `checklist-liste-${taille.largeur}-${theme}.png`)

      await page.goto(ficheUrl)
      await expect(page.getByRole("dialog").getByRole("button", { name: "Problème", exact: true })).toBeVisible()
      await capturer(page, `checklist-fiche-point-${taille.largeur}-${theme}.png`)

      await page.goto(`${listeUrl}?avertir=1`)
      await expect(page.getByRole("alert", { name: "Avertissement avant phase" })).toBeVisible()
      await capturer(page, `checklist-avertissement-${taille.largeur}-${theme}.png`)

      // Mode terrain : le réglage est celui du membre, rétabli après la capture.
      await page.goto(listeUrl)
      const reponseTerrain = page.waitForResponse((r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined)
      await page.getByRole("button", { name: "Mode terrain", exact: true }).click()
      await reponseTerrain
      await expect(page.getByRole("button", { name: "Quitter le mode terrain", exact: true })).toBeVisible()
      await capturer(page, `checklist-mode-terrain-${taille.largeur}-${theme}.png`)
      const reponseRetour = page.waitForResponse((r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined)
      await page.getByRole("button", { name: "Quitter le mode terrain", exact: true }).click()
      await reponseRetour
    }
  }

  // Débrief : l'épreuve est passée (Saison la passe à « terminée » au chargement), ses problèmes sont là.
  await passerEpreuveDansLePasseEnBase(equipe, eventId, "2020-06-01", "2020-06-02")
  for (const theme of ["sombre", "clair"] as const) {
    await choisirTheme(page, theme)
    for (const taille of [BUREAU, TELEPHONE]) {
      await page.setViewportSize({ width: taille.width, height: taille.height })
      await page.goto("/apps/checklist/debrief")
      await expect(page.getByText("Pression des pneus").first()).toBeVisible()
      await capturer(page, `checklist-debrief-${taille.largeur}-${theme}.png`)
    }
  }
})

test("captures · modèles vide et rempli, 1440 et 360 px, sombre et clair", async ({ page, equipe }) => {
  test.setTimeout(300_000)
  await connecterParLien(page, equipe)

  let cree = false
  for (const theme of ["sombre", "clair"] as const) {
    await choisirTheme(page, theme)
    for (const taille of [BUREAU, TELEPHONE]) {
      await page.setViewportSize({ width: taille.width, height: taille.height })
      await page.goto("/apps/checklist/modeles")
      if (!cree) {
        await expect(page.getByText("Aucun modèle de la team pour l'instant.", { exact: true })).toBeVisible()
        await capturer(page, `checklist-modeles-vide-${taille.largeur}-${theme}.png`)
        await page.getByRole("button", { name: "+ Nouveau modèle", exact: true }).click()
        const nouveau = page.getByRole("dialog")
        await nouveau.getByLabel("Nom", { exact: true }).fill("Contrôle avant départ")
        await envoyer(page, nouveau.getByRole("button", { name: "Créer le modèle", exact: true }))
        cree = true
        await page.goto("/apps/checklist/modeles")
      }
      await expect(page.getByText("Contrôle avant départ", { exact: true })).toBeVisible()
      await capturer(page, `checklist-modeles-rempli-${taille.largeur}-${theme}.png`)
    }
  }
})
