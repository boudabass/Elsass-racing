// Voiture, onglet Déco : le plan, la liste, le panneau, le déplacement et l'ajout (brief 3.4, section 5). Le
// scénario du responsable tient en une suite, parce que chaque étape part de la précédente. Les captures partent dans
// docs/captures/ : à 1440 px, à 360 px, et en thème clair à 1440 px.
import path from "node:path"

import type { CDPSession, Page } from "@playwright/test"

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

// Capture pleine page : éléments fixes masqués, comme dans voiture.spec.ts, sauf le tiroir (role dialog) et la barre
// « Déplacer ou redimensionner » du téléphone, qui sont le sujet de la capture.
async function capturer(page: Page, nom: string): Promise<void> {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" })
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>("body *").forEach((element) => {
      if (element.closest('[role="dialog"], [data-barre-position]')) return
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

// Le plan et la liste de la vue (les emplacements dessinés). Après le chargement de la page, le streaming React
// (frontière Suspense du plan, « S:0 ») peut laisser une copie cachée de la liste dans le DOM : un sélecteur CSS nu la
// compte (strict mode). `:visible` l'écarte sans passer par l'arbre d'accessibilité : un sélecteur par rôle perd la
// liste pendant qu'un tiroir modal est ouvert (la page reçoit aria-hidden), ce qui casse les vérifications après une étape.
const plan = (page: Page) => page.getByRole("group", { name: /^Plan de Saxo 2/ })
const listePlan = (page: Page) => page.locator('section[aria-labelledby="liste-emplacements"]')
const ligne = (page: Page, nom: string) => listePlan(page).locator("button:visible", { hasText: nom })
// Le sélecteur de vues : « Côté droit », « Côté gauche », « Avant », « Arrière », « Dessus ».
const boutonVue = (page: Page, titre: string) =>
  page.getByRole("group", { name: "Vue du véhicule" }).getByRole("button", { name: titre, exact: true })
// Une forme du plan, par son nom accessible (« Aile arrière droite, Libre »).
const forme = (page: Page, nom: string) => page.locator(`svg rect[aria-label^="${nom}"], svg polygon[aria-label^="${nom}"]`).first()
const formesDuPlan = (page: Page) => page.locator('svg [role="button"]')

// Sur ordinateur, la fiche et les étapes sont modales : la page est inerte tant que le tiroir est ouvert. Échap ramène
// d'une étape à la fiche, et ferme la fiche.
async function fermerTiroir(page: Page): Promise<void> {
  for (let i = 0; i < 3 && (await page.getByRole("dialog").count()) > 0; i++) {
    await page.keyboard.press("Escape")
  }
  await expect(page.getByRole("dialog")).toHaveCount(0)
}

// Le fichier se choisit dans le champ caché de la page (setInputFiles marche même caché).
async function joindreFichier(page: Page, chemin: string): Promise<void> {
  await page.locator('input[type="file"]').setInputFiles(chemin)
  await expect(page.getByRole("button", { name: /^Retirer (le logo|la photo)$/ })).toBeVisible({ timeout: 30_000 })
}

async function passerEnThemeClair(page: Page): Promise<void> {
  await page.goto("/apps/settings/affichage")
  await page.getByRole("button", { name: "Modifier l'affichage", exact: true }).click()
  const tiroir = page.getByRole("dialog")
  await tiroir.locator("#theme").selectOption("clair")
  await tiroir.getByRole("button", { name: "Enregistrer", exact: true }).click()
  await expect(tiroir).toHaveCount(0)
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/)
}

// Le plan se parcourt de bout en bout : vues, réservation, pose, déplacement au clavier et au pointeur, ajout, renommage.
test("responsable : plan, réservation, pose, indisponibilité, déplacement, ajout et suppression", async ({ page, equipe }) => {
  test.setTimeout(480_000)
  await connecterParLien(page, equipe)
  await page.setViewportSize(BUREAU)
  const vehiculeId = await creerSaxoDeux(page)
  await page.getByRole("link", { name: "Déco" }).click()

  // 1. Plan : six formes à droite, cinq à gauche (le bandeau de pare-brise n'est pas symétrique). Chaque vue a ses
  // propres emplacements : arrière 2 (la lunette arrière est une vitre, sans emplacement), avant 1, dessus 2. Il n'y a aucun emplacement hors plan.
  await expect(plan(page)).toBeVisible()
  await expect(formesDuPlan(page)).toHaveCount(6)
  await expect(listePlan(page).locator("li:visible")).toHaveCount(6)
  await boutonVue(page, "Côté gauche").click()
  await expect(page).toHaveURL(/vue=gauche/)
  await expect(formesDuPlan(page)).toHaveCount(5)
  await expect(page.getByRole("group", { name: /côté gauche/ })).toBeVisible()
  await boutonVue(page, "Arrière").click()
  await expect(page).toHaveURL(/vue=arriere/)
  await expect(formesDuPlan(page)).toHaveCount(2)
  await expect(listePlan(page).locator("li:visible")).toHaveCount(2)
  await boutonVue(page, "Avant").click()
  await expect(formesDuPlan(page)).toHaveCount(1)
  await boutonVue(page, "Dessus").click()
  await expect(formesDuPlan(page)).toHaveCount(2)
  await expect(page.getByRole("group", { name: /^Plan de Saxo 2, dessus/ })).toBeVisible()
  await boutonVue(page, "Côté droit").click()
  await expect(page).toHaveURL(/vue=droite/)
  await expect(page.getByText("6 libres · 0 réservés · 0 occupés · 0 indisponibles")).toBeVisible()

  // 2. Réserver : « Portière droite », puis « Réserver », avec un nom et un logo PNG.
  await ligne(page, "Portière").click()
  await page.getByRole("button", { name: "Réserver", exact: true }).click()
  await page.locator('select[name="partenaireId"]').selectOption("")
  await page.locator('input[name="partenaireNom"]').fill("Garage Muller")
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

  // 4. Indisponible : « Toit », dans la vue dessus, devient indisponible, puis revient.
  await fermerTiroir(page)
  await boutonVue(page, "Dessus").click()
  await ligne(page, "Toit").click()
  await page.getByRole("button", { name: "Rendre indisponible" }).click()
  await expect(ligne(page, "Toit").getByText("Indisponible")).toBeVisible()
  await page.getByRole("button", { name: "Rendre disponible" }).click()
  await expect(ligne(page, "Toit").getByText("Libre")).toBeVisible()
  await fermerTiroir(page)
  await boutonVue(page, "Côté droit").click()
  await expect(page).toHaveURL(/vue=droite/)

  // 5. Déplacer au clavier : « Aile arrière droite », de 10 unités vers la droite (Maj + flèche), puis enregistrer. Après
  // rechargement, la forme a la nouvelle position à droite. Le côté gauche est sa propre ligne : il ne bouge pas avec la droite.
  await boutonVue(page, "Côté gauche").click()
  await expect(page).toHaveURL(/vue=gauche/)
  const xGaucheAvant = Number(await forme(page, "Aile arrière").getAttribute("x"))
  await boutonVue(page, "Côté droit").click()
  await expect(page).toHaveURL(/vue=droite/)
  await fermerTiroir(page)
  await ligne(page, "Aile arrière").click()
  await expect(page.getByRole("dialog")).toBeVisible()
  const xAvant = Number(await forme(page, "Aile arrière").getAttribute("x"))
  await page.getByRole("button", { name: "Déplacer ou redimensionner" }).click()
  // Pendant « Déplacer », un autre emplacement ne se choisit pas : la liste est inerte, la fiche reste la même.
  await ligne(page, "Portière").click({ force: true })
  await expect(page.getByRole("dialog", { name: "Déplacer ou redimensionner", exact: true })).toContainText("Aile arrière")
  await forme(page, "Aile arrière").focus()
  await page.keyboard.press("Shift+ArrowRight")
  await expect.poll(async () => Number(await forme(page, "Aile arrière").getAttribute("x"))).toBeCloseTo(xAvant + 10, 1)
  await page.getByRole("button", { name: "Enregistrer la position" }).click()
  await expect(page.getByRole("button", { name: "Déplacer ou redimensionner" })).toBeVisible()
  await page.reload()
  await page.waitForLoadState("networkidle")
  await expect.poll(async () => Number(await forme(page, "Aile arrière").getAttribute("x"))).toBeCloseTo(xAvant + 10, 1)
  await boutonVue(page, "Côté gauche").click()
  await expect.poll(async () => Number(await forme(page, "Aile arrière").getAttribute("x"))).toBeCloseTo(xGaucheAvant, 1)
  await boutonVue(page, "Côté droit").click()
  // Attendre la vue droite avant de cliquer une ligne : un clic pendant le changement de vue choisit une forme de la vue
  // quittée, qui disparaît avec la vue (le tiroir se ferme).
  await expect(page).toHaveURL(/vue=droite/)

  // 6. Déplacer au pointeur : « Aile avant » glissée de 20 px. Capture du mode déplacement avant d'enregistrer.
  await fermerTiroir(page)
  await ligne(page, "Aile avant").click()
  await expect(page.getByRole("dialog")).toBeVisible()
  const xAvantPointeur = Number(await forme(page, "Aile avant").getAttribute("x"))
  await page.getByRole("button", { name: "Déplacer ou redimensionner" }).click()
  await forme(page, "Aile avant").scrollIntoViewIfNeeded()
  const boite = await forme(page, "Aile avant").boundingBox()
  if (!boite) throw new Error("Aile avant : pas de boîte à l'écran")
  const centre = { x: boite.x + boite.width / 2, y: boite.y + boite.height / 2 }
  await page.mouse.move(centre.x, centre.y)
  await page.mouse.down()
  await page.mouse.move(centre.x + 20, centre.y, { steps: 10 })
  await page.mouse.up()
  await capturer(page, "voiture-deco-deplacement-1440.png")
  await page.getByRole("button", { name: "Enregistrer la position" }).click()
  await expect(page.getByRole("button", { name: "Déplacer ou redimensionner" })).toBeVisible()
  await expect.poll(async () => Number(await forme(page, "Aile avant").getAttribute("x"))).toBeGreaterThan(xAvantPointeur + 3)

  // 7. Ajouter, renommer, supprimer : « Nouvel emplacement », « Lunette latérale », puis la suppression sur la page.
  await fermerTiroir(page)
  await page.getByRole("button", { name: "Ajouter un emplacement" }).click()
  await expect(page.getByRole("heading", { name: "Nouvel emplacement" })).toBeVisible()
  await page.getByRole("button", { name: "Renommer", exact: true }).click()
  await page.getByLabel("Nom", { exact: true }).fill("Lunette latérale")
  await page.getByRole("button", { name: "Enregistrer le nom" }).click()
  await expect(page.getByRole("heading", { name: "Lunette latérale" })).toBeVisible()
  await page.getByRole("button", { name: "Supprimer l'emplacement", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Supprimer l'emplacement", exact: true })).toContainText("Lunette latérale")
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer l'emplacement", exact: true }).click()
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
  const lignes = listePlan(page).locator("button:visible")
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
  await tiroir.locator('select[name="partenaireId"]').selectOption("")
  await tiroir.locator('input[name="partenaireNom"]').fill("Garage Muller")
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

  // Le déplacement ne passe plus par le tiroir : une barre compacte en bas, et le plan reste visible.
  await ligne(page, "Aile arrière").click()
  await tiroir.getByRole("button", { name: "Déplacer ou redimensionner" }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.getByText("Glisse la forme, ou son coin pour la redimensionner.")).toBeVisible()
  await capturer(page, "voiture-deco-deplacement-360.png")
  await page.getByRole("form", { name: "Déplacer ou redimensionner Aile arrière" }).getByRole("button", { name: "Annuler", exact: true }).click()
  await expect(page.getByRole("button", { name: "Enregistrer la position" })).toHaveCount(0)
  await sansDefilementHorizontal(page)
})

// La poignée du coin bas-droit de la forme en déplacement : sa zone de contact, 44 px au moins.
const poignee = (page: Page) => page.locator('svg g[style*="nwse-resize"] rect').first()

// Glisse une forme du plan de dx, dy pixels à l'écran, à la souris, depuis son centre.
async function glisserForme(page: Page, nom: string, dx: number, dy: number): Promise<void> {
  await forme(page, nom).scrollIntoViewIfNeeded()
  const boite = await forme(page, nom).boundingBox()
  if (!boite) throw new Error(`${nom} : pas de boîte à l'écran`)
  const depart = { x: boite.x + boite.width / 2, y: boite.y + boite.height / 2 }
  await page.mouse.move(depart.x, depart.y)
  await page.mouse.down()
  await page.mouse.move(depart.x + dx, depart.y + dy, { steps: 10 })
  await page.mouse.up()
}

// Tire la poignée du coin bas-droit d'une forme du plan de dx, dy pixels à l'écran, à la souris.
async function redimensionnerAvecPoignee(page: Page, nom: string, dx: number, dy: number): Promise<void> {
  await forme(page, nom).scrollIntoViewIfNeeded()
  const boite = await poignee(page).boundingBox()
  if (!boite) throw new Error(`${nom} : pas de poignée à l'écran`)
  const depart = { x: boite.x + boite.width / 2, y: boite.y + boite.height / 2 }
  await page.mouse.move(depart.x, depart.y)
  await page.mouse.down()
  await page.mouse.move(depart.x + dx, depart.y + dy, { steps: 10 })
  await page.mouse.up()
}

// Redimensionner à la poignée, puis glisser : la forme garde sa taille, et le glissement ne quitte pas le mode déplacement.
test("responsable : déplacer une forme après l'avoir redimensionnée garde la taille et la position", async ({ page, equipe }) => {
  test.setTimeout(240_000)
  await connecterParLien(page, equipe)
  await page.setViewportSize(BUREAU)
  const vehiculeId = await creerSaxoDeux(page)
  await ouvrirDeco(page, vehiculeId)

  await ligne(page, "Aile avant").click()
  const largeur = Number(await forme(page, "Aile avant").getAttribute("width"))
  await page.getByRole("button", { name: "Déplacer ou redimensionner" }).click()
  await redimensionnerAvecPoignee(page, "Aile avant", 40, 15)
  await expect.poll(async () => Number(await forme(page, "Aile avant").getAttribute("width"))).toBeGreaterThan(largeur + 3)
  const largeurTiree = Number(await forme(page, "Aile avant").getAttribute("width"))
  const hauteurTiree = Number(await forme(page, "Aile avant").getAttribute("height"))

  await glisserForme(page, "Aile avant", 30, 10)
  await expect(page.getByRole("button", { name: "Enregistrer la position" })).toBeVisible()
  const xApresGlissement = Number(await forme(page, "Aile avant").getAttribute("x"))
  expect(xApresGlissement).toBeGreaterThan(0)
  expect(Number(await forme(page, "Aile avant").getAttribute("width"))).toBeCloseTo(largeurTiree, 1)

  await page.getByRole("button", { name: "Enregistrer la position" }).click()
  await expect(page.getByRole("button", { name: "Déplacer ou redimensionner" })).toBeVisible()
  await page.reload()
  await expect.poll(async () => Number(await forme(page, "Aile avant").getAttribute("width"))).toBeCloseTo(largeurTiree, 1)
  await expect.poll(async () => Number(await forme(page, "Aile avant").getAttribute("height"))).toBeCloseTo(hauteurTiree, 1)
  await expect.poll(async () => Number(await forme(page, "Aile avant").getAttribute("x"))).toBeCloseTo(xApresGlissement, 1)
})

// Le cas de John : une forme réservée avec son logo, redimensionnée puis glissée.
test("responsable : déplacer une forme avec son logo après l'avoir redimensionnée garde la taille", async ({ page, equipe }) => {
  test.setTimeout(240_000)
  await connecterParLien(page, equipe)
  await page.setViewportSize(BUREAU)
  const vehiculeId = await creerSaxoDeux(page)
  await ouvrirDeco(page, vehiculeId)

  await ligne(page, "Aile avant").click()
  await page.getByRole("button", { name: "Réserver", exact: true }).click()
  await page.locator('select[name="partenaireId"]').selectOption("")
  await page.locator('input[name="partenaireNom"]').fill("Garage Muller")
  await joindreFichier(page, LOGO)
  await page.getByRole("button", { name: "Réserver l'emplacement" }).click()
  await expect(page.getByText("Garage Muller", { exact: true }).first()).toBeVisible()

  await page.getByRole("button", { name: "Déplacer ou redimensionner" }).click()
  const largeur = Number(await forme(page, "Aile avant").getAttribute("width"))
  await redimensionnerAvecPoignee(page, "Aile avant", 40, 15)
  await expect.poll(async () => Number(await forme(page, "Aile avant").getAttribute("width"))).toBeGreaterThan(largeur + 3)
  const largeurTiree = Number(await forme(page, "Aile avant").getAttribute("width"))
  const hauteurTiree = Number(await forme(page, "Aile avant").getAttribute("height"))

  await glisserForme(page, "Aile avant", 30, 10)
  await expect(page.getByRole("button", { name: "Enregistrer la position" })).toBeVisible()
  await page.getByRole("button", { name: "Enregistrer la position" }).click()
  await expect(page.getByRole("button", { name: "Déplacer ou redimensionner" })).toBeVisible()
  await page.reload()
  await expect.poll(async () => Number(await forme(page, "Aile avant").getAttribute("width"))).toBeCloseTo(largeurTiree, 1)
  await expect.poll(async () => Number(await forme(page, "Aile avant").getAttribute("height"))).toBeCloseTo(hauteurTiree, 1)
})

// Redimensionner à la poignée, puis glisser le corps : la taille tirée à la poignée reste après le glissement.
test("responsable : redimensionner à la poignée, puis glisser, garde la taille", async ({ page, equipe }) => {
  test.setTimeout(240_000)
  await connecterParLien(page, equipe)
  await page.setViewportSize(BUREAU)
  const vehiculeId = await creerSaxoDeux(page)
  await ouvrirDeco(page, vehiculeId)

  await ligne(page, "Aile avant").click()
  const largeur = Number(await forme(page, "Aile avant").getAttribute("width"))
  await page.getByRole("button", { name: "Déplacer ou redimensionner" }).click()
  await redimensionnerAvecPoignee(page, "Aile avant", 40, 15)
  await expect.poll(async () => Number(await forme(page, "Aile avant").getAttribute("width"))).toBeGreaterThan(largeur + 3)
  const tireeWidth = Number(await forme(page, "Aile avant").getAttribute("width"))
  const tireeHeight = Number(await forme(page, "Aile avant").getAttribute("height"))

  await glisserForme(page, "Aile avant", 25, 0)
  await expect(page.getByRole("button", { name: "Enregistrer la position" })).toBeVisible()
  expect(Number(await forme(page, "Aile avant").getAttribute("width"))).toBeCloseTo(tireeWidth, 1)
  expect(Number(await forme(page, "Aile avant").getAttribute("height"))).toBeCloseTo(tireeHeight, 1)

  await page.getByRole("button", { name: "Enregistrer la position" }).click()
  await expect(page.getByRole("button", { name: "Déplacer ou redimensionner" })).toBeVisible()
  await page.reload()
  await expect.poll(async () => Number(await forme(page, "Aile avant").getAttribute("width"))).toBeCloseTo(tireeWidth, 1)
  await expect.poll(async () => Number(await forme(page, "Aile avant").getAttribute("height"))).toBeCloseTo(tireeHeight, 1)
})

// Un glissement au doigt, de dx, dy pixels à l'écran, depuis le point de départ (événements tactiles du navigateur).
async function glisserAuDoigt(cdp: CDPSession, de: { x: number; y: number }, dx: number, dy: number): Promise<void> {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: de.x, y: de.y }] })
  for (let i = 1; i <= 8; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: de.x + (dx * i) / 8, y: de.y + (dy * i) / 8 }] })
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
}

// Même scénario au doigt, sur un téléphone de 360 px : le geste passe par les événements tactiles du navigateur.
test.describe("téléphone 360 px, au doigt", () => {
  test.use({ hasTouch: true })

  test("responsable : tirer la poignée au doigt, puis glisser au doigt sur la forme", async ({ page, equipe }) => {
    test.setTimeout(240_000)
    await connecterParLien(page, equipe)
    await page.setViewportSize(BUREAU)
    const vehiculeId = await creerSaxoDeux(page)
    await page.setViewportSize(TELEPHONE)
    await ouvrirDeco(page, vehiculeId)

    await ligne(page, "Aile avant").click()
    const tiroir = page.getByRole("dialog")
    const largeur = Number(await forme(page, "Aile avant").getAttribute("width"))
    await tiroir.getByRole("button", { name: "Déplacer ou redimensionner" }).click()
    await forme(page, "Aile avant").scrollIntoViewIfNeeded()
    const cdp = await page.context().newCDPSession(page)
    await capturer(page, "voiture-deco-glissement-avant-360.png")
    const boitePoignee = await poignee(page).boundingBox()
    if (!boitePoignee) throw new Error("Aile avant : pas de poignée à l'écran")
    await glisserAuDoigt(cdp, { x: boitePoignee.x + boitePoignee.width / 2, y: boitePoignee.y + boitePoignee.height / 2 }, 30, 10)
    await expect.poll(async () => Number(await forme(page, "Aile avant").getAttribute("width"))).toBeGreaterThan(largeur + 3)
    await expect(page.getByRole("button", { name: "Enregistrer la position" })).toBeVisible()
    const largeurTiree = Number(await forme(page, "Aile avant").getAttribute("width"))

    const boite = await forme(page, "Aile avant").boundingBox()
    if (!boite) throw new Error("Aile avant : pas de boîte à l'écran")
    await glisserAuDoigt(cdp, { x: boite.x + boite.width / 2, y: boite.y + boite.height / 2 }, 20, 0)
    expect(Number(await forme(page, "Aile avant").getAttribute("width"))).toBeCloseTo(largeurTiree, 1)
    await capturer(page, "voiture-deco-glissement-apres-360.png")
  })

  // Une petite forme (Aile avant droite, 8 unités de haut à 360 px) : un appui au milieu la déplace, un appui au coin la
  // redimensionne. La poignée ne couvre jamais plus du tiers du côté le plus court, donc le milieu reste à déplacer.
  test("responsable, téléphone : sur une petite forme, le milieu déplace et le coin redimensionne", async ({ page, equipe }) => {
    test.setTimeout(240_000)
    await connecterParLien(page, equipe)
    await page.setViewportSize(BUREAU)
    const vehiculeId = await creerSaxoDeux(page)
    await page.setViewportSize(TELEPHONE)
    await ouvrirDeco(page, vehiculeId)

    await ligne(page, "Aile avant droite").click()
    await page.getByRole("button", { name: "Déplacer ou redimensionner" }).click()
    const cdp = await page.context().newCDPSession(page)
    const xDepart = Number(await forme(page, "Aile avant droite").getAttribute("x"))
    const largeurDepart = Number(await forme(page, "Aile avant droite").getAttribute("width"))

    // Appui au milieu : la forme se déplace, sa largeur ne change pas.
    const milieu = await forme(page, "Aile avant droite").boundingBox()
    if (!milieu) throw new Error("Aile avant droite : pas de boîte à l'écran")
    await glisserAuDoigt(cdp, { x: milieu.x + milieu.width / 2, y: milieu.y + milieu.height / 2 }, 20, 0)
    await expect.poll(async () => Number(await forme(page, "Aile avant droite").getAttribute("x"))).not.toBeCloseTo(xDepart, 0)
    expect(Number(await forme(page, "Aile avant droite").getAttribute("width"))).toBeCloseTo(largeurDepart, 1)

    // Appui au coin bas-droit : la forme se redimensionne, son coin haut-gauche (x) ne bouge pas.
    const xApresMilieu = Number(await forme(page, "Aile avant droite").getAttribute("x"))
    const boitePoignee = await poignee(page).boundingBox()
    if (!boitePoignee) throw new Error("Aile avant droite : pas de poignée à l'écran")
    await glisserAuDoigt(cdp, { x: boitePoignee.x + boitePoignee.width / 2, y: boitePoignee.y + boitePoignee.height / 2 }, 10, 0)
    await expect.poll(async () => Number(await forme(page, "Aile avant droite").getAttribute("width"))).toBeGreaterThan(largeurDepart + 1)
    expect(Number(await forme(page, "Aile avant droite").getAttribute("x"))).toBeCloseTo(xApresMilieu, 1)
    await expect(page.getByRole("button", { name: "Enregistrer la position" })).toBeVisible()
  })

  // Sur téléphone, le déplacement se fait sur une barre compacte en bas, sans tiroir : le plan reste visible et actif,
  // la forme se glisse au doigt, et elle reste au-dessus de la barre.
  test("responsable, téléphone : déplacer une forme sur la barre, le plan reste actif et la forme au-dessus de la barre", async ({ page, equipe }) => {
    test.setTimeout(240_000)
    await connecterParLien(page, equipe)
    await page.setViewportSize(BUREAU)
    const vehiculeId = await creerSaxoDeux(page)
    await page.setViewportSize(TELEPHONE)
    await ouvrirDeco(page, vehiculeId)

    await ligne(page, "Aile avant").click()
    await page.getByRole("button", { name: "Déplacer ou redimensionner" }).click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    const barre = page.getByRole("form", { name: "Déplacer ou redimensionner Aile avant" })
    await expect(barre.getByRole("button")).toHaveCount(2)
    await expect(barre.getByRole("button", { name: "Annuler", exact: true })).toBeVisible()
    await expect(barre.getByRole("button", { name: "Enregistrer la position", exact: true })).toBeVisible()
    await expect(page.getByText("Glisse la forme, ou son coin pour la redimensionner.")).toBeVisible()
    await sansDefilementHorizontal(page)

    // Le plan reste actif : on glisse la forme au doigt, puis elle se pose au-dessus de la barre.
    const cdp = await page.context().newCDPSession(page)
    const xAvant = Number(await forme(page, "Aile avant").getAttribute("x"))
    const depart = await forme(page, "Aile avant").boundingBox()
    if (!depart) throw new Error("Aile avant : pas de boîte à l'écran")
    await glisserAuDoigt(cdp, { x: depart.x + depart.width / 2, y: depart.y + depart.height / 2 }, 20, 0)
    await expect.poll(async () => Number(await forme(page, "Aile avant").getAttribute("x"))).not.toBeCloseTo(xAvant, 0)
    const xApres = Number(await forme(page, "Aile avant").getAttribute("x"))

    const boiteForme = await forme(page, "Aile avant").boundingBox()
    const boiteBarre = await barre.boundingBox()
    if (!boiteForme || !boiteBarre) throw new Error("forme ou barre absente à l'écran")
    expect(boiteForme.y + boiteForme.height).toBeLessThanOrEqual(boiteBarre.y)
    await capturer(page, "voiture-deco-barre-position-apres-360.png")

    await barre.getByRole("button", { name: "Enregistrer la position", exact: true }).click()
    await expect(page.getByRole("button", { name: "Enregistrer la position" })).toHaveCount(0)
    await page.reload()
    await expect.poll(async () => Number(await forme(page, "Aile avant").getAttribute("x"))).toBeCloseTo(xApres, 1)
  })
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
  await expect(listePlan(page).locator("li:visible")).toHaveCount(6)
  await ligne(page, "Portière").click()
  await expect(page.getByRole("heading", { name: "Portière droite", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Réserver", exact: true })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Rendre indisponible" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Déplacer ou redimensionner" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Ajouter un emplacement" })).toHaveCount(0)
  await expect(page.getByText("Modifier l'emplacement")).toHaveCount(0)
})

// Une étape modifiée ne se ferme pas sans demander : « Abandonner les modifications ? ». « Continuer la saisie » garde le
// texte ; « Abandonner » revient à la fiche, sans rien enregistrer.
test("responsable : une étape modifiée demande « Abandonner les modifications ? », puis revient à la fiche", async ({ page, equipe }) => {
  test.setTimeout(240_000)
  await connecterParLien(page, equipe)
  await page.setViewportSize(BUREAU)
  const vehiculeId = await creerSaxoDeux(page)
  await ouvrirDeco(page, vehiculeId)

  await ligne(page, "Portière").click()
  await page.getByRole("button", { name: "Renommer", exact: true }).click()
  const etape = page.getByRole("dialog", { name: "Renommer l'emplacement", exact: true })
  await etape.getByLabel("Nom", { exact: true }).fill("Portière arrière")
  await page.keyboard.press("Escape")
  await expect(etape.getByText("Abandonner les modifications ?")).toBeVisible()
  await etape.getByRole("button", { name: "Continuer la saisie", exact: true }).click()
  await expect(etape.getByLabel("Nom", { exact: true })).toHaveValue("Portière arrière")

  await etape.getByRole("button", { name: "Annuler", exact: true }).click()
  await etape.getByRole("button", { name: "Abandonner", exact: true }).click()
  // Abandonner revient à la fiche, sans rien enregistrer.
  await expect(page.getByRole("dialog", { name: "Portière droite", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Renommer", exact: true })).toBeVisible()
  await expect(ligne(page, "Portière droite")).toBeVisible()
  await expect(listePlan(page).getByText("Portière arrière")).toHaveCount(0)

  await page.getByRole("dialog").getByRole("button", { name: "Fermer", exact: true }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
})

// Le tiroir glisse à l'ouverture : la capture attend la fin de l'animation, sinon elle le montre hors de l'écran.
async function attendreTiroir(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => document.querySelector('[role="dialog"]')?.getAnimations().length ?? 0)).toBe(0)
}

// Captures du brief 3.13 (phase A) : les tiroirs de la Déco, en thème clair. Une saisie (réserver), une étape de pose, une
// confirmation (annuler la réservation) et la garde « Abandonner les modifications ? ». Chacune est l'écran visible.
async function capturerTiroirsDeco(page: Page, vue: string, nom: string, taille: string): Promise<void> {
  await boutonVue(page, vue).click()
  await ligne(page, nom).click()
  await page.getByRole("button", { name: "Réserver", exact: true }).click()
  await page.locator('select[name="partenaireId"]').selectOption("")
  await page.locator('input[name="partenaireNom"]').fill("Garage Muller")
  await joindreFichier(page, LOGO)
  await attendreTiroir(page)
  await capturerEcran(page, `tiroir-deco-reserver-${taille}-clair.png`)
  await page.getByRole("button", { name: "Réserver l'emplacement" }).click()
  await expect(page.getByRole("dialog").getByText("Réservé", { exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Marquer le logo posé", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Marquer le logo posé", exact: true })).toBeVisible()
  await attendreTiroir(page)
  await capturerEcran(page, `tiroir-deco-marquer-logo-pose-${taille}-clair.png`)
  await page.getByRole("button", { name: "← Retour", exact: true }).click()

  await page.getByRole("button", { name: "Annuler la réservation", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Annuler la réservation", exact: true })).toBeVisible()
  await attendreTiroir(page)
  await capturerEcran(page, `tiroir-deco-confirmation-${taille}-clair.png`)
  await page.getByRole("button", { name: "← Retour", exact: true }).click()

  await page.getByRole("button", { name: "Renommer", exact: true }).click()
  await page.getByLabel("Nom", { exact: true }).fill("Capot avant")
  await page.keyboard.press("Escape")
  await expect(page.getByText("Abandonner les modifications ?")).toBeVisible()
  await attendreTiroir(page)
  await capturerEcran(page, `tiroir-deco-abandon-modifications-${taille}-clair.png`)
  await page.getByRole("button", { name: "Abandonner", exact: true }).click()
  await expect(page.getByRole("button", { name: "Renommer", exact: true })).toBeVisible()
  await page.getByRole("dialog").getByRole("button", { name: "Fermer", exact: true }).click()
}

// Un véhicule sans plan (« Aucun gabarit ») propose un modèle, qui crée ses emplacements. À la création, le défaut est la
// voiture générique : ses emplacements arrivent avec le véhicule.
test("responsable : un véhicule sans plan propose un modèle, et la création prend la voiture générique par défaut", async ({ page, equipe }) => {
  test.setTimeout(240_000)
  await connecterParLien(page, equipe)
  await page.setViewportSize(BUREAU)

  await page.goto("/apps/voiture")
  await page.getByRole("button", { name: "Ajouter", exact: true }).click()
  await page.getByRole("menuitem", { name: /Véhicule/ }).click()
  await page.waitForURL(/\/apps\/voiture\/nouveau$/)
  await page.locator('input[name="nom"]').fill("Sans plan")
  await page.locator('select[name="gabaritCle"]').selectOption("")
  await page.getByRole("button", { name: "Ajouter le véhicule" }).click()
  await page.waitForURL(/\/apps\/voiture\/vehicules\/[0-9a-f-]{36}/)
  const sansPlan = new URL(page.url()).pathname.split("/")[4]
  await page.goto(`/apps/voiture/vehicules/${sansPlan}?onglet=deco`)
  await expect(page.getByText("Ce véhicule n'a pas encore de plan. Choisissez un modèle de plan pour y placer vos emplacements.")).toBeVisible()
  await expect(page.getByRole("group", { name: /^Plan de Sans plan/ })).toHaveCount(0)
  await capturerEcran(page, "voiture-deco-sans-plan-1440.png")

  await page.locator('select[name="gabaritCle"]').selectOption("citadine_3p_saxo")
  await page.getByRole("button", { name: "Choisir ce modèle", exact: true }).click()
  await expect(page.getByText("Ce véhicule n'a pas encore de plan.")).toHaveCount(0)
  await expect(page.getByRole("group", { name: /^Plan de Sans plan/ })).toBeVisible()
  await expect(listePlan(page).locator("button:visible")).toHaveCount(6)

  // Création sans toucher au choix : le modèle proposé est la voiture générique, avec son plan.
  await page.goto("/apps/voiture")
  await page.getByRole("button", { name: "Ajouter", exact: true }).click()
  await page.getByRole("menuitem", { name: /Véhicule/ }).click()
  await page.waitForURL(/\/apps\/voiture\/nouveau$/)
  await page.locator('input[name="nom"]').fill("Voiture par défaut")
  await expect(page.locator('select[name="gabaritCle"]')).toHaveValue("voiture_generique")
  await page.getByRole("button", { name: "Ajouter le véhicule" }).click()
  await page.waitForURL(/\/apps\/voiture\/vehicules\/[0-9a-f-]{36}/)
  const parDefaut = new URL(page.url()).pathname.split("/")[4]
  await page.goto(`/apps/voiture/vehicules/${parDefaut}?onglet=deco`)
  await expect(page.getByRole("group", { name: /^Plan de Voiture par défaut/ })).toBeVisible()
  await expect(listePlan(page).locator("button:visible")).toHaveCount(6)
  // Créé avec le gabarit actuel, rien à mettre à jour : le bouton « Mettre le plan à jour » n'apparaît pas.
  await expect(page.getByRole("button", { name: "Mettre le plan à jour" })).toHaveCount(0)
})

test("captures 3.13 · tiroirs de la Déco, en thème clair, à 1440 et à 360 px", async ({ page, equipe }) => {
  test.setTimeout(360_000)
  await connecterParLien(page, equipe)
  await page.setViewportSize(BUREAU)
  const vehiculeId = await creerSaxoDeux(page)
  await passerEnThemeClair(page)
  await ouvrirDeco(page, vehiculeId)
  await capturerTiroirsDeco(page, "Dessus", "Capot", "1440x900")
  await page.setViewportSize(TELEPHONE)
  await capturerTiroirsDeco(page, "Arrière", "Hayon", "360x740")
})

// Captures de chaque vue du plan (brief 3.4) : le plan et la liste groupée, à 1440 px puis à 360 px. La liste de la vue
// montre le côté dans le nom (« Portière gauche »). Une vue sans emplacement n'existerait pas dans le gabarit de la Saxo.
const VUES_DECO = [
  { vue: "Côté droit", fichier: "droite" },
  { vue: "Côté gauche", fichier: "gauche" },
  { vue: "Avant", fichier: "avant" },
  { vue: "Arrière", fichier: "arriere" },
  { vue: "Dessus", fichier: "dessus" },
] as const

test("captures · la Déco de la Saxo, vue par vue, à 1440 et à 360 px", async ({ page, equipe }) => {
  test.setTimeout(480_000)
  await connecterParLien(page, equipe)
  await page.setViewportSize(BUREAU)
  const vehiculeId = await creerSaxoDeux(page)
  await ouvrirDeco(page, vehiculeId)

  for (const taille of [{ largeur: BUREAU, suffixe: "1440" }, { largeur: TELEPHONE, suffixe: "360" }]) {
    await page.setViewportSize(taille.largeur)
    for (const { vue, fichier } of VUES_DECO) {
      await boutonVue(page, vue).click()
      await expect(page.getByRole("group", { name: new RegExp(`^Plan de Saxo 2, ${vue.toLowerCase()}$`) })).toBeVisible()
      await capturer(page, `deco-vue-${fichier}-${taille.suffixe}.png`)
      if (taille.suffixe === "360") await sansDefilementHorizontal(page)
    }
  }
})
