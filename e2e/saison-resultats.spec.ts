import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { ajouterMembreConnectable, ajouterVoitureDeCourse, donnerAccesSaison, preparerSaison, statutAction, type Membre } from "./aide/session"
import type { Equipe } from "./aide/session"
import type { Browser, Page } from "@playwright/test"

// Résultats, débrief, historique et clôture de Saison (tâche 2.3). Un seul scénario, dans l'ordre
// réel : le responsable crée l'épreuve et engage la voiture ; un équipier saisit le résultat ;
// il ne peut pas le valider ; un autre équipier le valide depuis la boîte ; le débrief ; l'assistance
// ne voit ni débrief ni boutons ; la saison est clôturée et n'accepte plus d'écriture.

const ANNEE = 2025

async function connecterMembre(browser: Browser, membre: Membre & { secretLien: string }): Promise<{ page: Page; fermer: () => Promise<void> }> {
  const contexte = await browser.newContext()
  const page = await contexte.newPage()
  await page.goto(`/connexion/lien?t=${membre.secretLien}`)
  await page.waitForURL(/\/qg$/)
  return { page, fermer: () => contexte.close() }
}

test("k. saison : saisie par l'équipage, validation par un autre membre, débrief, clôture", async ({ browser, page, equipe }) => {
  test.setTimeout(240_000)
  await preparerSaison(equipe, ANNEE)
  await ajouterVoitureDeCourse(equipe)
  const equipierA = await ajouterMembreConnectable(equipe, "equipage")
  const equipierB = await ajouterMembreConnectable(equipe, "equipage", "-b")
  const assistance = await ajouterMembreConnectable(equipe, "assistance")
  await donnerAccesSaison(equipe, equipierA, "ecriture")
  await donnerAccesSaison(equipe, equipierB, "ecriture")
  await donnerAccesSaison(equipe, assistance, "lecture")

  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 1440, height: 900 })

  // Épreuve passée, engagement d'une voiture.
  await page.goto("/apps/saison/nouvelle")
  await page.getByLabel("Nom de l'épreuve").fill("Rallye résultats e2e")
  await page.getByLabel("Premier jour").fill(`${ANNEE}-05-10`)
  await page.getByLabel("Dernier jour").fill(`${ANNEE}-05-11`)
  await page.getByRole("button", { name: "Ajouter l'épreuve" }).click()
  await expect(page).toHaveURL(/\/apps\/saison\/epreuves\/[0-9a-f-]+/)
  const fiche = page.url()

  // Les filtres s'appliquent dès le changement de liste, sans bouton.
  await page.goto("/apps/saison")
  await page.getByLabel("Type").selectOption("rallye")
  await expect(page).toHaveURL(/type=rallye/)
  await expect(page.getByRole("button", { name: "Filtrer" })).toHaveCount(0)

  await page.goto(`${fiche}?onglet=engagements`)
  await page.getByRole("button", { name: "Engager une voiture", exact: true }).click()
  await page.getByLabel("Voiture").selectOption({ label: "Saxo test e2e" })
  await page.getByRole("dialog").getByRole("button", { name: "Engager la voiture", exact: true }).click()
  await expect(page.getByText("Saxo test e2e").first()).toBeVisible()

  // Un engagement sans dossier ni paiement reste « envisagé » : on enregistre le paiement, puis le résultat
  // se saisit (l'épreuve étant passée, l'engagement est parti).
  await page.getByRole("link", { name: /Saxo test e2e/ }).first().click()
  await page.getByRole("button", { name: "Enregistrer un paiement", exact: true }).click()
  await page.getByLabel("Montant payé (€)").fill("450")
  await page.getByRole("dialog").getByRole("button", { name: "Enregistrer le paiement", exact: true }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.goto(`${fiche}?onglet=resultats`)

  // A saisit le résultat : il ne peut pas le valider lui-même.
  const a = await connecterMembre(browser, equipierA)
  try {
    await a.page.goto(`${fiche}?onglet=resultats`)
    await a.page.getByRole("button", { name: /^(Saisir|Modifier) le résultat$/ }).click()
    await a.page.getByLabel("Classement de classe").fill("2")
    await a.page.getByRole("dialog").getByRole("button", { name: "Enregistrer le résultat", exact: true }).click()
    await expect(a.page.getByRole("dialog")).toHaveCount(0)
    await expect(a.page.getByRole("button", { name: "Valider", exact: true })).toHaveCount(0)
    await expect(a.page.getByText("Un autre membre doit valider ce résultat.")).toBeVisible()
  } finally {
    await a.fermer()
  }

  // B valide depuis la page « Résultats à valider ».
  const b = await connecterMembre(browser, equipierB)
  let adresseEngagement = ""
  try {
    await b.page.goto("/apps/saison/a-valider")
    await expect(b.page.locator("main").getByRole("link", { name: /Rallye résultats e2e/ })).toBeVisible()
    await b.page.getByRole("button", { name: "Valider", exact: true }).click()
    // La ligne quitte la liste une fois validée (la liste est rafraîchie).
    await expect(b.page.locator("main").getByRole("link", { name: /Rallye résultats e2e/ })).toHaveCount(0)
    await b.page.goto(`${fiche}?onglet=resultats`)
    await expect(b.page.getByText(/Validé/).first()).toBeVisible()
    adresseEngagement = (await b.page.getByRole("link", { name: "Ouvrir l'engagement" }).first().getAttribute("href")) ?? ""
    expect(adresseEngagement).toMatch(/\/apps\/saison\/engagements\//)
    const cle = `resultat_a_valider:${adresseEngagement.split("/").pop()}`
    expect(await statutAction(equipe, cle)).not.toBe("en_attente")

    // Débrief : le ressenti est un bouton, puis le bloc de fin d'épreuve est là.
    await b.page.goto(adresseEngagement)
    await expect(b.page.getByRole("heading", { name: "Débrief de l'épreuve" })).toBeVisible()
    await b.page.getByRole("button", { name: /^(Ajouter|Modifier) mon débrief$/ }).click()
    await b.page.getByRole("button", { name: "Ressenti 4 sur 5" }).click()
    await b.page.getByRole("dialog").getByRole("button", { name: "Enregistrer le débrief", exact: true }).click()
    await expect(b.page.getByText("Enregistré. Le débrief part")).toBeVisible()
  } finally {
    await b.fermer()
  }

  // L'assistance voit le résultat, sans boutons d'écriture, sans débrief.
  const assist = await connecterMembre(browser, assistance)
  try {
    await assist.page.goto(`${fiche}?onglet=resultats`)
    await expect(assist.page.getByText(/Validé/).first()).toBeVisible()
    await expect(assist.page.getByRole("button", { name: "Enregistrer le résultat" })).toHaveCount(0)
    await expect(assist.page.getByRole("button", { name: "Valider", exact: true })).toHaveCount(0)
    await expect(assist.page.getByRole("button", { name: "Contester" })).toHaveCount(0)
    await assist.page.goto(adresseEngagement)
    await expect(assist.page.getByText("Ressenti", { exact: false })).toHaveCount(0)
    await expect(assist.page.getByText("Points positifs")).toHaveCount(0)
    await expect(assist.page.getByRole("button", { name: "Enregistrer le paiement" })).toHaveCount(0)
  } finally {
    await assist.fermer()
  }

  // Responsable : historique, clôture de la saison, puis refus d'écriture.
  await page.goto("/apps/saison/historique")
  await expect(page.getByRole("heading", { name: "Historique" })).toBeVisible()
  await page.screenshot({ path: "docs/captures/saison-historique-1440x900.png", fullPage: true })
  await page.getByRole("button", { name: "Clôturer la saison" }).click()
  await page.getByRole("button", { name: "Confirmer la clôture" }).click()
  // La carte passe à « Clôturée » (le bouton disparaît avec le rafraîchissement).
  await expect(page.getByText(/Clôturée/).first()).toBeVisible()

  await page.goto("/apps/saison/nouvelle")
  await page.getByLabel("Nom de l'épreuve").fill("Épreuve refusée")
  await page.getByLabel("Premier jour").fill(`${ANNEE}-07-01`)
  await page.getByLabel("Dernier jour").fill(`${ANNEE}-07-02`)
  await page.getByRole("button", { name: "Ajouter l'épreuve" }).click()
  await expect(page.getByRole("alert").filter({ hasText: "Aucune saison ouverte" })).toBeVisible()

  // Captures : onglet Résultats et page « à valider », en téléphone et en PC.
  await page.goto(`${fiche}?onglet=resultats`)
  await page.screenshot({ path: "docs/captures/saison-resultats-1440x900.png", fullPage: true })
  await page.setViewportSize({ width: 360, height: 740 })
  await page.screenshot({ path: "docs/captures/saison-resultats-360x740.png", fullPage: true })
  await page.goto("/apps/saison/historique")
  await page.screenshot({ path: "docs/captures/saison-historique-360x740.png", fullPage: true })
  await page.goto("/apps/saison/a-valider")
  await page.screenshot({ path: "docs/captures/saison-a-valider-360x740.png", fullPage: true })
})
