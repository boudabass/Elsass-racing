import type { Page } from "@playwright/test"

import { expect, test } from "./aide/fixtures"
import { creerPersonne, ouvrirOnglet } from "./aide/equipe"
import { envoyer } from "./aide/envoi"
import { connecterParLien } from "./aide/navigation"
import { ajouterEpreuveEnBase, preparerSaison } from "./aide/session"

// Tâche 5.2 (suite) : Vivier, Prochaine épreuve et statistiques de la fiche, par clics depuis l'équipe. Une personne
// neuve est rookie : cinq épreuves la séparent de Confirmé, et son profil affiche les paliers par défaut (trophées
// coché). Au vivier, puis affectée à l'épreuve ; sa tâche liée se coche, et le texte le dit.

const SAISON = 2033

function tiroir(page: Page) {
  return page.getByRole("dialog")
}

test("Vivier, prochaine épreuve, statistiques : une personne au vivier, affectée à l'épreuve, sa tâche cochée", async ({ page, equipe }) => {
  test.setTimeout(300_000)
  const saisonId = await preparerSaison(equipe, SAISON)
  await ajouterEpreuveEnBase(equipe, saisonId, "Rallye écrans e2e", `${SAISON}-07-10`, `${SAISON}-07-11`)
  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 1440, height: 900 })

  // Fiche neuve : palier Rookie (onglet Profil), progression vers Confirmé (onglet Statistiques), trophées par défaut.
  await creerPersonne(page, "Bruno", "Vidal", "Assistance")
  await page.getByRole("button", { name: "Modifier le profil", exact: true }).click()
  await expect(tiroir(page).getByRole("checkbox", { name: "Afficher mes paliers et trophées dans l'équipe", exact: true })).toBeChecked()
  await page.keyboard.press("Escape")
  await expect(tiroir(page)).toHaveCount(0)
  await ouvrirOnglet(page, "Statistiques")
  await expect(page.getByText("5 épreuves avant Confirmé")).toBeVisible()

  // Vivier : une personne qu'on pourrait appeler pour un rôle, avec son intérêt.
  await page.goto("/apps/equipe/vivier")
  await expect(page.getByRole("heading", { name: "Vivier", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Ajouter au vivier", exact: true }).click()
  await tiroir(page).getByLabel("Personne", { exact: true }).selectOption({ label: "Bruno Vidal" })
  await tiroir(page).getByLabel("Rôle recherché", { exact: true }).selectOption({ label: "Logistique" })
  // Le libellé du champ inclut son texte d'aide (« Source D'où vient le nom… ») : on vise le début du libellé.
  await tiroir(page).getByLabel(/^Source/).fill("Un ami du club")
  await envoyer(page, tiroir(page).getByRole("button", { name: "Ajouter", exact: true }))
  await expect(page.getByText("Recherché : Logistique", { exact: false }).first()).toBeVisible()
  await expect(page.locator("li").filter({ hasText: "Bruno Vidal" })).toBeVisible()

  // Prochaine épreuve : affecter une personne crée une tâche liée, qu'on coche une fois faite.
  await page.goto("/apps/equipe/epreuve")
  await expect(page.getByRole("heading", { name: "Rallye écrans e2e", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Affecter une personne", exact: true }).click()
  await tiroir(page).getByLabel("Personne", { exact: true }).selectOption({ label: "Bruno Vidal" })
  await tiroir(page).getByLabel("Rôle d'épreuve", { exact: true }).selectOption({ label: "Logistique" })
  await envoyer(page, tiroir(page).getByRole("button", { name: "Affecter", exact: true }))
  // La ligne de tâche est le li sans li à l'intérieur : la carte de la personne qui la contient n'est pas visée.
  const tache = page.locator("li:not(:has(li))").filter({ hasText: "Logistique · à faire" })
  await expect(tache).toBeVisible()
  await tache.getByRole("button", { name: "Marquer fait", exact: true }).click()
  await expect(page.getByText("Logistique · fait")).toBeVisible()

  // Binômes : la page existe et répond, même sans engagement pilote et copilote.
  await page.goto("/apps/equipe/binomes")
  await expect(page.getByRole("heading", { name: "Binômes", exact: true })).toBeVisible()
})
