import type { Page } from "@playwright/test"

import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { ajouterVoitureDeCourse, compterEvenements, debriefsEnBase, preparerSaison, sortiesRecceEnBase } from "./aide/session"

// Saison hors ligne (tâche 2.4) : le programme s'affiche en mode avion, une sortie de reconnaissance
// saisie hors ligne part au retour du réseau. Ce fichier tourne sur le projet « hors-ligne » (serveur
// de production, port 3101) : seul endroit où le service worker existe.

const ANNEE = 2033

// Attend que le service worker contrôle la page (il prend le contrôle après le premier rechargement).
async function attendreServiceWorker(page: Page): Promise<void> {
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await page.evaluate(() => navigator.serviceWorker.ready)
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
}

test("saison hors ligne : le programme s'affiche en mode avion, une sortie de reco saisie hors ligne part au retour du réseau", async ({
  page,
  equipe,
  context,
}) => {
  test.setTimeout(240_000)
  await preparerSaison(equipe, ANNEE)
  await ajouterVoitureDeCourse(equipe)
  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 1440, height: 900 })

  // En ligne : une épreuve, une spéciale, les règles de la reconnaissance.
  await page.goto("/apps/saison/nouvelle")
  await page.getByLabel("Nom de l'épreuve").fill("Rallye hors ligne e2e")
  await page.getByLabel("Premier jour").fill(`${ANNEE}-05-10`)
  await page.getByLabel("Dernier jour").fill(`${ANNEE}-05-11`)
  await page.getByRole("button", { name: "Ajouter l'épreuve" }).click()
  await expect(page).toHaveURL(/\/apps\/saison\/epreuves\/[0-9a-f-]+/)
  const base = page.url().split("?")[0]

  await page.goto(`${base}?onglet=programme`)
  const formulaireSpeciale = page.locator("form", { has: page.getByRole("button", { name: "Ajouter la spéciale" }) })
  await formulaireSpeciale.locator("#numero").fill("1")
  await formulaireSpeciale.locator("#nom").fill("Spéciale hors ligne")
  await formulaireSpeciale.locator("#longueurKm").fill("12.5")
  await formulaireSpeciale.locator("#nbPassages").fill("2")
  await page.getByRole("button", { name: "Ajouter la spéciale" }).click()
  await expect(page.getByText("Spéciale hors ligne").first()).toBeVisible()

  await page.goto(`${base}?onglet=reconnaissances`)
  await page.getByRole("button", { name: "Enregistrer les règles" }).click()
  await expect(page.getByText("Enregistré.")).toBeVisible()

  // Le service worker prend le contrôle, puis les pages de l'épreuve sont visitées une fois en ligne :
  // elles sont alors mises en cache, avec leur paramètre d'onglet.
  await attendreServiceWorker(page)
  await page.goto(`${base}?onglet=programme`)
  await expect(page.getByText("Spéciale hors ligne").first()).toBeVisible()
  await page.goto(`${base}?onglet=reconnaissances`)
  await expect(page.getByRole("button", { name: "Ajouter la sortie" })).toBeVisible()

  // Hors ligne : le programme s'affiche depuis le cache et la base locale.
  await context.setOffline(true)
  await page.goto(`${base}?onglet=programme`)
  await expect(page.getByText("Spéciale hors ligne").first()).toBeVisible()

  // Une sortie de reco saisie hors ligne : affichée tout de suite, pas encore en base.
  await page.goto(`${base}?onglet=reconnaissances`)
  await page.locator("#date").fill(`${ANNEE}-05-10`)
  await page.getByLabel("1. Spéciale hors ligne").check()
  await page.getByRole("button", { name: "Ajouter la sortie" }).click()
  await expect(page.getByText("Enregistré sur cet appareil")).toBeVisible()
  await expect(page.getByText("Spéciales reconnues : 1. Spéciale hors ligne")).toBeVisible()
  expect(await sortiesRecceEnBase(equipe, `${ANNEE}-05-10`)).toBe(0)

  // Retour du réseau : la sortie part et arrive en base.
  await context.setOffline(false)
  await expect.poll(() => sortiesRecceEnBase(equipe, `${ANNEE}-05-10`), { timeout: 30_000 }).toBe(1)
})

// Débrief hors ligne (tâche 2.5, section 0) : l'engagement payé est « parti », sa fiche est mise en cache
// en ligne ; le débrief saisi sans réseau part au retour du réseau, une seule fois, avec son événement.
test("saison hors ligne : un débrief saisi sans réseau part au retour du réseau, avec son événement", async ({ page, equipe, context }) => {
  test.setTimeout(240_000)
  // Année passée : l'engagement devient « parti » quand l'épreuve est passée (statut calculé à partir de la date).
  await preparerSaison(equipe, 2025)
  await ajouterVoitureDeCourse(equipe)
  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 1440, height: 900 })

  await page.goto("/apps/saison/nouvelle")
  await page.getByLabel("Nom de l'épreuve").fill("Rallye débrief hors ligne e2e")
  await page.getByLabel("Premier jour").fill("2025-06-10")
  await page.getByLabel("Dernier jour").fill("2025-06-11")
  await page.getByRole("button", { name: "Ajouter l'épreuve" }).click()
  await expect(page).toHaveURL(/\/apps\/saison\/epreuves\/[0-9a-f-]+/)
  const base = page.url().split("?")[0]

  // Engagement payé d'une épreuve passée : il est parti, donc la fiche affiche le débrief.
  await page.goto(`${base}?onglet=engagements`)
  await page.getByLabel("Voiture").selectOption({ label: "Saxo test e2e" })
  await page.getByRole("button", { name: "Engager la voiture" }).click()
  await expect(page.getByText("Saxo test e2e").first()).toBeVisible()
  await page.getByRole("link", { name: /Saxo test e2e/ }).first().click()
  await page.getByLabel("Montant payé (€)").fill("450")
  await page.getByRole("button", { name: "Enregistrer le paiement" }).click()
  await expect(page.getByText("Enregistré.")).toBeVisible()
  const fiche = page.url().split("?")[0]
  const entryId = fiche.split("/").pop() ?? ""

  // En ligne, une fois : la fiche est mise en cache avec son formulaire de débrief.
  await attendreServiceWorker(page)
  await page.goto(fiche)
  await expect(page.getByRole("button", { name: "Ressenti 3 sur 5" })).toBeVisible()

  // Hors ligne : la fiche s'affiche, le débrief s'enregistre sur l'appareil, sans encore être en base.
  await context.setOffline(true)
  await page.goto(fiche)
  await page.getByLabel("Points positifs").fill("Bon départ")
  await page.getByRole("button", { name: "Ressenti 3 sur 5" }).click()
  await expect(page.getByText("Enregistré. Le débrief part")).toBeVisible()
  await expect(page.getByRole("button", { name: "Ressenti 3 sur 5" })).toHaveAttribute("aria-pressed", "true")
  expect(await debriefsEnBase(equipe, entryId)).toBe(0)

  // Retour du réseau : le débrief arrive en base, et son événement est émis une seule fois.
  await context.setOffline(false)
  await expect.poll(() => debriefsEnBase(equipe, entryId), { timeout: 30_000 }).toBe(1)
  await expect.poll(() => compterEvenements(equipe, "saison.debrief_saisi"), { timeout: 30_000 }).toBe(1)
})

// Captures : onglets Prêt pour l'épreuve et Reconnaissances, en PC et en téléphone (réseau revenu).
test("captures de la préparation et des reconnaissances de Saison", async ({ page, equipe }) => {
  await preparerSaison(equipe, ANNEE + 1)
  await connecterParLien(page, equipe)
  await page.goto("/apps/saison/nouvelle")
  await page.getByLabel("Nom de l'épreuve").fill("Rallye captures e2e")
  await page.getByLabel("Premier jour").fill(`${ANNEE + 1}-05-10`)
  await page.getByLabel("Dernier jour").fill(`${ANNEE + 1}-05-11`)
  await page.getByRole("button", { name: "Ajouter l'épreuve" }).click()
  await expect(page).toHaveURL(/\/apps\/saison\/epreuves\/[0-9a-f-]+/)
  const base = page.url().split("?")[0]

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${base}?onglet=pret`)
  await page.screenshot({ path: "docs/captures/saison-pret-1440x900.png", fullPage: true })
  await page.goto(`${base}?onglet=reconnaissances`)
  await page.screenshot({ path: "docs/captures/saison-reconnaissances-1440x900.png", fullPage: true })

  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto(`${base}?onglet=pret`)
  await page.screenshot({ path: "docs/captures/saison-pret-360x740.png", fullPage: true })
  await page.goto(`${base}?onglet=reconnaissances`)
  await page.screenshot({ path: "docs/captures/saison-reconnaissances-360x740.png", fullPage: true })
})
