import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import type { Browser, BrowserContext, Page } from "@playwright/test"

import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import {
  ajouterMembreConnectable,
  ajouterRecetteBudgetEnBase,
  creerEquipe,
  definirLogoTeamEnBase,
  supprimerEquipe,
  preparerSaison,
  preverSaisonEnBase,
  proposerMouvementBudget,
  type Equipe,
} from "./aide/session"

// Bilan de saison de Budget en PDF (brief 3.1b, section 5). Le PDF d'exemple sort dans docs/captures/.
const DOSSIER = path.resolve("docs/captures")
const LOGO_PNG = path.resolve("e2e/fichiers/logo.png")
const LOGO_SVG = path.resolve("e2e/fichiers/logo.svg")
const ANNEE = new Date().getFullYear()

// Premier accès à Budget : l'écran de découverte, puis « Commencer » (comme dans budget.spec).
async function ouvrirBudget(page: Page): Promise<void> {
  await page.goto("/apps/budget")
  const commencer = page.getByRole("button", { name: "Commencer" })
  if (await commencer.isVisible().catch(() => false)) await commencer.click()
}

// Ouvre une session pour un autre membre (lien de connexion), dans son propre contexte.
async function connecterMembre(browser: Browser, secretLien: string): Promise<BrowserContext> {
  const contexte = await browser.newContext()
  const page = await contexte.newPage()
  await page.goto(`/connexion/lien?t=${secretLien}`)
  await page.waitForURL(/\/qg$/)
  await page.close()
  return contexte
}

// Dépense confirmée saisie à l'écran, dans la saison de l'année en cours.
async function depenseAEcran(page: Page, montant: string, categorie: string): Promise<void> {
  await page.goto("/apps/budget/nouvelle")
  await page.getByLabel("Montant (€)").fill(montant)
  await page.getByLabel("Catégorie", { exact: true }).selectOption({ label: categorie })
  await page.getByRole("button", { name: "Ajouter la dépense" }).click()
  await expect(page.getByText("Enregistré. La dépense part")).toBeVisible()
}

// Team préremplie : deux dépenses confirmées, une recette encaissée, une prévue, un prévisionnel et une proposition.
async function preremplir(page: Page, equipe: Equipe): Promise<string> {
  const saisonId = await preparerSaison(equipe, ANNEE)
  await depenseAEcran(page, "18,40", "Péages")
  await depenseAEcran(page, "45,50", "Pneus")
  await ajouterRecetteBudgetEnBase(equipe, saisonId, "Sponsor test e2e", 50000, true)
  await ajouterRecetteBudgetEnBase(equipe, saisonId, "Sponsor à venir e2e", 20000, false)
  await preverSaisonEnBase(equipe, saisonId, "Péages", 30000)
  proposerMouvementBudget(equipe, "Ticket proposé e2e", 7000)
  return saisonId
}

test("m. bilan : le responsable télécharge le PDF de la saison, et il est enregistré pour la documentation", async ({ page, equipe }) => {
  await connecterParLien(page, equipe)
  const saisonId = await preremplir(page, equipe)

  await ouvrirBudget(page)
  const telechargement = page.waitForEvent("download")
  await page.getByRole("link", { name: "Bilan de saison (PDF)" }).click()
  const fichier = await telechargement
  const octets = readFileSync((await fichier.path())!)

  expect(octets.subarray(0, 5).toString("latin1")).toBe("%PDF-")
  expect(octets.length).toBeGreaterThan(2048)
  expect(fichier.suggestedFilename()).toMatch(new RegExp(`^bilan-.+-saison-${ANNEE}\\.pdf$`))
  // Le lien porte la saison choisie quand elle est dans le filtre.
  await page.goto(`/apps/budget?saison=${saisonId}`)
  await expect(page.getByRole("link", { name: "Bilan de saison (PDF)" })).toHaveAttribute("href", `/apps/budget/bilan?saison=${saisonId}`)

  writeFileSync(path.join(DOSSIER, "bilan-saison-exemple.pdf"), octets)
})

test("m. bilan : l'assistance ne voit pas le lien, et la route répond 403", async ({ browser, page, equipe }) => {
  await connecterParLien(page, equipe)
  await preremplir(page, equipe)

  const assistance = await ajouterMembreConnectable(equipe, "assistance", "-bilan")
  const contexte = await connecterMembre(browser, assistance.secretLien)
  try {
    const pageAssistance = await contexte.newPage()
    await pageAssistance.goto("/apps/budget")
    const commencer = pageAssistance.getByRole("button", { name: "Commencer" })
    if (await commencer.isVisible().catch(() => false)) await commencer.click()
    await expect(pageAssistance.getByRole("heading", { name: "Mouvements" })).toBeVisible()
    await expect(pageAssistance.getByRole("link", { name: "Bilan de saison (PDF)" })).toHaveCount(0)

    const reponse = await contexte.request.get("/apps/budget/bilan")
    expect(reponse.status()).toBe(403)
  } finally {
    await contexte.close()
  }
})

test("m. bilan : une saison vide donne un PDF valide", async ({ browser, equipe }) => {
  const autre = await creerEquipe()
  const contexte = await connecterMembre(browser, autre.secretLien)
  try {
    const saisonId = await preparerSaison(autre, ANNEE)
    const reponse = await contexte.request.get(`/apps/budget/bilan?saison=${saisonId}`)
    expect(reponse.status()).toBe(200)
    expect(reponse.headers()["content-type"]).toBe("application/pdf")
    const octets = await reponse.body()
    expect(octets.subarray(0, 5).toString("latin1")).toBe("%PDF-")
  } finally {
    await contexte.close()
    await supprimerEquipe(autre)
  }
})

test("m. bilan : un logo PNG est dans le PDF, un logo SVG n'y est pas, et aucun des deux ne fait échouer l'export", async ({ page, equipe }) => {
  await connecterParLien(page, equipe)
  const saisonId = await preparerSaison(equipe, ANNEE)

  for (const [fichier, mimeType, attendu] of [
    [LOGO_PNG, "image/png", true],
    [LOGO_SVG, "image/svg+xml", false],
  ] as const) {
    const envoi = await page.request.post("/api/fichiers", {
      multipart: { app: "settings", fichier: { name: path.basename(fichier), mimeType, buffer: readFileSync(fichier) } },
    })
    expect(envoi.status()).toBe(201)
    const { id } = (await envoi.json()) as { id: string }
    await definirLogoTeamEnBase(equipe, id)

    const reponse = await page.request.get(`/apps/budget/bilan?saison=${saisonId}`)
    expect(reponse.status()).toBe(200)
    const octets = await reponse.body()
    expect(octets.subarray(0, 5).toString("latin1")).toBe("%PDF-")
    expect(octets.toString("latin1").includes("/Subtype /Image")).toBe(attendu)
  }
})
