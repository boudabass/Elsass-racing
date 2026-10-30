import path from "node:path"

import type { Page } from "@playwright/test"

import { expect, test } from "./aide/fixtures"
import {
  alerteDocumentEnBase,
  documentEnBase,
  echeanceEnBase,
  journalOuverturesEnBase,
  justificatifBudgetEnBase,
  liensEnBase,
  rattacherPersonneAuCompte,
} from "./aide/documents"
import { jourParis } from "./aide/dates"
import { envoyer } from "./aide/envoi"
import { connecterParLien, tuilesDuQg } from "./aide/navigation"
import { ajouterMembreConnectable, ajouterPapierEnBase, ajouterVoitureSaxo, definirAccesBudget, statutAction } from "./aide/session"

// Tâche 5.4, brief §4 : scénarios de Documents, échéances, vue unifiée et partages, par clics depuis le QG.
// Chaque envoi est attendu, et l'état est relu en base. Les dates sont relatives à aujourd'hui (fuseau de Paris).

const PDF = path.join(__dirname, "fichiers", "preuve.pdf")
const TITRE_ASSURANCE = "Assurance de l'association"
const TITRE_PARTAGE = "Attestation partagée"
const TITRE_ASSISTANCE = "Attestation de l'assistance e2e"

// Ouvre Documents depuis le QG, puis une de ses entrées de menu.
async function ouvrirMenuDocuments(page: Page, entree: string): Promise<void> {
  await tuilesDuQg(page)
    .filter({ has: page.getByRole("heading", { name: "Documents", exact: true }) })
    .click()
  await expect(page.getByRole("heading", { name: "Coffre-fort", exact: true })).toBeVisible()
  await page.getByRole("link", { name: entree, exact: true }).click()
}

test("échéances : alerte dans la boîte, report, Échéances, renouvellement et levée", async ({ page, equipe }) => {
  test.setTimeout(420_000)
  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 1440, height: 900 })

  // Papier de la Saxo qui expire dans 20 jours (Voiture le lit à la date de l'épreuve).
  const vehicule = await ajouterVoitureSaxo(equipe, "Saxo test e2e")
  await ajouterPapierEnBase(equipe, vehicule, "carte_grise", jourParis(20))

  // 1. Document qui expire dans 20 jours : l'action de renouvellement apparaît dans la boîte.
  await ouvrirMenuDocuments(page, "Coffre-fort")
  await page.getByRole("button", { name: "Document", exact: true }).click()
  const tiroirAssurance = page.getByRole("dialog")
  await tiroirAssurance.getByLabel("Titre", { exact: true }).fill(TITRE_ASSURANCE)
  await tiroirAssurance.getByLabel("Type de document", { exact: true }).selectOption("assurance_asso")
  await tiroirAssurance.getByLabel("Dossier", { exact: true }).selectOption({ label: "Assurances" })
  await tiroirAssurance.getByLabel("Date de validité", { exact: true }).fill(jourParis(20))
  await envoyer(page, tiroirAssurance.getByRole("button", { name: "Ajouter le document", exact: true }))
  const assurance = await documentEnBase(equipe, TITRE_ASSURANCE)
  expect(assurance).not.toBeNull()
  const idAssurance = assurance?.id ?? ""

  await page.goto("/qg")
  await page.getByRole("button", { name: /Boîte d'actions/ }).click()
  const boite = page.getByRole("dialog")
  await expect(boite.getByText(new RegExp(`Renouveler ${TITRE_ASSURANCE} : expire le`))).toBeVisible()

  // « Reporter d'une semaine » : l'action sort de la boîte, la date de report est en base.
  const reponse = page.waitForResponse((r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined)
  await boite.getByRole("button", { name: "Reporter d'une semaine", exact: true }).click()
  await reponse
  await expect(boite.getByText(new RegExp(`Renouveler ${TITRE_ASSURANCE}`))).toHaveCount(0)
  expect((await alerteDocumentEnBase(equipe, idAssurance))?.reporteJusquau).toBe(jourParis(7))
  await page.keyboard.press("Escape")

  // 2. Échéances : le document et le papier dans « Bientôt », chacun avec son bouton.
  await ouvrirMenuDocuments(page, "Échéances")
  const bientot = page.locator("section").filter({ has: page.getByRole("heading", { name: /^Bientôt/ }) })
  await expect(bientot.getByText(TITRE_ASSURANCE)).toBeVisible()
  await expect(bientot.getByText(/Carte grise : Saxo test e2e/)).toBeVisible()
  await expect(bientot.getByRole("link", { name: "Ouvrir dans Voiture", exact: true }).first()).toBeVisible()

  // 3. « Renouveler » ouvre la fiche avec le tiroir d'ajout de fichier. Un fichier, puis une validité d'un an.
  await bientot.locator("li").filter({ hasText: TITRE_ASSURANCE }).getByRole("link", { name: "Renouveler", exact: true }).click()
  await expect(page).toHaveURL(/renouveler=1/)
  const tiroirVersion = page.getByRole("dialog")
  await tiroirVersion.locator('input[type="file"]').setInputFiles(PDF)
  await envoyer(page, tiroirVersion.getByRole("button", { name: "Enregistrer le fichier", exact: true }))

  await page.getByRole("button", { name: "Modifier", exact: true }).click()
  const tiroirModifier = page.getByRole("dialog")
  await tiroirModifier.getByLabel("Date de validité", { exact: true }).fill(jourParis(365))
  await envoyer(page, tiroirModifier.getByRole("button", { name: "Enregistrer", exact: true }))

  expect(await echeanceEnBase(equipe, idAssurance)).toBe(jourParis(365))
  // La date a changé : l'action de l'ancienne date est levée, l'échéance est résolue en base.
  // Le report avait décidé l'action (« decidee ») : elle n'est plus en attente.
  await expect.poll(() => statutAction(equipe, `documents:${idAssurance}:${jourParis(20)}`)).not.toBe("en_attente")
  expect((await alerteDocumentEnBase(equipe, idAssurance))?.resolue).toBe(true)

  await ouvrirMenuDocuments(page, "Échéances")
  await page.getByRole("button", { name: /^À jour \(/ }).click()
  await expect(page.getByRole("dialog").getByText(TITRE_ASSURANCE)).toBeVisible()
  await page.keyboard.press("Escape")
})

test("Tous les fichiers : un justificatif de Budget visible par le responsable, pas par un membre sans accès à Budget", async ({
  page,
  equipe,
  browser,
}) => {
  test.setTimeout(300_000)
  const libelleFichier = "justificatif-peage-e2e.pdf"
  await justificatifBudgetEnBase(equipe, "Péage test e2e", libelleFichier)
  const membre = await ajouterMembreConnectable(equipe, "equipage")
  await definirAccesBudget(equipe, membre, "aucun")

  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 1440, height: 900 })
  await ouvrirMenuDocuments(page, "Tous les fichiers")
  await expect(page.getByRole("link", { name: libelleFichier, exact: true })).toBeVisible()

  const contexte = await browser.newContext()
  const autre = await contexte.newPage()
  try {
    await autre.goto(`/connexion/lien?t=${membre.secretLien}`)
    await autre.waitForURL(/\/qg$/)
    await ouvrirMenuDocuments(autre, "Tous les fichiers")
    await expect(autre.getByRole("link", { name: libelleFichier, exact: true })).toHaveCount(0)
    await expect(autre.getByText("Aucun fichier ne correspond à ces filtres.", { exact: true })).toBeVisible()
  } finally {
    await contexte.close()
  }
})

test("partage par lien : page publique sans session, ouverture comptée, révocation", async ({ page, equipe, browser }) => {
  test.setTimeout(300_000)
  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 1440, height: 900 })

  await ouvrirMenuDocuments(page, "Coffre-fort")
  await page.getByRole("button", { name: "Document", exact: true }).click()
  const tiroirDocument = page.getByRole("dialog")
  await tiroirDocument.getByLabel("Titre", { exact: true }).fill(TITRE_PARTAGE)
  await tiroirDocument.getByLabel("Type de document", { exact: true }).selectOption("attestation")
  await tiroirDocument.getByLabel("Dossier", { exact: true }).selectOption({ label: "Attestations" })
  await envoyer(page, tiroirDocument.getByRole("button", { name: "Ajouter le document", exact: true }))
  const document = await documentEnBase(equipe, TITRE_PARTAGE)
  expect(document).not.toBeNull()
  const idDocument = document?.id ?? ""

  // Création du lien : destinataire en texte, durée 7 jours par défaut. Le lien ne s'affiche qu'une fois.
  await page.getByRole("link", { name: /Attestations/ }).click()
  await page.getByRole("link", { name: TITRE_PARTAGE, exact: true }).click()
  await page.getByRole("button", { name: "Partager par lien", exact: true }).click()
  const tiroirLien = page.getByRole("dialog")
  await tiroirLien.getByLabel("Destinataire", { exact: true }).fill("Préfecture test e2e")
  await envoyer(page, tiroirLien.getByRole("button", { name: "Créer le lien", exact: true }))
  await expect(tiroirLien.getByText("Copie le lien maintenant : il ne sera plus affiché.")).toBeVisible()
  const texte = (await tiroirLien.locator("p.break-all").innerText()).trim()
  const jeton = /\/d\/([A-Za-z0-9_-]{43})$/.exec(texte)?.[1] ?? ""
  expect(jeton).not.toBe("")

  const liens = await liensEnBase(equipe, idDocument)
  expect(liens).toHaveLength(1)
  expect(liens[0].revoque).toBe(false)
  const idLien = liens[0].id
  await page.keyboard.press("Escape")

  // Page publique, sans session : titre et validité, une ouverture comptée et une ligne de journal.
  const anonyme = await browser.newContext()
  const visiteur = await anonyme.newPage()
  try {
    await visiteur.goto(`/d/${jeton}`)
    await expect(visiteur.getByRole("heading", { name: TITRE_PARTAGE, exact: true })).toBeVisible()
    await expect(visiteur.getByText(/Lien valable jusqu/)).toBeVisible()
    await expect.poll(() => journalOuverturesEnBase(equipe, idLien)).toBe(1)
    expect((await liensEnBase(equipe, idDocument))[0].ouvertures).toBe(1)

    // Révocation depuis Partages : la même adresse ne montre plus rien d'utile.
    await page.getByRole("link", { name: "Partages", exact: true }).click()
    await page.getByRole("button", { name: "Révoquer", exact: true }).click()
    const tiroirRevoquer = page.getByRole("dialog")
    await envoyer(page, tiroirRevoquer.getByRole("button", { name: "Révoquer le lien", exact: true }))
    expect((await liensEnBase(equipe, idDocument))[0].revoque).toBe(true)

    await visiteur.goto(`/d/${jeton}`)
    await expect(visiteur.getByText("Ce lien n'est plus valable.", { exact: true })).toBeVisible()
  } finally {
    await anonyme.close()
  }
})

test("assistance : ni « Partages » dans le menu, ni « Partager par lien » sur la fiche", async ({ equipe, browser }) => {
  test.setTimeout(300_000)
  const assistance = await ajouterMembreConnectable(equipe, "assistance")
  await rattacherPersonneAuCompte(equipe, assistance, "Anne", "Assistance")

  const contexte = await browser.newContext()
  const page = await contexte.newPage()
  try {
    await page.goto(`/connexion/lien?t=${assistance.secretLien}`)
    await page.waitForURL(/\/qg$/)
    await ouvrirMenuDocuments(page, "Coffre-fort")
    await expect(page.getByRole("link", { name: "Partages", exact: true })).toHaveCount(0)

    // Un document de l'assistance : sa fiche n'offre pas le partage par lien.
    await page.getByRole("button", { name: "Document", exact: true }).click()
    const tiroir = page.getByRole("dialog")
    await tiroir.getByLabel("Titre", { exact: true }).fill(TITRE_ASSISTANCE)
    await tiroir.getByLabel("Type de document", { exact: true }).selectOption("attestation")
    await tiroir.getByLabel("Dossier", { exact: true }).selectOption({ label: "Attestations" })
    await envoyer(page, tiroir.getByRole("button", { name: "Ajouter le document", exact: true }))
    await page.getByRole("link", { name: /Attestations/ }).click()
    await page.getByRole("link", { name: TITRE_ASSISTANCE, exact: true }).click()
    await expect(page.getByRole("heading", { name: TITRE_ASSISTANCE, exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Partager par lien", exact: true })).toHaveCount(0)
  } finally {
    await contexte.close()
  }
})
