// Voiture : écrans, fiches de réglage et widgets (tâche 3.3, brief section 9). Le scénario hors ligne est dans
// voiture-hors-ligne.spec.ts (projet « hors-ligne », seul à avoir le service worker). Les captures des écrans
// partent dans docs/captures/ à 1440 px et à 360 px.
import path from "node:path"

import type { Page } from "@playwright/test"

import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { ajouterMembreConnectable, ajouterVoitureSaxo, donnerAccesVoiture, reglagesVoitureEnBase } from "./aide/session"

const DOSSIER = path.join(__dirname, "..", "docs", "captures")
const BUREAU = { width: 1440, height: 900 }
const TELEPHONE = { width: 360, height: 740 }

// Date civile de Paris, décalée de n jours : les échéances des papiers sont des dates sans heure.
function jourCivil(decalage: number): string {
  return new Date(Date.now() + decalage * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" })
}

// Aucun défilement horizontal sur la page, à la largeur courante (brief 3.3, point 8).
async function sansDefilementHorizontal(page: Page): Promise<void> {
  const deborde = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(deborde, "défilement horizontal sur la page").toBe(false)
}

// Capture pleine page. Les éléments fixes (barres, boutons flottants) et l'indicateur de développement sont masqués.
async function capturer(page: Page, nom: string): Promise<void> {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" })
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>("body *").forEach((element) => {
      if (getComputedStyle(element).position === "fixed") element.style.display = "none"
    })
  })
  await page.screenshot({ path: path.join(DOSSIER, nom), fullPage: true })
}

// « Saxo 2 » créée par le bouton + (entrée Véhicule), avec le gabarit Saxo. Renvoie l'identifiant du véhicule.
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

// Le formulaire « Ajouter un papier » : son tiroir, ouvert par le bouton du même nom.
function formulaireAjoutPapier(page: Page) {
  return page.getByRole("dialog")
}

// Une fiche de réglage au formulaire : la pression avant gauche à froid, puis attente de sa présence en base.
async function saisirFicheAvg(page: Page, vehiculeId: string, pression: string): Promise<void> {
  await page.goto(`/apps/voiture/vehicules/${vehiculeId}/reglages/nouveau`)
  await page.locator('input[name="v_pression_froid_avg"]').fill(pression)
  await page.getByRole("button", { name: "Enregistrer la fiche" }).click()
  await expect(page.getByText("Fiche enregistrée")).toBeVisible()
}

test("responsable : Saxo 2 par le bouton +, identité saisie, la Déco liste les emplacements", async ({ page, equipe }) => {
  test.setTimeout(240_000)
  await connecterParLien(page, equipe)
  await page.setViewportSize(BUREAU)

  await creerSaxoDeux(page)
  await page.getByRole("link", { name: "Déco" }).click()
  await expect(page.getByText("Portière").first()).toBeVisible()
  await expect(page.getByText("Libre").first()).toBeVisible()
  await expect(page.getByText("Autres emplacements").first()).toBeVisible()
  await expect(page.getByText("Capot").first()).toBeVisible()

  await page.getByRole("link", { name: "Identité" }).click()
  await page.getByRole("button", { name: "Modifier la fiche", exact: true }).click()
  await page.locator('input[name="marque"]').fill("Citroën")
  await page.locator('input[name="modele"]').fill("Saxo")
  await page.locator('input[name="groupe"]').fill("N2")
  await page.getByRole("dialog").getByRole("button", { name: "Enregistrer", exact: true }).click()

  await page.goto("/apps/voiture")
  await expect(page.getByText("N2").first()).toBeVisible()
})

test("responsable : une assurance qui expire dans 10 jours fait « Papier à renouveler » ; le QG propose de le renouveler", async ({ page, equipe }) => {
  test.setTimeout(240_000)
  await connecterParLien(page, equipe)
  await page.setViewportSize(BUREAU)
  const vehiculeId = await creerSaxoDeux(page)

  await page.goto(`/apps/voiture/vehicules/${vehiculeId}?onglet=papiers`)
  await page.getByText("Ajouter un papier").click()
  await formulaireAjoutPapier(page).locator('select[name="type"]').selectOption("assurance")
  await formulaireAjoutPapier(page).locator('input[name="valableJusquAu"]').fill(jourCivil(10))
  await page.getByRole("button", { name: "Ajouter le papier" }).click()

  await page.goto("/apps/voiture")
  await expect(page.getByText("Papier à renouveler").first()).toBeVisible()

  // La boîte d'actions du QG se remplit à l'ouverture du QG ; elle est repliée, on l'ouvre.
  await page.goto("/qg")
  await page.getByRole("button", { name: /Boîte d'actions/ }).click()
  await expect(page.getByText(/Renouveler .* : Saxo 2/).first()).toBeVisible()

  await page.goto(`/apps/voiture/vehicules/${vehiculeId}?onglet=papiers`)
  await page.getByText("Ajouter un papier").click()
  await formulaireAjoutPapier(page).locator('select[name="type"]').selectOption("controle_technique")
  await formulaireAjoutPapier(page).locator('input[name="valableJusquAu"]').fill(jourCivil(-3))
  await page.getByRole("button", { name: "Ajouter le papier" }).click()

  await page.goto("/apps/voiture")
  await expect(page.getByText("Papier expiré").first()).toBeVisible()
})

test("responsable : deux fiches, comparaison des écarts, référence et pré-remplissage ; captures et 360 px", async ({ page, equipe }) => {
  test.setTimeout(420_000)
  await connecterParLien(page, equipe)
  await page.setViewportSize(BUREAU)
  const vehiculeId = await creerSaxoDeux(page)

  // Première fiche (2,0 bar), puis enregistrée comme référence.
  await saisirFicheAvg(page, vehiculeId, "2,0")
  await expect.poll(async () => (await reglagesVoitureEnBase(equipe)).length, { timeout: 30_000 }).toBe(1)
  const [premiere] = await reglagesVoitureEnBase(equipe)
  await page.goto(`/apps/voiture/vehicules/${vehiculeId}/reglages/${premiere.id}`)
  await page.getByRole("button", { name: "Enregistrer comme référence", exact: true }).click()
  await page.locator('input[name="nom"]').fill("Asphalte sec")
  await page.getByRole("dialog").getByRole("button", { name: "Enregistrer la référence", exact: true }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)

  // Seconde fiche (2,2 bar) : la dernière, qui n'est pas la référence.
  await saisirFicheAvg(page, vehiculeId, "2,2")
  await expect.poll(async () => (await reglagesVoitureEnBase(equipe)).length, { timeout: 30_000 }).toBe(2)

  // Comparaison : écart = seconde − première, quel que soit l'ordre des cases cochées.
  await page.goto(`/apps/voiture/vehicules/${vehiculeId}?onglet=reglages`)
  await page.getByRole("checkbox", { name: /Comparer la fiche du/ }).nth(0).check()
  await page.getByRole("checkbox", { name: /Comparer la fiche du/ }).nth(1).check()
  await page.getByRole("button", { name: "Comparer les deux fiches" }).click()
  await page.waitForURL(/\/reglages\/comparer/)
  const a = new URL(page.url()).searchParams.get("a")
  await page.getByLabel("Voir seulement les écarts").check()
  await expect(page.getByText("Hauteur de caisse avant")).toHaveCount(0)
  await expect(page.getByText(a === premiere.id ? "+0,2 bar" : "−0,2 bar")).toBeVisible()
  await capturer(page, "voiture-comparaison-1440.png")
  const urlComparaison = page.url()

  // Nouvelle fiche « Partir de » la référence : la pression avant gauche à froid est pré-remplie avec 2,0.
  await page.goto(`/apps/voiture/vehicules/${vehiculeId}/reglages/nouveau`)
  await page.getByLabel("Partir de").selectOption({ label: "Référence : Asphalte sec" })
  await page.waitForURL(/partir=/)
  await expect(page.locator('input[name="v_pression_froid_avg"]')).toHaveValue("2,0")
  await capturer(page, "voiture-nouvelle-fiche-1440.png")

  // Données des captures (brief 3.4, point 0.3) : identité remplie, un papier par statut. Les deux fiches et la
  // référence sont déjà là.
  await page.goto(`/apps/voiture/vehicules/${vehiculeId}?onglet=identite`)
  await page.getByRole("button", { name: "Modifier la fiche", exact: true }).click()
  await page.locator('input[name="marque"]').fill("Citroën")
  await page.locator('input[name="modele"]').fill("Saxo")
  await page.locator('input[name="groupe"]').fill("N2")
  await page.getByRole("dialog").getByRole("button", { name: "Enregistrer", exact: true }).click()
  for (const [type, decalage] of [
    ["assurance", 200],
    ["controle_technique", 10],
    ["carte_grise", -3],
  ] as const) {
    await page.goto(`/apps/voiture/vehicules/${vehiculeId}?onglet=papiers`)
    await page.getByText("Ajouter un papier").click()
    await formulaireAjoutPapier(page).locator('select[name="type"]').selectOption(type)
    await formulaireAjoutPapier(page).locator('input[name="valableJusquAu"]').fill(jourCivil(decalage))
    await page.getByRole("button", { name: "Ajouter le papier" }).click()
    await page.waitForLoadState("networkidle")
  }

  // Captures des cinq onglets de la fiche et de Mes véhicules, à 1440 px.
  await page.goto("/apps/voiture")
  await capturer(page, "voiture-mes-vehicules-1440.png")
  for (const onglet of ["identite", "papiers", "deco", "reglages", "historique"]) {
    await page.goto(`/apps/voiture/vehicules/${vehiculeId}?onglet=${onglet}`)
    await capturer(page, `voiture-fiche-${onglet}-1440.png`)
  }

  // À 360 px : mêmes écrans, sans défilement horizontal (brief 3.3, point 8).
  await page.setViewportSize(TELEPHONE)
  await page.goto("/apps/voiture")
  await sansDefilementHorizontal(page)
  await capturer(page, "voiture-mes-vehicules-360.png")
  await page.goto(`/apps/voiture/vehicules/${vehiculeId}?onglet=reglages`)
  await sansDefilementHorizontal(page)
  await capturer(page, "voiture-fiche-reglages-360.png")
  for (const onglet of ["identite", "papiers", "deco", "historique"]) {
    await page.goto(`/apps/voiture/vehicules/${vehiculeId}?onglet=${onglet}`)
    await sansDefilementHorizontal(page)
    await capturer(page, `voiture-fiche-${onglet}-360.png`)
  }
  await page.goto("/apps/voiture/vehicules/" + vehiculeId + "/reglages/nouveau")
  await sansDefilementHorizontal(page)
  await capturer(page, "voiture-nouvelle-fiche-360.png")
  await page.goto(urlComparaison)
  await sansDefilementHorizontal(page)
  await capturer(page, "voiture-comparaison-360.png")
})

test("assistance : lit les véhicules et les fiches, crée une fiche au +, ne modifie pas celle du responsable", async ({ page, equipe, context }) => {
  test.setTimeout(300_000)
  await connecterParLien(page, equipe)
  await page.setViewportSize(BUREAU)
  const vehiculeId = await ajouterVoitureSaxo(equipe, "Saxo 2")
  await saisirFicheAvg(page, vehiculeId, "2,0")
  await expect.poll(async () => (await reglagesVoitureEnBase(equipe)).length, { timeout: 30_000 }).toBe(1)
  const [ficheResponsable] = await reglagesVoitureEnBase(equipe)

  // L'assistance se connecte à la place du responsable.
  const assistance = await ajouterMembreConnectable(equipe, "assistance")
  await donnerAccesVoiture(equipe, assistance, "contribution")
  await context.clearCookies()
  await connecterParLien(page, { ...equipe, secretLien: assistance.secretLien })
  await page.setViewportSize(BUREAU)

  await page.goto("/apps/voiture")
  await expect(page.getByText("Saxo 2").first()).toBeVisible()
  await expect(page.getByText("Ajouter un véhicule")).toHaveCount(0)

  await page.goto(`/apps/voiture/vehicules/${vehiculeId}?onglet=identite`)
  await expect(page.locator('input[name="marque"]')).toHaveCount(0)

  // Fiche du responsable : lecture seule.
  await page.goto(`/apps/voiture/vehicules/${vehiculeId}/reglages/${ficheResponsable.id}`)
  await expect(page.getByText("Modifier la fiche")).toHaveCount(0)

  // Une fiche au bouton + en mode terrain : l'entrée Réglage ouvre le formulaire du véhicule.
  await page.getByRole("button", { name: "Mode terrain", exact: true }).click()
  await page.getByRole("button", { name: "Ajouter", exact: true }).click()
  await page.getByRole("menuitem", { name: /Réglage/ }).click()
  await page.waitForURL(/\/reglages\/nouveau/)
  await page.locator('input[name="v_pression_froid_avg"]').fill("2,1")
  await page.getByRole("button", { name: "Enregistrer la fiche" }).click()
  await expect(page.getByText("Fiche enregistrée")).toBeVisible()
  await expect
    .poll(async () => (await reglagesVoitureEnBase(equipe)).some((fiche) => fiche.createdBy === assistance.userId), { timeout: 30_000 })
    .toBe(true)
})

test("invité : /apps/voiture affiche l'écran de refus", async ({ page, equipe }) => {
  const sansAcces = await ajouterMembreConnectable(equipe, "assistance", "-sans-acces")
  await donnerAccesVoiture(equipe, sansAcces, "aucun")
  await connecterParLien(page, { ...equipe, secretLien: sansAcces.secretLien })
  await page.goto("/apps/voiture")
  await expect(page.getByText("Tu n'as pas accès à cette app")).toBeVisible()
})
