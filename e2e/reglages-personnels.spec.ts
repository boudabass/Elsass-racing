import { expect, test } from "./aide/fixtures"
import { compterSuppressions, ajouterMembreConnectable } from "./aide/session"
import { connecterParLien } from "./aide/navigation"

test("affichage : le thème clair est enregistré, et déjà présent dans le HTML du serveur", async ({ page, equipe }) => {
  await connecterParLien(page, equipe)
  await page.goto("/apps/settings/affichage")

  const formulaire = page.locator("form", { has: page.locator("#theme") })
  await formulaire.locator("#theme").selectOption("clair")
  await formulaire.getByRole("button", { name: "Enregistrer" }).click()
  await page.waitForURL(/ok=1$/)

  // Le rendu serveur porte déjà la préférence : pas de flash sombre à l'arrivée.
  const reponse = await page.reload()
  const html = await reponse?.text()
  expect(html).toMatch(/<html[^>]*class="(?![^"]*\bdark\b)[^"]*"/)
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/)
  await expect(page.locator("#theme")).toHaveValue("clair")
})

test("appareils : déconnecter l'appareil courant ramène à la connexion", async ({ page, equipe }) => {
  await connecterParLien(page, equipe)
  await page.goto("/apps/settings/appareils")

  await expect(page.getByText("Cet appareil")).toBeVisible()
  await page.getByRole("button", { name: "Me déconnecter d'ici" }).click()

  await page.waitForURL(/\/connexion$/)
  await page.goto("/qg")
  await expect(page).toHaveURL(/\/connexion/)
})

test("données : le dernier responsable ne peut pas supprimer son compte, un équipier le peut puis l'annule", async ({ browser, page, equipe }) => {
  // Le responsable seul dans sa team : la règle refuse, avec la raison.
  await connecterParLien(page, equipe)
  await page.goto("/apps/settings/donnees")
  const formulaireResponsable = page.locator("form", { has: page.locator('input[name="portee"][value="compte"]') })
  await formulaireResponsable.getByPlaceholder("Ton adresse e-mail").fill(equipe.responsable.email)
  await formulaireResponsable.getByRole("button", { name: "Demander la suppression du compte" }).click()
  await expect(page.locator('p[role="alert"]')).toContainText("Nomme d'abord un autre responsable")
  expect(await compterSuppressions(equipe, "compte")).toEqual({ total: 0, annulees: 0 })

  // Un équipier, dans son propre navigateur : la demande part, puis elle est annulée.
  const equipier = await ajouterMembreConnectable(equipe, "equipage")
  const contexte = await browser.newContext()
  const pageEquipier = await contexte.newPage()
  try {
    await pageEquipier.goto(`/connexion/lien?t=${equipier.secretLien}`)
    await pageEquipier.waitForURL(/\/qg$/)
    await pageEquipier.goto("/apps/settings/donnees")

    const formulaire = pageEquipier.locator("form", { has: pageEquipier.locator('input[name="portee"][value="compte"]') })
    await formulaire.getByPlaceholder("Ton adresse e-mail").fill(equipier.email)
    await formulaire.getByRole("button", { name: "Demander la suppression du compte" }).click()

    await expect(pageEquipier.getByText("purge prévue le")).toBeVisible()
    expect(await compterSuppressions(equipe, "compte")).toEqual({ total: 1, annulees: 0 })

    await pageEquipier.getByRole("button", { name: "Annuler la demande" }).click()
    await expect(pageEquipier.getByText("purge prévue le")).toHaveCount(0)
    expect(await compterSuppressions(equipe, "compte")).toEqual({ total: 1, annulees: 1 })
  } finally {
    await contexte.close()
  }
})

test("mon compte : quitter la team est refusé au dernier responsable, avec la raison", async ({ page, equipe }) => {
  await connecterParLien(page, equipe)
  await page.goto("/apps/settings/compte")

  await page.getByRole("button", { name: "Quitter cette team" }).click()

  await expect(page.locator('p[role="alert"]')).toContainText("Nomme d'abord un autre responsable.")
  await expect(page).toHaveURL(/\/apps\/settings\/compte\?erreur=/)
})

test("assistance : les rubriques personnelles sont ouvertes, celles de la team sont refusées", async ({ browser, equipe }) => {
  const assistance = await ajouterMembreConnectable(equipe, "assistance")
  const contexte = await browser.newContext()
  const page = await contexte.newPage()
  try {
    await page.goto(`/connexion/lien?t=${assistance.secretLien}`)
    await page.waitForURL(/\/qg$/)

    await page.goto("/apps/settings/notifications")
    await expect(page.getByRole("heading", { name: "Notifications", exact: true })).toBeVisible()

    await page.goto("/apps/settings/identite")
    await expect(page.getByText("Cette rubrique est réservée à la team")).toBeVisible()
  } finally {
    await contexte.close()
  }
})
