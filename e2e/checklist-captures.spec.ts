// Captures de Check-lists (tâche 5.6) : préparation, liste, fiche d'un point, mode terrain, avertissement avant phase,
// débrief, modèles vide et rempli, à 1440 et à 360 px, en thème sombre et en thème clair. Elles partent dans
// docs/captures/ (checklist-*) ; elles sont téléchargées du run, relues une à une, puis commitées à la main.
import path from "node:path"

import type { Page } from "@playwright/test"

import { capturer, choisirTheme } from "./aide/equipe"
import { accepterListes, preparerEngagementChecklist } from "./aide/checklist"
import { envoyer } from "./aide/envoi"
import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { passerEpreuveDansLePasseEnBase } from "./aide/session"

const BUREAU = { largeur: "1440", width: 1440, height: 900 }
const TELEPHONE = { largeur: "360", width: 360, height: 740 }
const PHOTO = path.join(__dirname, "fichiers", "photo.jpg")

// Réponse d'une server action : à attendre après un envoi qui ne ferme pas de tiroir (cf. envoi.ts).
const REPONSE_ACTION = (r: { request: () => { method: () => string; headers: () => Record<string, string> } }) =>
  r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined

async function creerListeVierge(page: Page, titre: string, phase: string): Promise<void> {
  await page.getByRole("button", { name: "+ Nouvelle liste vierge", exact: true }).click()
  const dialogue = page.getByRole("dialog")
  await dialogue.getByLabel("Titre", { exact: true }).fill(titre)
  // Le libellé entoure le select : son nom accessible contient les options, on cible le champ par son nom.
  await dialogue.locator('select[name="phase"]').selectOption(phase)
  await envoyer(page, dialogue.getByRole("button", { name: "Créer la liste", exact: true }))
}

test("captures · préparation, liste, fiche, mode terrain, avertissement, débrief, 1440 et 360 px, sombre et clair", async ({ page, equipe }) => {
  test.setTimeout(600_000)
  const { entryId, eventId } = await preparerEngagementChecklist(equipe)
  await connecterParLien(page, equipe)

  // Données réelles, créées par l'interface : la proposition acceptée, deux listes, des points.
  await page.getByRole("button", { name: /Boîte d'actions/ }).click()
  await accepterListes(page, equipe, entryId)

  // « Contrôles » (avant départ) porte les coches et le problème. « Test retour » (retour) reste vierge : c'est elle
  // qui porte l'avertissement, qui ne vaut que tant qu'aucune liste de retour n'est entamée.
  await page.goto("/apps/checklist")
  await creerListeVierge(page, "Contrôles", "avant_depart")
  await creerListeVierge(page, "Test retour", "retour")

  await page.goto("/apps/checklist")
  await page.getByRole("link", { name: /^Test retour / }).click()
  await expect(page).toHaveURL(/\?avertir=1$/)
  const avertissementUrl = page.url()

  await page.goto("/apps/checklist")
  await page.getByRole("link", { name: /^Contrôles / }).click()
  await expect(page).toHaveURL(/\/apps\/checklist\/liste\/[^?]+$/)
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
  const reponseCoche = page.waitForResponse(REPONSE_ACTION)
  await page.locator("li").filter({ hasText: "Niveau d'huile" }).getByRole("button", { name: "Faire", exact: true }).click()
  await reponseCoche

  // Fiche du point critique : Problème, puis une photo.
  await page.locator("li").filter({ hasText: "Pression des pneus" }).getByRole("link", { name: "Détail", exact: true }).click()
  // Le lien est client : l'URL change après le clic, on attend qu'elle soit la fiche avant de la lire.
  await expect(page).toHaveURL(/\?point=/)
  const ficheUrl = page.url()
  const fiche = page.getByRole("dialog").first()
  const reponseProbleme = page.waitForResponse(REPONSE_ACTION)
  await fiche.getByRole("button", { name: "Problème", exact: true }).click()
  await reponseProbleme
  await fiche.getByRole("button", { name: "Ajouter une photo", exact: true }).click()
  const photo = page.getByRole("dialog").last()
  await photo.locator('input[type="file"]').setInputFiles(PHOTO)
  // La fiche reste ouverte sous le tiroir de photo : on attend la réponse, puis la fermeture de ce seul tiroir.
  const reponsePhoto = page.waitForResponse(REPONSE_ACTION)
  await photo.getByRole("button", { name: "Envoyer la photo", exact: true }).click()
  await reponsePhoto
  await expect(page.getByRole("dialog")).toHaveCount(1)
  await expect(fiche.locator('img[src^="/api/fichiers/"]')).toHaveCount(1)

  // Liste de l'engagement : une coche sur « Triangle de présentation » donne un historique à sa fiche.
  await page.goto("/apps/checklist")
  await page.getByRole("region", { name: "Par engagement" }).getByRole("link").first().click()
  await expect(page).toHaveURL(/\/apps\/checklist\/liste\/[^?]+$/)
  const engagementUrl = page.url()
  const reponseTriangle = page.waitForResponse(REPONSE_ACTION)
  await page.locator("li").filter({ hasText: "Triangle de présentation" }).getByRole("button", { name: "Faire", exact: true }).click()
  await reponseTriangle
  await page.locator("li").filter({ hasText: "Triangle de présentation" }).getByRole("link", { name: "Détail", exact: true }).click()
  await expect(page).toHaveURL(/\?point=/)
  const ficheBasUrl = page.url()

  // Chaque écran se rejoint par son URL, en thème et en taille donnés.
  for (const theme of ["sombre", "clair"] as const) {
    await choisirTheme(page, theme)

    for (const taille of [BUREAU, TELEPHONE]) {
      await page.setViewportSize({ width: taille.width, height: taille.height })

      await page.goto("/apps/checklist")
      await expect(page.getByRole("region", { name: "Avancement" })).toBeVisible()
      await capturer(page, `checklist-preparation-${taille.largeur}-${theme}.png`)

      await page.goto(listeUrl)
      await expect(page.getByRole("heading", { name: "Contrôles", exact: true })).toBeVisible()
      await capturer(page, `checklist-liste-${taille.largeur}-${theme}.png`)

      await page.goto(ficheUrl)
      await expect(page.getByRole("dialog").getByRole("button", { name: "Problème", exact: true })).toBeVisible()
      await capturer(page, `checklist-fiche-point-${taille.largeur}-${theme}.png`)

      // Fiche défilée jusqu'à l'historique et aux boutons du bas : le tiroir défile, la capture montre le bas.
      await page.goto(ficheBasUrl)
      await page.getByRole("dialog").first().getByRole("button", { name: "Retirer le point", exact: true }).scrollIntoViewIfNeeded()
      await expect(page.getByRole("region", { name: "Historique des coches" })).toBeVisible()
      await capturer(page, `checklist-fiche-point-bas-${taille.largeur}-${theme}.png`)

      await page.goto(avertissementUrl)
      await expect(page.getByRole("alert", { name: "Avertissement avant phase" })).toBeVisible()
      await capturer(page, `checklist-avertissement-${taille.largeur}-${theme}.png`)

      // Mode terrain : le réglage est celui du membre, rétabli après la capture.
      await page.goto(listeUrl)
      // Le bouton de la liste est dans le contenu (main) : la barre haute a un bouton du même nom.
      const reponseTerrain = page.waitForResponse(REPONSE_ACTION)
      await page.getByRole("main").getByRole("button", { name: "Mode terrain", exact: true }).click()
      await reponseTerrain
      await expect(page.getByRole("main").getByRole("button", { name: "Quitter le mode terrain", exact: true })).toBeVisible()
      await capturer(page, `checklist-mode-terrain-${taille.largeur}-${theme}.png`)
      const reponseRetour = page.waitForResponse(REPONSE_ACTION)
      await page.getByRole("main").getByRole("button", { name: "Quitter le mode terrain", exact: true }).click()
      await reponseRetour
    }
  }

  // Débrief : l'épreuve est passée (Saison la passe à « terminée » au chargement), ses problèmes sont là.
  await passerEpreuveDansLePasseEnBase(equipe, eventId, "2020-06-01", "2020-06-02")
  // Un point ajouté par clic maintenant, l'épreuve étant commencée : le débrief le marque et propose « Ajouter au modèle ».
  await page.goto(engagementUrl)
  await page.getByRole("button", { name: "+ Ajouter un point", exact: true }).click()
  const ajoutEpreuve = page.getByRole("dialog")
  await ajoutEpreuve.getByLabel("Libellé du point", { exact: true }).fill("Point ajouté en épreuve")
  await envoyer(page, ajoutEpreuve.getByRole("button", { name: "Ajouter le point", exact: true }))
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

  // Vide : la team n'a encore aucun modèle, dans les quatre combinaisons (taille, thème).
  for (const theme of ["sombre", "clair"] as const) {
    await choisirTheme(page, theme)
    for (const taille of [BUREAU, TELEPHONE]) {
      await page.setViewportSize({ width: taille.width, height: taille.height })
      await page.goto("/apps/checklist/modeles")
      await expect(page.getByText("Aucun modèle de la team pour l'instant.", { exact: true })).toBeVisible()
      await capturer(page, `checklist-modeles-vide-${taille.largeur}-${theme}.png`)
    }
  }

  // Rempli : un modèle créé par l'interface, puis les quatre combinaisons.
  await page.goto("/apps/checklist/modeles")
  await page.getByRole("button", { name: "+ Nouveau modèle", exact: true }).click()
  const nouveau = page.getByRole("dialog")
  await nouveau.getByLabel("Nom", { exact: true }).fill("Contrôle avant départ")
  await envoyer(page, nouveau.getByRole("button", { name: "Créer le modèle", exact: true }))

  for (const theme of ["sombre", "clair"] as const) {
    await choisirTheme(page, theme)
    for (const taille of [BUREAU, TELEPHONE]) {
      await page.setViewportSize({ width: taille.width, height: taille.height })
      await page.goto("/apps/checklist/modeles")
      await expect(page.getByText("Contrôle avant départ", { exact: true })).toBeVisible()
      await capturer(page, `checklist-modeles-rempli-${taille.largeur}-${theme}.png`)
    }
  }
})
