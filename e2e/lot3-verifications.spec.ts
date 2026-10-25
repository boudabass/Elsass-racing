// Vérifications du lot 3 demandées en brief 3.9, §5 : l'historique de la Saxo, les papiers qui montent dans l'indice
// de préparation, et un résultat annulé qui disparaît de la page partenaire. Les données de départ sont écrites en
// base (comme dans lot3-parcours) ; chaque contrôle se lit à l'écran.
import type { Page } from "@playwright/test"

import { envoyer } from "./aide/envoi"
import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { noterJetonDeTest, preparerPageDePartenaire, type PageDePartenaire } from "./aide/partenaire-page"
import {
  ajouterEpreuveEnBase,
  ajouterPapierEnBase,
  ajouterResultatValideEnBase,
  ajouterSpecialeEnBase,
  ajouterVoitureSaxo,
  creerEquipe,
  engagerVehiculeEnBase,
  idEpreuveParNomEnBase,
  passerEpreuveDansLePasseEnBase,
  preparerSaison,
  statutEpreuveEnBase,
  supprimerEquipe,
  type Equipe,
} from "./aide/session"

// Jour civil (AAAA-MM-JJ) à Paris, à un nombre de jours d'aujourd'hui. On compte en jours du calendrier, pas en 24 h × n :
// le changement d'heure fait tomber 72 h à minuit Paris sur la veille.
function jourDans(jours: number): string {
  const [annee, mois, jour] = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(new Date()).split("-").map(Number)
  return new Date(Date.UTC(annee, mois - 1, jour + jours)).toISOString().slice(0, 10)
}

// Crée un lien de page partenaire par l'interface ; renvoie le jeton, affiché une seule fois (comme partenaire-page.spec).
async function creerLien(page: Page, partenaireId: string): Promise<string> {
  await page.goto(`/apps/partenaires/${partenaireId}?onglet=page`)
  await page.getByRole("button", { name: "Créer le lien", exact: true }).click()
  const zone = page.getByRole("status").filter({ hasText: "Copie-le maintenant" })
  await expect(zone).toBeVisible()
  const jeton = (await zone.locator(".font-mono").textContent())?.match(/\/p\/([A-Za-z0-9_-]{43})$/)?.[1] ?? ""
  expect(jeton).toHaveLength(43)
  noterJetonDeTest(jeton)
  return jeton
}

// 1. Historique de la Saxo : l'épreuve terminée y figure, et ses km de spéciale comptent dans le cumul (2 × 12,4 + 8).
test("historique Voiture : une épreuve terminée avec un résultat validé compte ses km de spéciale", async ({ page, equipe }) => {
  const annee = new Date().getFullYear()
  const saisonId = await preparerSaison(equipe, annee)
  const vehiculeId = await ajouterVoitureSaxo(equipe, "Saxo historique")
  const epreuveId = await ajouterEpreuveEnBase(equipe, saisonId, "Rallye historique", `${annee}-12-01`, `${annee}-12-02`)
  const entreeId = await engagerVehiculeEnBase(equipe, epreuveId, vehiculeId)
  await ajouterResultatValideEnBase(equipe, entreeId, 12)
  await ajouterSpecialeEnBase(equipe, epreuveId, 1, "ES 1", 12.4, 2)
  await ajouterSpecialeEnBase(equipe, epreuveId, 2, "ES 2", 8, 1)
  // L'épreuve a eu lieu : ses dates passent, et le QG la passe à « terminée ».
  await passerEpreuveDansLePasseEnBase(equipe, epreuveId, `${annee}-03-01`, `${annee}-03-02`)
  await connecterParLien(page, equipe)
  await page.goto("/qg")
  await expect.poll(() => statutEpreuveEnBase(equipe, epreuveId), { timeout: 30_000 }).toBe("terminee")

  await page.goto(`/apps/voiture/vehicules/${vehiculeId}?onglet=historique`)
  await expect(page.getByRole("link", { name: /Rallye historique/ })).toBeVisible()
  await expect(page.getByText("32,8 km de spéciale", { exact: true })).toBeVisible()
})

// 2. Papiers (5.2b) : une assurance qui expire dans 20 jours, avant une épreuve dans 60 jours, ouvre le point « Papiers »
// de « Prêt pour l'épreuve ? » ; « Régler » mène à l'onglet Papiers de la fiche Voiture ; un renouvellement saisi par
// clics ferme le point. Le point se lit chez Voiture à la date de l'épreuve, sans signal.
test("papiers : une assurance qui expire avant la prochaine épreuve ouvre « Papiers » ; Régler mène à Voiture ; le renouvellement ferme le point", async ({ page, equipe }) => {
  const saisonId = await preparerSaison(equipe, new Date().getFullYear())
  const vehiculeId = await ajouterVoitureSaxo(equipe, "Saxo papiers")
  const epreuveId = await ajouterEpreuveEnBase(equipe, saisonId, "Rallye des papiers", jourDans(60), jourDans(61))
  await engagerVehiculeEnBase(equipe, epreuveId, vehiculeId)
  await ajouterPapierEnBase(equipe, vehiculeId, "assurance", jourDans(20))
  await connecterParLien(page, equipe)
  await page.goto(`/apps/saison/epreuves/${epreuveId}?onglet=pret`)

  const engagement = page.locator("article").filter({ has: page.getByRole("heading", { name: "Saxo papiers", exact: true }) })
  await expect(engagement.locator("li").filter({ hasText: "Papiers" })).toContainText("Ouvert", { timeout: 30_000 })

  // « Régler » mène à l'onglet Papiers de la fiche du véhicule.
  await engagement.locator("li").filter({ hasText: "Papiers" }).getByRole("link", { name: "Régler", exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/apps/voiture/vehicules/${vehiculeId}\\?onglet=papiers$`))

  // Le renouvellement, saisi par clics : une assurance valable après l'épreuve. Le point se ferme au retour dans Saison.
  await page.getByText("Ajouter un papier").click()
  await page.getByRole("dialog").locator('select[name="type"]').selectOption("assurance")
  await page.getByRole("dialog").locator('input[name="valableJusquAu"]').fill(jourDans(365))
  await envoyer(page, page.getByRole("button", { name: "Ajouter le papier", exact: true }))

  await page.goto(`/apps/saison/epreuves/${epreuveId}?onglet=pret`)
  await expect(engagement.locator("li").filter({ hasText: "Papiers" })).toContainText("Réglé", { timeout: 30_000 })
})

// 3. Résultat annulé : un résultat validé, visible sur la page partenaire, disparaît quand il est contesté dans Saison.
test("résultat annulé : il disparaît de la page partenaire", async ({ browser, page, equipe }) => {
  const autreTeam: Equipe = await creerEquipe()
  try {
    const donnees: PageDePartenaire = await preparerPageDePartenaire(equipe, autreTeam)
    await connecterParLien(page, equipe)
    const jeton = await creerLien(page, donnees.partenaireA)

    const visiteur = await browser.newContext()
    try {
      const vue = await visiteur.newPage()
      await vue.goto(`/p/${jeton}`)
      await expect(vue.getByText("Espace partenaire de Garage Alpha")).toBeVisible()
      // Le classement est la marque du résultat : le nom de l'épreuve figure aussi au calendrier.
      await expect(vue.getByText("Au général : 3")).toBeVisible()

      const epreuveId = await idEpreuveParNomEnBase(equipe, "Rallye public de test")
      expect(epreuveId).not.toBeNull()
      await page.goto(`/apps/saison/epreuves/${epreuveId}?onglet=resultats`)
      await page.getByRole("button", { name: "Contester", exact: true }).click()
      await page.getByLabel("Pourquoi contester ce résultat", { exact: true }).fill("Résultat annulé pour le test")
      await page.getByRole("dialog").getByRole("button", { name: "Envoyer la contestation", exact: true }).click()
      await page.waitForLoadState("networkidle")

      await vue.reload()
      await expect(vue.getByText("Espace partenaire de Garage Alpha")).toBeVisible()
      await expect(vue.getByText("Au général : 3")).toHaveCount(0)
    } finally {
      await visiteur.close()
    }
  } finally {
    await supprimerEquipe(autreTeam)
  }
})
