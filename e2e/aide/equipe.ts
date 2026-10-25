// Gestes communs aux scénarios d'Équipe (tâche 5.2) : créer une personne, une licence, un équipement, choisir le thème,
// capturer une page. Chaque geste passe par l'interface (tiroirs), comme le ferait la personne.
import path from "node:path"

import { expect, type Locator, type Page } from "@playwright/test"

import { envoyer } from "./envoi"

export const DOSSIER_CAPTURES = path.join(__dirname, "..", "..", "docs", "captures")

// Le tiroir ouvert : c'est le dernier dialogue affiché.
function tiroir(page: Page): Locator {
  return page.getByRole("dialog")
}

// Crée une personne depuis l'écran L'équipe et ouvre sa fiche. Rend l'identifiant de la personne (dans l'URL).
export async function creerPersonne(page: Page, prenom: string, nom: string, role: string): Promise<string> {
  await page.goto("/apps/equipe")
  await expect(page.getByRole("heading", { name: "L'équipe", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Nouvelle personne", exact: true }).click()
  await tiroir(page).getByLabel("Prénom", { exact: true }).fill(prenom)
  await tiroir(page).getByLabel("Nom", { exact: true }).fill(nom)
  await tiroir(page).getByLabel("Rôle habituel", { exact: true }).selectOption({ label: role })
  await envoyer(page, tiroir(page).getByRole("button", { name: "Ajouter la personne", exact: true }))
  await expect(page).toHaveURL(/\/apps\/equipe\/personnes\/[0-9a-f-]+$/)
  await expect(page.getByRole("heading", { name: `${prenom} ${nom}`, exact: true })).toBeVisible()
  return page.url().split("/").pop() ?? ""
}

// Ouvre un onglet de la fiche par son lien (les onglets sont des liens, pas des boutons).
export async function ouvrirOnglet(page: Page, libelle: string): Promise<void> {
  await page.getByRole("link", { name: libelle, exact: true }).click()
}

// Ajoute une licence à la fiche courante (onglet Licences).
export async function ajouterLicence(page: Page, libelleType: string, numero: string, valableAu: string): Promise<void> {
  await ouvrirOnglet(page, "Licences")
  await page.getByRole("button", { name: "Ajouter une licence", exact: true }).click()
  await tiroir(page).getByLabel("Type de licence", { exact: true }).selectOption({ label: libelleType })
  await tiroir(page).getByLabel("Numéro", { exact: true }).fill(numero)
  await tiroir(page).getByLabel("Valable jusqu'au").fill(valableAu)
  await envoyer(page, tiroir(page).getByRole("button", { name: "Ajouter la licence", exact: true }))
  await expect(page.getByText(`N° ${numero}`, { exact: false }).first()).toBeVisible()
}

// Ajoute un équipement à la fiche courante (onglet Équipement).
export async function ajouterEquipement(page: Page, libelleType: string, marque: string): Promise<void> {
  await ouvrirOnglet(page, "Équipement")
  await page.getByRole("button", { name: "Ajouter un équipement", exact: true }).click()
  await tiroir(page).getByLabel("Type d'équipement", { exact: true }).selectOption({ label: libelleType })
  await tiroir(page).getByLabel("Marque", { exact: true }).fill(marque)
  await envoyer(page, tiroir(page).getByRole("button", { name: "Ajouter l'équipement", exact: true }))
  await expect(page.getByText(marque, { exact: false }).first()).toBeVisible()
}

// Thème de l'app, par Réglages (même geste que les captures du thème clair).
export async function choisirTheme(page: Page, valeur: "clair" | "sombre"): Promise<void> {
  await page.goto("/apps/settings/affichage")
  await page.getByRole("button", { name: "Modifier l'affichage", exact: true }).click()
  await tiroir(page).locator("#theme").selectOption(valeur)
  await tiroir(page).getByRole("button", { name: "Enregistrer", exact: true }).click()
  await expect(tiroir(page)).toHaveCount(0)
}

// Capture pleine page : éléments fixes masqués, sauf le tiroir ouvert (même convention que garage-captures.spec.ts).
export async function capturer(page: Page, nom: string): Promise<void> {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" })
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>("body *").forEach((element) => {
      if (element.closest('[role="dialog"]')) return
      if (getComputedStyle(element).position === "fixed") element.style.display = "none"
    })
  })
  await page.screenshot({ path: path.join(DOSSIER_CAPTURES, nom), fullPage: true, animations: "disabled" })
}
