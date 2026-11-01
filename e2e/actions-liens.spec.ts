// Action à bouton-lien (tâche 5.6, §0) : le clic mène à l'écran, il ne décide pas l'action. L'action ne sort de la
// boîte qu'à la levée émise par l'app d'origine, comme pour les renouvellements d'Équipe et la réassignation de Check-lists.
import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { emettreEvenement, statutAction } from "./aide/session"

test("action-lien · le clic mène à l'écran sans décider, la levée fait sortir l'action de la boîte", async ({ page, equipe }) => {
  const cleUnicite = `e2e-lien-${equipe.horodatage}`
  emettreEvenement(equipe, "saison.action_requise", {
    type: "saison.confirmation_test",
    cleUnicite,
    titre: "Ouvrir la saison (test lien)",
    contexte: "Action à bouton-lien créée par le test de bout en bout.",
    destinataires: { roles: ["responsable"] },
    boutons: [{ cle: "voir", libelle: "Voir la saison", lien: "/apps/saison" }],
    priorite: 3,
  })
  await connecterParLien(page, equipe)

  await page.getByRole("button", { name: /Boîte d'actions/ }).click()
  const boite = page.getByRole("dialog")
  await expect(boite.getByRole("heading", { name: "Ouvrir la saison (test lien)" })).toBeVisible()

  await boite.getByRole("link", { name: "Voir la saison", exact: true }).click()
  await expect(page).toHaveURL(/\/apps\/saison$/)
  // Le clic n'a pas décidé l'action : elle reste en attente en base.
  await expect.poll(() => statutAction(equipe, cleUnicite)).toBe("en_attente")

  // La levée émise par l'app d'origine la fait sortir de la boîte.
  emettreEvenement(equipe, "saison.action_levee", { cleUnicite })
  await page.goto("/qg")
  await page.getByRole("button", { name: /Boîte d'actions/ }).click()
  await expect(page.getByText("Rien à décider. Profite de la route.")).toBeVisible()
  await expect.poll(() => statutAction(equipe, cleUnicite)).not.toBe("en_attente")
})
