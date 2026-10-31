// Captures de Documents pour le point d'arrêt de la tâche 5.4 : les échéances (« Bientôt »), la liste « Tous les fichiers », les
// partages, le lien affiché une seule fois dans son tiroir, la page publique valide et la page publique invalide. Les écrans
// connectés sont capturés à 1440 et à 360 px, en thème sombre et en thème clair. Les pages publiques, hors session, n'ont pas
// de réglage de thème : le visiteur voit le thème sombre (app/layout.tsx), elles sont donc capturées en sombre seulement.
// Les captures partent dans docs/captures/ (documents-echeances-*, documents-fichiers-*, documents-partages-*,
// documents-lien-*, documents-public-*) ; elles sont téléchargées du run, relues une à une, puis commitées à la main.
// Chaque lien créé pour une capture a son propre destinataire, pour que la liste des partages reste lisible.
import path from "node:path"

import { justificatifBudgetEnBase } from "./aide/documents"
import { capturer, choisirTheme } from "./aide/equipe"
import { envoyer } from "./aide/envoi"
import { expect, test } from "./aide/fixtures"
import { jourParis } from "./aide/dates"
import { connecterParLien, tuilesDuQg } from "./aide/navigation"
import { ajouterPapierEnBase, ajouterVoitureSaxo } from "./aide/session"

const BUREAU = { largeur: "1440", width: 1440, height: 900 }
const TELEPHONE = { largeur: "360", width: 360, height: 740 }
// Une photo : son aperçu s'affiche sur la fiche, et le lien public propose « Ouvrir le fichier ».
const PHOTO = path.join(__dirname, "fichiers", "photo.jpg")
const TITRE_ATTESTATION = "Attestation de domiciliation"
const LIBELLE_JUSTIFICATIF = "justificatif-peage-captures.pdf"
const DESTINATAIRES = ["Préfecture du Bas-Rhin", "ASA Alsace", "Mairie de Strasbourg", "Assurance Alsace"]

test("captures · échéances, fichiers, partages, lien, pages publiques, 1440 et 360 px, sombre et clair", async ({ page, equipe, browser }) => {
  test.setTimeout(900_000)
  // Données créées par l'interface quand c'est un geste de l'utilisateur, en base pour le reste : une assurance et un papier
  // de la Saxo qui expirent dans vingt jours (« Bientôt »), une attestation avec sa photo, un justificatif de Budget.
  await justificatifBudgetEnBase(equipe, "Péage captures", LIBELLE_JUSTIFICATIF)
  const vehicule = await ajouterVoitureSaxo(equipe, "Saxo captures")
  await ajouterPapierEnBase(equipe, vehicule, "carte_grise", jourParis(20))

  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: BUREAU.width, height: BUREAU.height })
  await tuilesDuQg(page)
    .filter({ has: page.getByRole("heading", { name: "Documents", exact: true }) })
    .click()
  await expect(page.getByRole("heading", { name: "Coffre-fort", exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Document", exact: true }).click()
  const assurance = page.getByRole("dialog")
  await assurance.getByLabel("Titre", { exact: true }).fill("Assurance de l'association")
  await assurance.getByLabel("Type de document", { exact: true }).selectOption("assurance_asso")
  await assurance.getByLabel("Dossier", { exact: true }).selectOption({ label: "Assurances" })
  await assurance.getByLabel("Date de validité", { exact: true }).fill(jourParis(20))
  await envoyer(page, assurance.getByRole("button", { name: "Ajouter le document", exact: true }))

  await page.getByRole("button", { name: "Document", exact: true }).click()
  const attestation = page.getByRole("dialog")
  await attestation.getByLabel("Titre", { exact: true }).fill(TITRE_ATTESTATION)
  await attestation.getByLabel("Type de document", { exact: true }).selectOption("attestation")
  await attestation.getByLabel("Dossier", { exact: true }).selectOption({ label: "Attestations" })
  await attestation.locator('input[type="file"]').setInputFiles(PHOTO)
  await expect(attestation.getByRole("button", { name: "Remplacer", exact: true })).toBeVisible()
  await envoyer(page, attestation.getByRole("button", { name: "Ajouter le document", exact: true }))

  await page.getByRole("link", { name: /retour au qg/i }).first().click()
  await expect(page).toHaveURL(/\/qg$/)

  let rang = 0
  for (const theme of ["sombre", "clair"] as const) {
    await choisirTheme(page, theme)
    await page.getByRole("link", { name: /retour au qg/i }).first().click()
    await expect(page).toHaveURL(/\/qg$/)

    for (const taille of [BUREAU, TELEPHONE]) {
      const suffixe = `${taille.largeur}-${theme}`
      await page.setViewportSize({ width: taille.width, height: taille.height })
      await tuilesDuQg(page)
        .filter({ has: page.getByRole("heading", { name: "Documents", exact: true }) })
        .click()
      await expect(page.getByRole("heading", { name: "Coffre-fort", exact: true })).toBeVisible()

      // Création du lien depuis la fiche : le tiroir affiche le lien une seule fois, puis on le capture.
      await page.getByRole("link", { name: /Attestations/ }).click()
      await page.getByRole("link", { name: TITRE_ATTESTATION, exact: true }).click()
      await expect(page.getByRole("heading", { name: TITRE_ATTESTATION, exact: true })).toBeVisible()
      await page.getByRole("button", { name: "Partager par lien", exact: true }).click()
      const tiroir = page.getByRole("dialog")
      await tiroir.getByLabel("Destinataire", { exact: true }).fill(DESTINATAIRES[rang])
      const reponseLien = page.waitForResponse((r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined)
      await tiroir.getByRole("button", { name: "Créer le lien", exact: true }).click()
      await reponseLien
      await expect(tiroir.getByText("Copie le lien maintenant : il ne sera plus affiché.")).toBeVisible()
      const texte = (await tiroir.locator("p.break-all").innerText()).trim()
      const jeton = /\/d\/([A-Za-z0-9_-]{43})$/.exec(texte)?.[1] ?? ""
      expect(jeton).not.toBe("")
      await capturer(page, `documents-lien-${suffixe}.png`)
      await page.keyboard.press("Escape")
      await expect(page.getByRole("dialog")).toHaveCount(0)

      // Échéances, fichiers, partages : chacun attend son titre (ou sa ligne) avant la capture.
      await page.getByRole("link", { name: "Échéances", exact: true }).click()
      await expect(page.getByRole("heading", { name: /^Bientôt/ })).toBeVisible()
      await capturer(page, `documents-echeances-${suffixe}.png`)

      await page.getByRole("link", { name: "Tous les fichiers", exact: true }).click()
      await expect(page.getByRole("link", { name: LIBELLE_JUSTIFICATIF, exact: true })).toBeVisible()
      await capturer(page, `documents-fichiers-${suffixe}.png`)

      await page.getByRole("link", { name: "Partages", exact: true }).click()
      await expect(page.getByRole("heading", { name: "Partages", exact: true, level: 1 })).toBeVisible()
      await expect(page.getByRole("list", { name: "Liens actifs" })).toBeVisible()
      await capturer(page, `documents-partages-${suffixe}.png`)

      // Pages publiques, sans session : valide (fichier proposé), puis jeton inventé (même page que révoqué ou expiré).
      // Hors session, le thème est le sombre : on ne les capture qu'une fois par taille, dans la boucle sombre.
      if (theme === "sombre") {
        const anonyme = await browser.newContext({ viewport: { width: taille.width, height: taille.height } })
        try {
          const visiteur = await anonyme.newPage()
          await visiteur.goto(`/d/${jeton}`)
          await expect(visiteur.getByRole("heading", { name: TITRE_ATTESTATION, exact: true })).toBeVisible()
          await expect(visiteur.getByRole("link", { name: "Ouvrir le fichier", exact: true })).toBeVisible()
          await capturer(visiteur, `documents-public-valide-${taille.largeur}-sombre.png`)

          await visiteur.goto(`/d/${"A".repeat(43)}`)
          await expect(visiteur.getByRole("heading", { name: "Lien non valide", exact: true })).toBeVisible()
          await capturer(visiteur, `documents-public-invalide-${taille.largeur}-sombre.png`)
        } finally {
          await anonyme.close()
        }
      }

      // Retour au QG : chaque taille repart de la tuile Documents du QG.
      await page.getByRole("link", { name: /retour au qg/i }).first().click()
      await expect(page).toHaveURL(/\/qg$/)
      rang += 1
    }
  }
})
