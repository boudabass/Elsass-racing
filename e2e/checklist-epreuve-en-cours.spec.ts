// Épreuve en cours (rallye de plusieurs jours) : Check-lists la garde dans Préparation, et le Débrief ne la prend pas.
// Régression de la tâche 5.8 : Préparation filtrait sur le début, et l'épreuve disparaissait au deuxième jour.
import { preparerEpreuveChecklist } from "./aide/checklist"
import { jourParis } from "./aide/dates"
import { expect, test } from "./aide/fixtures"
import { connecterParLien, tuilesDuQg } from "./aide/navigation"
import { passerEpreuveDansLePasseEnBase } from "./aide/session"

test("Check-lists · épreuve commencée hier et finie demain : dans Préparation, pas dans le Débrief", async ({ page, equipe }) => {
  // Le helper crée l'épreuve et la pose à partir de debutDans ; le rallye dure ici trois jours, commencé hier.
  const { eventId } = await preparerEpreuveChecklist(equipe, { debutDans: -1 })
  // Dates posées par le test (passerEpreuveDansLePasseEnBase ne fait que fixer début et fin) : hier, demain.
  await passerEpreuveDansLePasseEnBase(equipe, eventId, jourParis(-1), jourParis(1))
  const nom = `Rallye Check-lists ${equipe.horodatage}`

  await connecterParLien(page, equipe)
  await tuilesDuQg(page)
    .filter({ has: page.getByRole("heading", { name: "Check-lists", exact: true }) })
    .click()

  // Préparation : l'épreuve en cours est dans la barre « Épreuves », et c'est la prochaine.
  await expect(page.getByRole("navigation", { name: "Épreuves" }).getByRole("link", { name: nom, exact: true })).toBeVisible()

  // Débrief : la même épreuve n'y apparaît pas, ni dans la liste des épreuves ni comme épreuve affichée.
  await page.getByRole("navigation", { name: "Menu de Check-lists" }).getByRole("link", { name: "Débrief", exact: true }).click()
  await expect(page).toHaveURL(/\/apps\/checklist\/debrief/)
  await expect(page.getByRole("link", { name: nom, exact: true })).toHaveCount(0)
})
