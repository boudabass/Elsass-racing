import { expect, test } from "./aide/fixtures"
import { ajouterEquipier, droitEnBase } from "./aide/session"
import { connecterParLien } from "./aide/navigation"

test("f. droits : une exception est écrite sur la fiche du membre, puis retour aux droits du rôle", async ({ page, equipe }) => {
  const equipier = await ajouterEquipier(equipe)
  await connecterParLien(page, equipe)
  await page.goto("/apps/settings/droits")

  // La carte du membre est la section la plus interne qui porte son nom (la rubrique est aussi une section).
  const carte = page
    .locator("section", { has: page.getByRole("heading", { name: equipier.email, exact: true }) })
    .filter({ hasNot: page.locator("section") })

  await carte.getByRole("button", { name: "Modifier les droits", exact: true }).click()
  const tiroir = page.getByRole("dialog")
  const budget = tiroir.locator('select[name="niveau_budget"]')
  const valeurDuRole = await budget.inputValue()
  const nouvelleValeur = valeurDuRole === "lecture" ? "contribution" : "lecture"

  await budget.selectOption(nouvelleValeur)
  await tiroir.getByRole("button", { name: "Enregistrer les droits", exact: true }).click()
  await expect(tiroir).toHaveCount(0)

  // Après enregistrement, l'écart au rôle est écrit sur la fiche, pas seulement surligné.
  await expect(carte.locator("dd", { hasText: "exception" })).toHaveCount(1)
  expect(await droitEnBase(equipier, "budget")).toBe(nouvelleValeur)

  await carte.getByRole("button", { name: "Revenir aux droits du rôle", exact: true }).click()
  await expect(carte.locator("dd", { hasText: "exception" })).toHaveCount(0)
  await expect(carte.getByRole("button", { name: "Revenir aux droits du rôle", exact: true })).toHaveCount(0)
})
