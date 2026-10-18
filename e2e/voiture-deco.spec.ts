// Voiture, onglet Déco : le plan, la liste, le panneau, le déplacement et l'ajout (brief 3.4, section 5). Le
// scénario du responsable tient en une suite, parce que chaque étape part de la précédente. Les captures partent dans
// docs/captures/ : à 1440 px, à 360 px, et en thème clair à 1440 px.
import path from "node:path"

import type { Page } from "@playwright/test"

import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { ajouterMembreConnectable, compterEvenements, donnerAccesVoiture } from "./aide/session"

const DOSSIER = path.join(__dirname, "..", "docs", "captures")
const LOGO = path.join(__dirname, "fichiers", "logo.png")
const BUREAU = { width: 1440, height: 900 }
const TELEPHONE = { width: 360, height: 740 }

// Aucun défilement horizontal sur la page, à la largeur courante.
async function sansDefilementHorizontal(page: Page): Promise<void> {
  const deborde = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(deborde, "défilement horizontal sur la page").toBe(false)
}

// Capture de l'écran visible (fullPage: false), pour le tiroir : son en-tête doit y être, pas seulement le contenu.
async function capturerEcran(page: Page, nom: string): Promise<void> {
  await page.screenshot({ path: path.join(DOSSIER, nom), fullPage: false })
}

// Capture pleine page : éléments fixes masqués, comme dans voiture.spec.ts, sauf le tiroir (role dialog), qui est
// le sujet de la capture et que le test retrouve ensuite.
async function capturer(page: Page, nom: string): Promise<void> {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" })
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>("body *").forEach((element) => {
      if (element.closest('[role="dialog"]')) return
      if (getComputedStyle(element).position === "fixed") element.style.display = "none"
    })
  })
  await page.screenshot({ path: path.join(DOSSIER, nom), fullPage: true })
}

// « Saxo 2 » créée par le bouton + (entrée Véhicule), gabarit Saxo : ses emplacements viennent du gabarit.
async function creerSaxoDeux(page: Page): Promise<string> {
  await page.goto("/apps/voiture")
  await page.getByRole("button", { name: "Ajouter", exact: true }).click()
  await page.getByRole("menuitem", { name: /Véhicule/ }).click()
  await page.waitForURL(/\/apps\/voiture\/nouveau$/)
  await page.locator('input[name="nom"]').fill("Saxo 2")
  await page.locator('select[name="gabaritCle"]').selectOption("citadine_3p_saxo")
  await page.getByRole("button", { name: "Ajouter le véhicule" }).click()
  await page.waitForURL(/\/apps\/voiture\/vehicules\/[0-9a-f-]{36}/)
  return new URL(page.url()).pathname.split("/")[4]
}

async function ouvrirDeco(page: Page, vehiculeId: string): Promise<void> {
  await page.goto(`/apps/voiture/vehicules/${vehiculeId}?onglet=deco`)
  await expect(page.getByRole("group", { name: /^Plan de Saxo 2/ })).toBeVisible()
}

// Le plan, la liste de la vue (les emplacements dessinés), la liste « Autres emplacements ».
const plan = (page: Page) => page.getByRole("group", { name: /^Plan de Saxo 2/ })
const listePlan = (page: Page) => page.locator('section[aria-labelledby="liste-emplacements"] > ul')
const listeHorsPlan = (page: Page) => page.locator('section[aria-labelledby="autres-emplacements"] ul')
const ligne = (page: Page, nom: string) => listePlan(page).locator("button", { hasText: nom })
const ligneHorsPlan = (page: Page, nom: string) => listeHorsPlan(page).locator("button", { hasText: nom })
// Une forme du plan, par son nom accessible (« Aile arrière, Libre »).
const forme = (page: Page, nom: string) => page.locator(`svg rect[aria-label^="${nom}"], svg polygon[aria-label^="${nom}"]`).first()
const formesDuPlan = (page: Page) => page.locator('svg [role="button"]')

// Le fichier se choisit dans le champ caché de la page (setInputFiles marche même caché).
async function joindreFichier(page: Page, chemin: string): Promise<void> {
  await page.locator('input[type="file"]').setInputFiles(chemin)
  await expect(page.getByRole("button", { name: /^Retirer (le logo|la photo)$/ })).toBeVisible({ timeout: 30_000 })
}

async function passerEnThemeClair(page: Page): Promise<void> {
  await page.goto("/apps/settings/affichage")
  const formulaire = page.locator("form", { has: page.locator("#theme") })
  await formulaire.locator("#theme").selectOption("clair")
  await formulaire.getByRole("button", { name: "Enregistrer" }).click()
  await page.waitForURL(/ok=1$/)
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/)
}

test("responsable : plan, réservation, pose, indisponibilité, déplacement, ajout et suppression", async ({ page, equipe }) => {
  test.setTimeout(480_000)
  await connecterParLien(page, equipe)
  await page.setViewportSize(BUREAU)
  const vehiculeId = await creerSaxoDeux(page)
  await page.getByRole("link", { name: "Déco" }).click()

  // 1. Plan : six formes à droite, cinq à gauche (le bandeau de pare-brise n'est pas symétrique), dix dans la liste.
  await expect(plan(page)).toBeVisible()
  await expect(formesDuPlan(page)).toHaveCount(6)
  await expect(listePlan(page).locator("li")).toHaveCount(6)
  await expect(page.getByRole("heading", { name: "Autres emplacements" })).toBeVisible()
  await expect(listeHorsPlan(page).locator("li")).toHaveCount(4)
  await page.getByRole("button", { name: "Côté gauche" }).click()
  await expect(page).toHaveURL(/vue=gauche/)
  await expect(formesDuPlan(page)).toHaveCount(5)
  await expect(page.getByRole("group", { name: /côté gauche/ })).toBeVisible()
  await page.getByRole("button", { name: "Côté droit" }).click()
  await expect(page).toHaveURL(/vue=droite/)
  await expect(page.getByText("6 libres · 0 réservés · 0 occupés · 0 indisponibles")).toBeVisible()

  // 2. Réserver : « Portière », puis « Réserver », avec un nom et un logo PNG.
  await ligne(page, "Portière").click()
  await page.getByRole("button", { name: "Réserver", exact: true }).click()
  await page.getByLabel("Partenaire", { exact: true }).fill("Garage Muller")
  await joindreFichier(page, LOGO)
  await page.getByRole("button", { name: "Réserver l'emplacement" }).click()
  await expect(ligne(page, "Portière").getByText("Réservé · Garage Muller")).toBeVisible()
  await expect(page.getByText("1 réservé")).toBeVisible()
  await expect(forme(page, "Portière")).toHaveAttribute("aria-pressed", "true")
  expect(await page.locator("svg image").first().getAttribute("href")).toMatch(/^\/api\/fichiers\//)

  // 3. Poser : « Marquer le logo posé », avec une photo. Voiture n'écoute encore personne : seul l'événement existe.
  await page.getByRole("button", { name: "Marquer le logo posé" }).click()
  await joindreFichier(page, LOGO)
  await page.getByRole("button", { name: "Enregistrer la pose" }).click()
  await expect(ligne(page, "Portière").getByText("Occupé · Garage Muller")).toBeVisible()
  await expect(page.getByText("1 occupé")).toBeVisible()
  await expect.poll(() => compterEvenements(equipe, "voiture.logo_pose"), { timeout: 30_000 }).toBeGreaterThanOrEqual(1)
  await capturer(page, "voiture-deco-pose-1440.png")

  // 4. Indisponible : « Toit » (hors plan) devient indisponible, puis revient.
  await ligneHorsPlan(page, "Toit").click()
  await page.getByRole("button", { name: "Rendre indisponible" }).click()
  await expect(ligneHorsPlan(page, "Toit").getByText("Indisponible")).toBeVisible()
  await page.getByRole("button", { name: "Rendre disponible" }).click()
  await expect(ligneHorsPlan(page, "Toit").getByText("Libre")).toBeVisible()

  // 5. Déplacer au clavier : « Aile arrière », X de +10 dans le champ, puis enregistrer. Après rechargement, la forme a
  // la nouvelle position à droite, et à gauche (miroir : 370 − x − largeur).
  await ligne(page, "Aile arrière").click()
  const xAvant = Number(await forme(page, "Aile arrière").getAttribute("x"))
  await page.getByRole("button", { name: "Déplacer ou redimensionner" }).click()
  await page.getByLabel("X", { exact: true }).fill(String(Math.round((xAvant + 10) * 10) / 10))
  await page.getByRole("button", { name: "Enregistrer la position" }).click()
  await expect(page.getByRole("button", { name: "Déplacer ou redimensionner" })).toBeVisible()
  await page.reload()
  await expect.poll(async () => Number(await forme(page, "Aile arrière").getAttribute("x"))).toBeCloseTo(xAvant + 10, 1)
  await page.getByRole("button", { name: "Côté gauche" }).click()
  await expect.poll(async () => Number(await forme(page, "Aile arrière").getAttribute("x"))).toBeCloseTo(370 - (xAvant + 10) - 23, 1)
  await page.getByRole("button", { name: "Côté droit" }).click()

  // 6. Déplacer au pointeur : « Aile avant » glissée de 20 px. Capture du mode déplacement avant d'enregistrer.
  await ligne(page, "Aile avant").click()
  const xAvantPointeur = Number(await forme(page, "Aile avant").getAttribute("x"))
  await page.getByRole("button", { name: "Déplacer ou redimensionner" }).click()
  const boite = await forme(page, "Aile avant").boundingBox()
  if (!boite) throw new Error("Aile avant : pas de boîte à l'écran")
  const centre = { x: boite.x + boite.width / 2, y: boite.y + boite.height / 2 }
  await page.mouse.move(centre.x, centre.y)
  await page.mouse.down()
  await page.mouse.move(centre.x + 20, centre.y, { steps: 8 })
  await page.mouse.up()
  await capturer(page, "voiture-deco-deplacement-1440.png")
  await page.getByRole("button", { name: "Enregistrer la position" }).click()
  await expect(page.getByRole("button", { name: "Déplacer ou redimensionner" })).toBeVisible()
  await expect.poll(async () => Number(await forme(page, "Aile avant").getAttribute("x"))).toBeGreaterThan(xAvantPointeur + 3)

  // 7. Ajouter, renommer, supprimer : « Nouvel emplacement », « Lunette latérale », puis la suppression sur la page.
  await page.getByRole("button", { name: "Ajouter un emplacement" }).click()
  await expect(page.getByRole("heading", { name: "Nouvel emplacement" })).toBeVisible()
  await page.getByText("Modifier l'emplacement").click()
  await page.getByLabel("Nom", { exact: true }).fill("Lunette latérale")
  await page.getByRole("button", { name: "Enregistrer les modifications" }).click()
  await expect(page.getByRole("heading", { name: "Lunette latérale" })).toBeVisible()
  await page.getByRole("button", { name: "Supprimer l'emplacement" }).click()
  await page
    .getByRole("group", { name: /Supprimer l'emplacement « Lunette latérale »/ })
    .getByRole("button", { name: "Supprimer l'emplacement" })
    .click()
  await expect(listePlan(page).getByText("Lunette latérale")).toHaveCount(0)

  // Thème clair, 1440 px : le plan et le panneau de la réservation avec sa pose.
  await passerEnThemeClair(page)
  await ouvrirDeco(page, vehiculeId)
  // Audit (brief 3.6, point 0.2) : le plan est un groupe, et ses formes sont des boutons trouvés par leur nom.
  await expect(plan(page).getByRole("button", { name: /Portière/ })).toBeVisible()
  await ligne(page, "Portière").click()
  await capturer(page, "voiture-deco-clair-1440.png")
})

test("responsable, téléphone 360 px : la liste ouvre le tiroir, sans défilement horizontal, lignes de 44 px", async ({ page, equipe }) => {
  test.setTimeout(360_000)
  await connecterParLien(page, equipe)
  await page.setViewportSize(BUREAU)
  const vehiculeId = await creerSaxoDeux(page)
  await page.setViewportSize(TELEPHONE)
  await ouvrirDeco(page, vehiculeId)
  await sansDefilementHorizontal(page)

  // Chaque ligne de la liste mesure au moins 44 px de haut.
  const lignes = listePlan(page).locator("button")
  await expect(lignes).toHaveCount(6)
  for (let i = 0; i < 6; i++) {
    const boiteLigne = await lignes.nth(i).boundingBox()
    expect(boiteLigne?.height ?? 0).toBeGreaterThanOrEqual(44)
  }

  // Choisir dans la liste ouvre le tiroir par le bas, avec un titre et une fermeture.
  await ligne(page, "Portière").click()
  const tiroir = page.getByRole("dialog")
  await expect(tiroir).toBeVisible()
  await tiroir.getByRole("button", { name: "Réserver", exact: true }).click()
  await tiroir.getByLabel("Partenaire", { exact: true }).fill("Garage Muller")
  await joindreFichier(page, LOGO)
  await tiroir.getByRole("button", { name: "Réserver l'emplacement" }).click()
  // Dans le tiroir, le statut et le partenaire sont deux champs de la fiche (la liste, elle, les écrit ensemble).
  await expect(tiroir.getByText("Réservé", { exact: true })).toBeVisible()
  await expect(tiroir.getByText("Garage Muller", { exact: true })).toBeVisible()
  await expect(page.getByText("1 réservé")).toBeVisible()
  await capturerEcran(page, "voiture-deco-tiroir-360.png")
  await page.keyboard.press("Escape")
  await expect(tiroir).toHaveCount(0)
  await sansDefilementHorizontal(page)
  await capturer(page, "voiture-deco-pose-360.png")

  // Le déplacement se fait aussi dans le tiroir.
  await ligne(page, "Aile arrière").click()
  await tiroir.getByRole("button", { name: "Déplacer ou redimensionner" }).click()
  await expect(tiroir.getByLabel("X", { exact: true })).toBeVisible()
  await capturer(page, "voiture-deco-deplacement-360.png")
  await tiroir.getByRole("button", { name: "Annuler" }).click()
  await sansDefilementHorizontal(page)
})

test("assistance : le plan et le panneau en lecture seule, sans aucun bouton d'action", async ({ page, equipe, context }) => {
  test.setTimeout(300_000)
  await connecterParLien(page, equipe)
  await page.setViewportSize(BUREAU)
  const vehiculeId = await creerSaxoDeux(page)

  const assistance = await ajouterMembreConnectable(equipe, "assistance")
  await donnerAccesVoiture(equipe, assistance, "lecture")
  await context.clearCookies()
  await connecterParLien(page, { ...equipe, secretLien: assistance.secretLien })
  await page.setViewportSize(BUREAU)

  await ouvrirDeco(page, vehiculeId)
  await expect(formesDuPlan(page)).toHaveCount(6)
  await expect(listePlan(page).locator("li")).toHaveCount(6)
  await ligne(page, "Portière").click()
  await expect(page.getByRole("heading", { name: "Portière" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Réserver", exact: true })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Rendre indisponible" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Déplacer ou redimensionner" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Ajouter un emplacement" })).toHaveCount(0)
  await expect(page.getByText("Modifier l'emplacement")).toHaveCount(0)
})
