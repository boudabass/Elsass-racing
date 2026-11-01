// Débrief (tâche 5.6, §1.6) : un point ajouté par clic pendant l'épreuve se reporte dans le modèle d'origine de sa liste,
// par « Ajouter au modèle ». L'épreuve commence aujourd'hui : un point créé maintenant est marqué « ajouté pendant l'épreuve ».
import { preparerEngagementChecklist } from "./aide/checklist"
import { envoyer } from "./aide/envoi"
import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { statutAction } from "./aide/session"

test("Check-lists · débrief : un point ajouté pendant l'épreuve part dans le modèle d'origine", async ({ page, equipe }) => {
  test.setTimeout(240_000)
  const { entryId } = await preparerEngagementChecklist(equipe, { commenceAujourdhui: true })
  await connecterParLien(page, equipe)

  // La proposition est acceptée : les listes de l'engagement viennent du modèle de la team.
  await page.getByRole("button", { name: /Boîte d'actions/ }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Accepter", exact: true }).click()
  await expect.poll(() => statutAction(equipe, `creer_listes:${entryId}`)).toBe("decidee")

  // Un point ajouté par clic dans cette liste, pendant l'épreuve.
  await page.goto("/apps/checklist")
  await page.getByRole("region", { name: "Par engagement" }).getByRole("link").first().click()
  await expect(page).toHaveURL(/\/apps\/checklist\/liste\/[^?]+$/)
  await page.getByRole("button", { name: "+ Ajouter un point", exact: true }).click()
  const ajout = page.getByRole("dialog")
  await ajout.getByLabel("Libellé du point", { exact: true }).fill("Point ajouté en épreuve")
  await envoyer(page, ajout.getByRole("button", { name: "Ajouter le point", exact: true }))
  await expect(page.locator("li").filter({ hasText: "Point ajouté en épreuve" })).toBeVisible()

  // Débrief : la ligne porte la mention ; « Ajouter au modèle » la reporte dans le modèle d'origine.
  await page.getByRole("link", { name: "Débrief", exact: true }).click()
  const ligne = page.locator("li").filter({ hasText: "Point ajouté en épreuve" })
  await expect(ligne.getByText(/Ajouté pendant l'épreuve/)).toBeVisible()
  await envoyer(page, ligne.getByRole("button", { name: "Ajouter au modèle", exact: true }))

  // Le modèle de la team porte le point.
  await page.goto("/apps/checklist/modeles")
  await page.getByRole("link", { name: "Modifier", exact: true }).first().click()
  await expect(page.getByText("Point ajouté en épreuve", { exact: true })).toBeVisible()
})
