// Notes et photos sur la fiche d'un ordre de travail (brief 5.0, §4), en ligne. Par clics : le responsable crée un ordre,
// écrit une note, la modifie, ajoute une photo ; l'assistance non affectée voit la note, sans pouvoir en ajouter, et le
// dit. Le cas hors ligne est dans notes-fiche-hors-ligne.spec.ts.
import path from "node:path"

import type { Page } from "@playwright/test"

import { expect, test } from "./aide/fixtures"
import { envoyer } from "./aide/envoi"
import { preparerAtelierSaxo } from "./aide/garage"
import { connecterParLien } from "./aide/navigation"
import { ajouterMembreConnectable, ajouterVoitureSaxo } from "./aide/session"

const PHOTO = path.resolve("e2e/fichiers/photo.jpg")
const DOSSIER = path.join(__dirname, "..", "docs", "captures")

// Capture de la fiche à 1440 px, puis à 360 px sans défilement horizontal (même règle que le parcours du Garage).
async function capturerFiche(page: Page, nom: string): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.screenshot({ path: path.join(DOSSIER, `${nom}-1440.png`), fullPage: true, animations: "disabled" })
  await page.setViewportSize({ width: 360, height: 740 })
  const deborde = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(deborde, `défilement horizontal à 360 px (${nom})`).toBe(false)
  await page.screenshot({ path: path.join(DOSSIER, `${nom}-360.png`), fullPage: true, animations: "disabled" })
  await page.setViewportSize({ width: 1440, height: 900 })
}
const TITRE_ORDRE = "Vidange notes fiche"

test("notes et photos d'un ordre : écrire, modifier, photo ; l'assistance affectée ajoute, la non affectée est refusée", async ({ page, equipe, browser }) => {
  test.setTimeout(240_000)
  const vehicleId = await ajouterVoitureSaxo(equipe, "Saxo notes fiche")
  const organes = await preparerAtelierSaxo(equipe, vehicleId)

  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto(`/apps/garage/travaux?vehicule=${vehicleId}`)

  await page.getByRole("button", { name: "Nouvel ordre", exact: true }).click()
  const tiroir = page.getByRole("dialog")
  await expect(tiroir).toBeVisible()
  await tiroir.getByLabel("Titre", { exact: true }).fill(TITRE_ORDRE)
  await tiroir.locator('select[name="vehicleComponentId"]').selectOption(organes.freins)
  await envoyer(page, tiroir.getByRole("button", { name: "Créer l'ordre", exact: true }))
  await expect(page.getByRole("link", { name: new RegExp(TITRE_ORDRE) }).first()).toBeVisible()

  await page.getByRole("link", { name: new RegExp(TITRE_ORDRE) }).first().click()
  await expect(page).toHaveURL(/\/apps\/garage\/travaux\/[0-9a-f-]+$/)
  const idOrdre = page.url().split("/").pop() ?? ""
  // Le bloc « Notes et photos » : les boutons homonymes de la fiche (« Modifier », « Retirer ») restent hors de sa portée.
  const bloc = page.getByRole("region", { name: "Notes et photos" })
  await expect(bloc).toBeVisible()

  // Une note : écrite dans le tiroir, visible, puis modifiée. Ces écritures passent par la base locale.
  await bloc.getByRole("button", { name: "Ajouter une note", exact: true }).click()
  await page.getByLabel("Ce qu'il faut retenir").fill("Filtre à changer")
  await page.getByRole("button", { name: "Enregistrer la note", exact: true }).click()
  await expect(page.getByText("Filtre à changer", { exact: true })).toBeVisible({ timeout: 30_000 })

  await bloc.getByRole("button", { name: "Modifier", exact: true }).first().click()
  // Le tiroir s'appelle aussi « Modifier la note » : le champ est le seul « textbox » de ce nom.
  await page.getByRole("textbox", { name: "Modifier la note", exact: true }).fill("Filtre à changer, et vérifier le joint")
  await page.getByRole("dialog").getByRole("button", { name: "Enregistrer", exact: true }).click()
  await expect(page.getByText("Filtre à changer, et vérifier le joint", { exact: true })).toBeVisible({ timeout: 30_000 })

  // Une photo : part par le réseau, puis apparaît en vignette.
  await bloc.getByRole("button", { name: "Ajouter une photo", exact: true }).click()
  const tiroirPhoto = page.getByRole("dialog")
  await tiroirPhoto.locator('input[name="fichier"]').setInputFiles(PHOTO)
  await envoyer(page, tiroirPhoto.getByRole("button", { name: "Envoyer la photo", exact: true }))
  await expect(page.getByRole("img", { name: "photo.jpg" })).toBeVisible({ timeout: 30_000 })
  await capturerFiche(page, "notes-fiche-ordre")

  // L'assistance non affectée à l'ordre ne l'ouvre pas : la fiche lui est introuvable (lireOrdre), donc ni notes ni bouton
  // d'ajout. Le refus reste en garde côté serveur (contribuer). L'assistance affectée, qui ajoute une note, est couverte en
  // base par db:verifier-synchro, section 13 : ce parcours ne l'affecte pas.
  const assistance = await ajouterMembreConnectable(equipe, "assistance", " notes fiche")
  const contexte = await browser.newContext()
  const assist = await contexte.newPage()
  try {
    await assist.goto(`/connexion/lien?t=${assistance.secretLien}`)
    await assist.waitForURL(/\/qg$/)
    await assist.goto(`/apps/garage/travaux/${idOrdre}`)
    await assist.waitForLoadState("networkidle")
    await expect(assist.getByRole("region", { name: "Notes et photos" })).toHaveCount(0)
    await expect(assist.getByText("Filtre à changer, et vérifier le joint", { exact: true })).toHaveCount(0)
  } finally {
    await contexte.close()
  }
})
