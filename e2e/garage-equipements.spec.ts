// Équipements de la team (tâche 4.6, brief §5). Le responsable ajoute une remorque au contrôle dépassé et un compresseur sans
// contrôle, vérifie les mots d'échéance et la valeur totale, modifie, retire. L'assistance voit la liste sans valeur ni bouton
// actif. Le parcours part du QG (tuile, menu, bouton +) ; seule l'entrée est une URL. Les captures partent dans
// docs/captures/ (garage-equipements-*) et sont relues avant commit.
import path from "node:path"

import type { Browser, Page } from "@playwright/test"

import { envoyer } from "./aide/envoi"
import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { ajouterMembreConnectable, type Membre } from "./aide/session"

const DOSSIER = path.join(__dirname, "..", "docs", "captures")
const BUREAU = { width: 1440, height: 900 }
const TELEPHONE = { width: 360, height: 740 }

// Capture pleine page : éléments fixes masqués, sauf le tiroir ouvert (même convention que garage-plan.spec.ts).
async function capturerPage(page: Page, nom: string): Promise<void> {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" })
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>("body *").forEach((element) => {
      if (element.closest('[role="dialog"]')) return
      if (getComputedStyle(element).position === "fixed") element.style.display = "none"
    })
  })
  await page.screenshot({ path: path.join(DOSSIER, nom), fullPage: true, animations: "disabled" })
}

// Aucun défilement horizontal sur la page, à la largeur courante.
async function sansDefilementHorizontal(page: Page): Promise<void> {
  const deborde = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(deborde, "défilement horizontal sur la page").toBe(false)
}

// Un membre connecté dans son propre contexte.
async function connecterMembre(browser: Browser, membre: Membre & { secretLien: string }): Promise<{ page: Page; fermer: () => Promise<void> }> {
  const contexte = await browser.newContext()
  const page = await contexte.newPage()
  await page.goto(`/connexion/lien?t=${membre.secretLien}`)
  await page.waitForURL(/\/qg$/)
  return { page, fermer: () => contexte.close() }
}

// Tuile d'une app sur le QG (le lien, pas le texte seul : les menus ont les mêmes libellés).
function tuile(page: Page, cle: string) {
  return page.locator(`a[href="/apps/${cle}"]`).filter({ has: page.locator("h2") })
}

// Jour de Paris décalé de n jours, en « AAAA-MM-JJ » (une date de contrôle est une date civile).
function jourParis(decalage: number): string {
  const instant = new Date(Date.now() + decalage * 86_400_000)
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(instant)
}

// Carte d'un équipement, par son nom (la carte est un élément de liste qui contient le nom).
function carte(page: Page, nom: string) {
  return page.locator("li").filter({ has: page.getByText(nom, { exact: true }) })
}

// Remplit le tiroir ouvert. Le libellé de la valeur porte une phrase d'aide : on le cherche par son début.
async function saisirEquipement(
  page: Page,
  champs: { nom: string; categorie: string; valeur?: string; prochainControle?: string; emplacement?: string },
): Promise<void> {
  const tiroir = page.getByRole("dialog")
  await expect(tiroir).toBeVisible()
  await tiroir.getByLabel("Nom", { exact: true }).fill(champs.nom)
  // Le libellé « Catégorie » enveloppe le select : son nom accessible contient l'option choisie. On vise le champ par son nom.
  await tiroir.locator('select[name="categorie"]').selectOption(champs.categorie)
  if (champs.valeur) await tiroir.getByLabel(/Valeur, en euros/).fill(champs.valeur)
  if (champs.prochainControle) await tiroir.getByLabel("Prochain contrôle (facultatif)").fill(champs.prochainControle)
  if (champs.emplacement) await tiroir.getByLabel("Emplacement (facultatif)").fill(champs.emplacement)
}

test("équipements : ajout, échéances, valeur totale, modification, lecture sans valeur, retrait", async ({ browser, page, equipe }) => {
  test.setTimeout(300_000)

  // Le responsable entre par le QG, puis la tuile Garage et le menu Équipements.
  await connecterParLien(page, equipe)
  await page.setViewportSize(BUREAU)
  await tuile(page, "garage").click()
  await page.getByRole("link", { name: "Équipements", exact: true }).click()
  await expect(page).toHaveURL(/\/apps\/garage\/equipements$/)
  await expect(page.getByRole("heading", { name: "Équipements", level: 1 })).toBeVisible()
  await expect(page.getByText("Aucun équipement enregistré.")).toBeVisible()

  // Ajout d'une remorque dont le contrôle est dépassé de trois jours, puis d'un compresseur sans contrôle.
  await page.getByRole("button", { name: "Ajouter un équipement", exact: true }).click()
  await saisirEquipement(page, { nom: "Remorque", categorie: "remorque", valeur: "2 500", prochainControle: jourParis(-3), emplacement: "Parc" })
  await envoyer(page, page.getByRole("dialog").getByRole("button", { name: "Ajouter l'équipement", exact: true }))

  await page.getByRole("button", { name: "Ajouter un équipement", exact: true }).click()
  await saisirEquipement(page, { nom: "Compresseur", categorie: "outillage", valeur: "350" })
  await envoyer(page, page.getByRole("dialog").getByRole("button", { name: "Ajouter l'équipement", exact: true }))

  // Les mots d'échéance, les catégories et la valeur totale (2 500 € + 350 €).
  await expect(page.getByRole("heading", { name: "Remorque", level: 2 })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Outillage", level: 2 })).toBeVisible()
  await expect(carte(page, "Remorque").getByText("Contrôle dépassé depuis 3 jours")).toBeVisible()
  await expect(carte(page, "Remorque").getByText("Dépassé", { exact: true })).toBeVisible()
  await expect(carte(page, "Compresseur").getByText("Aucun contrôle prévu")).toBeVisible()
  await expect(page.getByText("Contrôles dépassés : 1")).toBeVisible()
  await expect(page.getByText("Valeur totale : 2 850,00 €")).toBeVisible()
  await capturerPage(page, "garage-equipements-1440.png")
  await page.setViewportSize(TELEPHONE)
  await sansDefilementHorizontal(page)
  await capturerPage(page, "garage-equipements-360.png")
  await page.setViewportSize(BUREAU)

  // Modification : la remorque passe à 2 000 €, la valeur totale suit.
  await carte(page, "Remorque").getByRole("button", { name: "Modifier", exact: true }).click()
  await expect(page.getByRole("dialog")).toContainText("Modifier : Remorque")
  await page.getByRole("dialog").getByLabel(/Valeur, en euros/).fill("2 000")
  await envoyer(page, page.getByRole("dialog").getByRole("button", { name: "Enregistrer", exact: true }))
  await expect(carte(page, "Remorque").getByText("Valeur : 2 000,00 €")).toBeVisible()
  await expect(page.getByText("Valeur totale : 2 350,00 €")).toBeVisible()

  // L'assistance voit la liste et les échéances, sans valeur, sans bouton d'écriture.
  const assistance = await ajouterMembreConnectable(equipe, "assistance")
  const a = await connecterMembre(browser, assistance)
  try {
    await tuile(a.page, "garage").click()
    await a.page.getByRole("link", { name: "Équipements", exact: true }).click()
    await expect(a.page.getByRole("heading", { name: "Équipements", level: 1 })).toBeVisible()
    await expect(a.page.getByText("Contrôle dépassé depuis 3 jours")).toBeVisible()
    await expect(a.page.getByText("Aucun contrôle prévu")).toBeVisible()
    await expect(a.page.locator("main").getByText("€")).toHaveCount(0)
    await expect(a.page.getByRole("button", { name: "Ajouter un équipement", exact: true })).toHaveCount(0)
    await expect(a.page.getByRole("button", { name: "Modifier", exact: true })).toHaveCount(0)
    await expect(a.page.getByRole("button", { name: "Retirer", exact: true })).toHaveCount(0)
    await expect(a.page.getByText("Seuls le responsable et l'équipage ajoutent, modifient ou retirent les équipements.")).toBeVisible()
  } finally {
    await a.fermer()
  }

  // Retrait : la remorque sort de la liste et du total, sa catégorie disparaît avec elle.
  await carte(page, "Remorque").getByRole("button", { name: "Retirer", exact: true }).click()
  await expect(page.getByRole("dialog")).toContainText("L'équipement disparaît de la liste et du total")
  await envoyer(page, page.getByRole("dialog").getByRole("button", { name: "Retirer l'équipement", exact: true }))
  await expect(page.getByText("Remorque", { exact: true })).toHaveCount(0)
  await expect(page.getByText("Valeur totale : 350,00 €")).toBeVisible()

  // Le bouton + ouvre l'ajout directement (entrée « Équipement »).
  await page.getByRole("button", { name: "Ajouter", exact: true }).click()
  await page.getByRole("menuitem", { name: "Équipement", exact: true }).click()
  await expect(page).toHaveURL(/\/apps\/garage\/equipements\?nouveau=1/)
  await expect(page.getByRole("dialog")).toContainText("Ajouter un équipement")
})
