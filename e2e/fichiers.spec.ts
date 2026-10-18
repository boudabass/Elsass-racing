import { readFileSync } from "node:fs"
import path from "node:path"

import type { Browser, BrowserContext, Page } from "@playwright/test"

import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import {
  ajouterMembreConnectable,
  ajouterVoitureDeCourse,
  creerEquipe,
  definirAccesBudget,
  depenseBudgetParLibelle,
  justificatifDepenseEnBase,
  logoEquipeEnBase,
  preparerSaison,
  supprimerEquipe,
  type Equipe,
} from "./aide/session"

// Fichiers (tâche 3.1 : logo, ticket de dépense, preuve de résultat). Les fixtures sont dans e2e/fichiers/.
// Les captures sortent dans docs/captures/ comme les autres scénarios.
const PHOTO = path.resolve("e2e/fichiers/photo.jpg")
const PREUVE = path.resolve("e2e/fichiers/preuve.pdf")
const FAUX_JPG = path.resolve("e2e/fichiers/faux.jpg")
const DOSSIER = path.resolve("docs/captures")

// Ouvre une session pour un autre membre (lien de connexion), dans son propre contexte.
async function connecterMembre(browser: Browser, secretLien: string): Promise<BrowserContext> {
  const contexte = await browser.newContext()
  const page = await contexte.newPage()
  await page.goto(`/connexion/lien?t=${secretLien}`)
  await page.waitForURL(/\/qg$/)
  await page.close()
  return contexte
}

// Dépense en ligne avec une photo de ticket. Renvoie l'identifiant de la dépense et celui du fichier.
async function depenseAvecTicket(page: Page, equipe: Equipe): Promise<{ depenseId: string; ticketId: string }> {
  await page.goto("/apps/budget/nouvelle")
  await page.getByLabel("Montant (€)").fill("18,40")
  await page.getByLabel("Catégorie", { exact: true }).selectOption({ label: "Péages" })
  await page.getByLabel("Photo du ticket (facultatif)").setInputFiles(PHOTO)
  await expect(page.locator('form img[src^="/api/fichiers/"]')).toBeVisible()
  await page.getByRole("button", { name: "Ajouter la dépense" }).click()
  await expect(page.getByText("Enregistré. La dépense part")).toBeVisible()

  await expect.poll(() => depenseBudgetParLibelle(equipe, "Péages")).not.toBeNull()
  const depense = (await depenseBudgetParLibelle(equipe, "Péages"))!
  await expect.poll(() => justificatifDepenseEnBase(equipe, depense.id)).not.toBeNull()
  const ticketId = (await justificatifDepenseEnBase(equipe, depense.id))!
  return { depenseId: depense.id, ticketId }
}

test("l. logo : envoyé dans Identité, affiché dans la barre haute, puis retiré", async ({ browser, page, equipe }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await connecterParLien(page, equipe)
  await page.goto("/apps/settings/identite")

  const formulaire = page.locator("form", { has: page.locator("#couleurPrincipale") })
  await formulaire.getByLabel("Logo de la team").setInputFiles(PHOTO)
  await expect(formulaire.locator('img[src^="/api/fichiers/"]').first()).toBeVisible()
  await formulaire.getByRole("button", { name: "Enregistrer", exact: true }).click()
  await page.waitForURL(/ok=1/)

  await expect(page.locator('header img[src^="/api/fichiers/"]')).toBeVisible()
  await expect.poll(() => logoEquipeEnBase(equipe)).not.toBeNull()
  // La rubrique se rend après le rechargement : on attend son titre et le champ du logo avant la capture.
  await expect(page.getByRole("heading", { name: "Identité" })).toBeVisible()
  await expect(page.getByText("Logo de la team")).toBeVisible()
  await page.screenshot({ path: path.join(DOSSIER, "fichiers-identite-1440x900.png"), fullPage: true })

  // Un membre assistance n'a aucun accès à Réglages : il voit quand même le logo courant de sa team.
  const assistance = await ajouterMembreConnectable(equipe, "assistance", "-logo")
  const contexteAssistance = await connecterMembre(browser, assistance.secretLien)
  try {
    const pageAssistance = await contexteAssistance.newPage()
    await pageAssistance.goto("/qg")
    const logoAssistance = pageAssistance.locator('header img[src^="/api/fichiers/"]')
    await expect(logoAssistance).toBeVisible()
    const source = await logoAssistance.getAttribute("src")
    const reponse = await contexteAssistance.request.get(source!)
    expect(reponse.status()).toBe(200)
  } finally {
    await contexteAssistance.close()
  }

  // Retrait : le logo part avec l'enregistrement, et l'icône QG revient dans la barre.
  await page.goto("/apps/settings/identite")
  const formulaireRetrait = page.locator("form", { has: page.locator("#couleurPrincipale") })
  await formulaireRetrait.getByRole("button", { name: "Retirer le logo" }).click()
  await formulaireRetrait.getByRole("button", { name: "Enregistrer", exact: true }).click()
  await page.waitForURL(/ok=1/)

  await expect(page.locator('header img[src^="/api/fichiers/"]')).toHaveCount(0)
  await expect.poll(() => logoEquipeEnBase(equipe)).toBeNull()
})

test("l. ticket : photo jointe à une dépense en ligne, relue dans la fiche, servie en image/jpeg", async ({ page, equipe }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await connecterParLien(page, equipe)
  const { depenseId, ticketId } = await depenseAvecTicket(page, equipe)

  await page.goto(`/apps/budget/mouvement/${depenseId}`)
  const vignette = page.locator('form img[src^="/api/fichiers/"]')
  await expect(vignette).toBeVisible()
  const source = await vignette.getAttribute("src")
  expect(source).toBe(`/api/fichiers/${ticketId}`)

  const reponse = await page.request.get(source!)
  expect(reponse.status()).toBe(200)
  expect(reponse.headers()["content-type"]).toBe("image/jpeg")
  expect(reponse.headers()["x-content-type-options"]).toBe("nosniff")
  expect(reponse.headers()["content-security-policy"]).toContain("sandbox")

  // Les pages gardent la CSP globale : la règle qui exclut /api/fichiers ne doit pas les toucher.
  const page2 = await page.request.get("/qg")
  expect(page2.headers()["content-security-policy"]).toContain("frame-ancestors 'none'")
})

test("l. preuve : un PDF joint à un résultat s'ouvre par « Voir la preuve »", async ({ browser, page, equipe }) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await preparerSaison(equipe, 2025)
  await ajouterVoitureDeCourse(equipe)
  await connecterParLien(page, equipe)

  // Épreuve passée, engagement d'une voiture, paiement, puis le résultat (même parcours que la 2.3).
  await page.goto("/apps/saison/nouvelle")
  await page.getByLabel("Nom de l'épreuve").fill("Rallye fichiers e2e")
  await page.getByLabel("Premier jour").fill("2025-05-10")
  await page.getByLabel("Dernier jour").fill("2025-05-11")
  await page.getByRole("button", { name: "Ajouter l'épreuve" }).click()
  await expect(page).toHaveURL(/\/apps\/saison\/epreuves\/[0-9a-f-]+/)
  const fiche = page.url()

  await page.goto(`${fiche}?onglet=engagements`)
  await page.getByLabel("Voiture").selectOption({ label: "Saxo test e2e" })
  await page.getByRole("button", { name: "Engager la voiture" }).click()
  await expect(page.getByText("Saxo test e2e").first()).toBeVisible()
  await page.getByRole("link", { name: /Saxo test e2e/ }).first().click()
  await page.getByLabel("Montant payé (€)").fill("450")
  await page.getByRole("button", { name: "Enregistrer le paiement" }).click()
  await expect(page.getByText("Enregistré.").first()).toBeVisible()

  await page.goto(`${fiche}?onglet=resultats`)
  await page.getByLabel("Classement de classe").fill("2")
  await page.getByRole("button", { name: "Enregistrer le résultat" }).click()
  await expect(page.getByText("Enregistré.").first()).toBeVisible()

  // Le champ fichier est l'input caché relié à « ou un fichier » : setInputFiles marche même caché.
  const formulaire = page.locator("form", { has: page.getByLabel("ou un fichier") })
  await formulaire.getByLabel("ou un fichier").setInputFiles(PREUVE)
  await expect(formulaire.getByText("preuve.pdf")).toBeVisible()
  await page.screenshot({ path: path.join(DOSSIER, "fichiers-preuve-1440x900.png"), fullPage: true })
  await formulaire.getByRole("button", { name: "Joindre la preuve" }).click()
  await expect(formulaire.getByText("Enregistré.")).toBeVisible()

  // Un autre équipier valide le résultat (le responsable ne valide pas le sien).
  const valideur = await ajouterMembreConnectable(equipe, "equipage", "-valideur")
  const contexteValideur = await connecterMembre(browser, valideur.secretLien)
  try {
    const pageValideur = await contexteValideur.newPage()
    await pageValideur.goto("/apps/saison/a-valider")
    await pageValideur.getByRole("button", { name: "Valider", exact: true }).click()
    await expect(pageValideur.locator("main").getByRole("link", { name: /Rallye fichiers e2e/ })).toHaveCount(0)
  } finally {
    await contexteValideur.close()
  }

  await page.goto(`${fiche}?onglet=resultats`)
  // Résultat validé avec une preuve en fichier : la ligne ne dit pas « sans preuve ».
  await expect(page.locator("p", { hasText: "Validé" }).first()).toBeVisible()
  await expect(page.locator("p", { hasText: "Validé" }).first()).not.toContainText("sans preuve")
  // Deux liens « Voir la preuve » une fois validé (liste des résultats et fin d'épreuve), même fichier.
  const lien = page.getByRole("link", { name: "Voir la preuve" }).first()
  await expect(lien).toBeVisible()
  const cible = await lien.getAttribute("href")
  const reponse = await page.request.get(cible!)
  expect(reponse.status()).toBe(200)
  expect(reponse.headers()["content-type"]).toBe("application/pdf")
})

test("l. refus : faux JPEG, fichier de plus de 10 Mo, et envoi sans session", async ({ page, request, equipe }) => {
  await connecterParLien(page, equipe)

  const faux = await page.request.post("/api/fichiers", {
    multipart: { app: "budget", fichier: { name: "faux.jpg", mimeType: "image/jpeg", buffer: readFileSync(FAUX_JPG) } },
  })
  expect(faux.status()).toBe(400)
  expect((await faux.json()).message).toContain("Formats acceptés")

  const lourd = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(10 * 1024 * 1024)])
  const trop = await page.request.post("/api/fichiers", {
    multipart: { app: "budget", fichier: { name: "lourd.jpg", mimeType: "image/jpeg", buffer: lourd } },
  })
  // 400 si le corps est lu entièrement, 413 si l'en-tête annonce déjà trop lourd.
  expect([400, 413]).toContain(trop.status())
  expect((await trop.json()).message).toContain("10 Mo")

  // Sans session (contexte vierge) : 401, jamais une redirection vers la connexion.
  const anonyme = await request.post("/api/fichiers", {
    maxRedirects: 0,
    multipart: { app: "budget", fichier: { name: "photo.jpg", mimeType: "image/jpeg", buffer: readFileSync(PHOTO) } },
  })
  expect(anonyme.status()).toBe(401)
})

test("l. cloisonnement : un membre d'une autre team, ou sans accès à Budget, reçoit 404", async ({ browser, page, equipe }) => {
  await connecterParLien(page, equipe)
  const { ticketId } = await depenseAvecTicket(page, equipe)

  // Autre team : son responsable ne voit pas le ticket de la première.
  const autre = await creerEquipe()
  try {
    const contexteAutre = await connecterMembre(browser, autre.secretLien)
    try {
      const reponse = await contexteAutre.request.get(`/api/fichiers/${ticketId}`)
      expect(reponse.status()).toBe(404)
    } finally {
      await contexteAutre.close()
    }
  } finally {
    await supprimerEquipe(autre)
  }

  // Même team, mais niveau « aucun » sur Budget : le ticket d'une dépense est refusé.
  const sansBudget = await ajouterMembreConnectable(equipe, "equipage", "-sans-budget")
  await definirAccesBudget(equipe, sansBudget, "aucun")
  const contexteSansBudget = await connecterMembre(browser, sansBudget.secretLien)
  try {
    const reponse = await contexteSansBudget.request.get(`/api/fichiers/${ticketId}`)
    expect(reponse.status()).toBe(404)
  } finally {
    await contexteSansBudget.close()
  }
})

test("l. hors ligne : le champ photo est désactivé, et la dépense s'enregistre sans photo", async ({ context, page, equipe }) => {
  await connecterParLien(page, equipe)
  await page.goto("/apps/budget/nouvelle")

  await context.setOffline(true)
  await expect(page.getByLabel("Photo du ticket (facultatif)")).toBeDisabled()
  await expect(page.getByText("La photo s'ajoute quand le réseau revient.")).toBeVisible()

  await page.getByLabel("Montant (€)").fill("7,00")
  await page.getByLabel("Catégorie", { exact: true }).selectOption({ label: "Pneus" })
  await page.getByRole("button", { name: "Ajouter la dépense" }).click()
  await expect(page.getByText("Enregistré. La dépense part")).toBeVisible()

  await context.setOffline(false)
  await expect.poll(() => depenseBudgetParLibelle(equipe, "Pneus")).not.toBeNull()
  const depense = (await depenseBudgetParLibelle(equipe, "Pneus"))!
  expect(await justificatifDepenseEnBase(equipe, depense.id)).toBeNull()
})
