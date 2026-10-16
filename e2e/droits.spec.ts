import { expect, test } from "./aide/fixtures"
import { ajouterEquipier, droitEnBase } from "./aide/session"
import { connecterParLien } from "./aide/navigation"

test("f. droits : écart surligné pour un membre, puis retour aux droits du rôle", async ({ page, equipe }) => {
  const equipier = await ajouterEquipier(equipe)
  await connecterParLien(page, equipe)
  await page.goto("/apps/settings/droits")

  // La carte du membre est la section la plus interne qui porte son nom (la rubrique est aussi une section).
  const carte = page
    .locator("section", { has: page.getByRole("heading", { name: equipier.email, exact: true }) })
    .filter({ hasNot: page.locator("section") })
  const budget = carte.locator('select[name="niveau_budget"]')
  const valeurDuRole = await budget.inputValue()
  const nouvelleValeur = valeurDuRole === "lecture" ? "contribution" : "lecture"

  await budget.selectOption(nouvelleValeur)
  await carte.getByRole("button", { name: "Enregistrer" }).click()

  // Après enregistrement, la case diffère du défaut du rôle : elle est surlignée.
  await expect(carte.locator('select[name="niveau_budget"]')).toHaveValue(nouvelleValeur)
  await expect(carte.locator('select[name="niveau_budget"]').locator("xpath=..")).toHaveClass(/ring-1/)
  expect(await droitEnBase(equipier, "budget")).toBe(nouvelleValeur)

  await carte.getByRole("button", { name: "Revenir aux droits du rôle" }).click()
  // Sans rechargement : la valeur affichée doit suivre le retour au rôle.
  await page.waitForURL(/\?ok=1$/)
  await expect(carte.locator('select[name="niveau_budget"]')).toHaveValue(valeurDuRole)
  await expect(carte.locator('select[name="niveau_budget"]').locator("xpath=..")).not.toHaveClass(/ring-1/)
  await expect(carte.getByRole("button", { name: "Revenir aux droits du rôle" })).toHaveCount(0)
})
