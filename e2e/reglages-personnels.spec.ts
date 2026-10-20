import { expect, test } from "./aide/fixtures"
import { compterSuppressions, ajouterMembreConnectable } from "./aide/session"
import { connecterParLien } from "./aide/navigation"

test("affichage : le thème clair est enregistré, et déjà présent dans le HTML du serveur", async ({ page, equipe }) => {
  await connecterParLien(page, equipe)
  await page.goto("/apps/settings/affichage")

  await page.getByRole("button", { name: "Modifier l'affichage", exact: true }).click()
  const tiroir = page.getByRole("dialog")
  await tiroir.locator("#theme").selectOption("clair")
  await tiroir.getByRole("button", { name: "Enregistrer", exact: true }).click()
  await expect(tiroir).toHaveCount(0)

  // Le rendu serveur porte déjà la préférence : pas de flash sombre à l'arrivée.
  const reponse = await page.reload()
  const html = await reponse?.text()
  expect(html).toMatch(/<html[^>]*class="(?![^"]*\bdark\b)[^"]*"/)
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/)
  await page.getByRole("button", { name: "Modifier l'affichage", exact: true }).click()
  await expect(page.locator("#theme")).toHaveValue("clair")
})

test("appareils : déconnecter l'appareil courant ramène à la connexion", async ({ page, equipe }) => {
  await connecterParLien(page, equipe)
  await page.goto("/apps/settings/appareils")

  await expect(page.getByText("Cet appareil")).toBeVisible()
  await page.getByRole("button", { name: "Me déconnecter d'ici", exact: true }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Déconnecter", exact: true }).click()

  await page.waitForURL(/\/connexion$/)
  await page.goto("/qg")
  await expect(page).toHaveURL(/\/connexion/)
})

test("données : le dernier responsable ne peut pas supprimer son compte, un équipier le peut puis l'annule", async ({ browser, page, equipe }) => {
  // Le responsable seul dans sa team : la règle refuse, avec la raison, dans le tiroir.
  await connecterParLien(page, equipe)
  await page.goto("/apps/settings/donnees")
  await page.getByRole("button", { name: "Demander la suppression du compte", exact: true }).click()
  const tiroirResponsable = page.getByRole("dialog")
  await tiroirResponsable.getByPlaceholder("Ton adresse e-mail").fill(equipe.responsable.email)
  await tiroirResponsable.getByRole("button", { name: "Demander la suppression", exact: true }).click()
  await expect(tiroirResponsable.locator('p[role="alert"]')).toContainText("Nomme d'abord un autre responsable")
  expect(await compterSuppressions(equipe, "compte")).toEqual({ total: 0, annulees: 0 })

  // Un équipier, dans son propre navigateur : la demande part, puis elle est annulée.
  const equipier = await ajouterMembreConnectable(equipe, "equipage")
  const contexte = await browser.newContext()
  const pageEquipier = await contexte.newPage()
  try {
    await pageEquipier.goto(`/connexion/lien?t=${equipier.secretLien}`)
    await pageEquipier.waitForURL(/\/qg$/)
    await pageEquipier.goto("/apps/settings/donnees")

    await pageEquipier.getByRole("button", { name: "Demander la suppression du compte", exact: true }).click()
    const tiroirEquipier = pageEquipier.getByRole("dialog")
    await tiroirEquipier.getByPlaceholder("Ton adresse e-mail").fill(equipier.email)
    await tiroirEquipier.getByRole("button", { name: "Demander la suppression", exact: true }).click()

    await expect(tiroirEquipier).toHaveCount(0)
    await expect(pageEquipier.getByText("purge prévue le")).toBeVisible()
    expect(await compterSuppressions(equipe, "compte")).toEqual({ total: 1, annulees: 0 })

    await pageEquipier.getByRole("button", { name: "Annuler la demande", exact: true }).click()
    await expect(pageEquipier.getByText("purge prévue le")).toHaveCount(0)
    expect(await compterSuppressions(equipe, "compte")).toEqual({ total: 1, annulees: 1 })
  } finally {
    await contexte.close()
  }
})

test("mon compte : quitter la team est refusé au dernier responsable, avec la raison", async ({ page, equipe }) => {
  await connecterParLien(page, equipe)
  await page.goto("/apps/settings/compte")

  await page.getByRole("button", { name: "Quitter cette team", exact: true }).click()
  const tiroir = page.getByRole("dialog")
  await tiroir.getByRole("button", { name: "Quitter la team", exact: true }).click()

  await expect(tiroir.locator('p[role="alert"]')).toContainText("Nomme d'abord un autre responsable.")
  await expect(tiroir).toHaveCount(1)
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
