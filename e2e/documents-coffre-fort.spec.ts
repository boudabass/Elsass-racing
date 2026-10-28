import path from "node:path"

import { expect, test } from "./aide/fixtures"
import { accesDocumentEnBase, dossiersTypesEnBase, documentEnBase, echeanceEnBase, rattacherPersonneAuCompte } from "./aide/documents"
import { jourParis } from "./aide/dates"
import { envoyer } from "./aide/envoi"
import { connecterParLien, tuilesDuQg } from "./aide/navigation"
import { ajouterMembreConnectable } from "./aide/session"

// Tâche 5.3, brief §6 : parcours de Documents par clics depuis le QG. Un premier document avec un PDF dans Association
// (jauge « 1 sur 3 », dossier type présent une seule fois), une validité dans cinq jours (compteur rouge), une nouvelle
// version (la première reste lisible), un archivage. L'assistance ne voit pas le document de la responsable, ajoute le
// sien, puis voit celui qui lui est partagé. Chaque envoi est attendu, et l'état est relu en base.

const PDF = path.join(__dirname, "fichiers", "preuve.pdf")
const PHOTO = path.join(__dirname, "fichiers", "photo.jpg")
const TITRE_STATUTS = "Statuts de l'association"
const TITRE_ASSURANCE = "Assurance de l'association"
const TITRE_ATTESTATION = "Attestation de l'assistance"

test("parcours : coffre-fort, versions, archivage, partage à l'assistance", async ({ page, equipe, browser }) => {
  test.setTimeout(420_000)
  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 1440, height: 900 })

  // L'assistance a une personne rattachée à son compte : c'est elle qui apparaît au partage et qui possède ses documents.
  const assistance = await ajouterMembreConnectable(equipe, "assistance")
  const personneAssistance = await rattacherPersonneAuCompte(equipe, assistance, "Anne", "Assistance")

  await tuilesDuQg(page)
    .filter({ has: page.getByRole("heading", { name: "Documents", exact: true }) })
    .click()
  await expect(page.getByRole("heading", { name: "Coffre-fort", exact: true })).toBeVisible()

  // 1. Premier document : « Statuts » avec un PDF, rangé dans Association.
  await page.getByRole("button", { name: "Document", exact: true }).click()
  const tiroirStatuts = page.getByRole("dialog")
  await tiroirStatuts.getByLabel("Titre", { exact: true }).fill(TITRE_STATUTS)
  await tiroirStatuts.getByLabel("Type de document", { exact: true }).selectOption("statuts")
  await tiroirStatuts.getByLabel("Dossier", { exact: true }).selectOption({ label: "Association" })
  await tiroirStatuts.locator('input[type="file"]').setInputFiles(PDF)
  await expect(tiroirStatuts.getByRole("button", { name: "Remplacer", exact: true })).toBeVisible()
  await envoyer(page, tiroirStatuts.getByRole("button", { name: "Ajouter le document", exact: true }))

  await expect(page.getByRole("link", { name: /Association/ })).toContainText("1 sur 3")
  // Les sept dossiers types existent une seule fois, même après la première écriture.
  expect(await dossiersTypesEnBase(equipe, "Association")).toBe(1)
  const statuts = await documentEnBase(equipe, TITRE_STATUTS)
  expect(statuts?.versions).toBe(1)
  expect(statuts?.versionCourante).toBe(1)

  // 2. Document dont la validité expire dans cinq jours : compteur rouge, texte en toutes lettres.
  await page.getByRole("button", { name: "Document", exact: true }).click()
  const tiroirAssurance = page.getByRole("dialog")
  await tiroirAssurance.getByLabel("Titre", { exact: true }).fill(TITRE_ASSURANCE)
  await tiroirAssurance.getByLabel("Type de document", { exact: true }).selectOption("assurance_asso")
  await tiroirAssurance.getByLabel("Dossier", { exact: true }).selectOption({ label: "Assurances" })
  await tiroirAssurance.getByLabel("Date de validité", { exact: true }).fill(jourParis(5))
  await envoyer(page, tiroirAssurance.getByRole("button", { name: "Ajouter le document", exact: true }))

  await expect(page.getByRole("list", { name: "Échéances" }).getByRole("listitem").filter({ hasText: "Expirés ou à 7 jours" })).toContainText("1")
  const assurance = await documentEnBase(equipe, TITRE_ASSURANCE)
  expect(assurance).not.toBeNull()
  expect(await echeanceEnBase(equipe, assurance?.id ?? "")).toBe(jourParis(5))

  await page.getByRole("link", { name: /Assurances/ }).click()
  await page.getByRole("link", { name: TITRE_ASSURANCE }).click()
  await expect(page.getByText("Expire dans 5 jours", { exact: true })).toBeVisible()
  await page.getByRole("link", { name: "Assurances", exact: true }).click()
  await page.locator("section").getByRole("link", { name: "Coffre-fort", exact: true }).click()

  // 3. Nouvelle version du Statuts : la version 2 devient la version en cours, la version 1 reste lisible.
  await page.getByRole("link", { name: /Association/ }).click()
  await page.getByRole("link", { name: TITRE_STATUTS }).click()
  await page.getByRole("button", { name: "Remplacer le fichier", exact: true }).click()
  const tiroirVersion = page.getByRole("dialog")
  await tiroirVersion.locator('input[type="file"]').setInputFiles(PHOTO)
  await expect(tiroirVersion.getByRole("button", { name: "Remplacer", exact: true })).toBeVisible()
  await tiroirVersion.getByLabel("Commentaire (facultatif)", { exact: true }).fill("Version signée")
  await envoyer(page, tiroirVersion.getByRole("button", { name: "Enregistrer le fichier", exact: true }))

  await expect(page.getByText(/Version 2 ·/)).toBeVisible()
  await expect(page.locator('img[src^="/api/fichiers/"]').first()).toBeVisible()
  const versionsStatuts = await documentEnBase(equipe, TITRE_STATUTS)
  expect(versionsStatuts?.versions).toBe(2)
  expect(versionsStatuts?.versionCourante).toBe(2)

  await page.getByRole("button", { name: "Historique des versions (2)", exact: true }).click()
  const historique = page.getByRole("dialog")
  const lienVersion1 = historique.getByRole("link", { name: /preuve\.pdf/ })
  await expect(lienVersion1).toBeVisible()
  const reponse = await page.request.get((await lienVersion1.getAttribute("href")) ?? "")
  expect(reponse.ok()).toBeTruthy()
  await historique.getByRole("button", { name: "Fermer", exact: true }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)

  // 4. Archiver : le document sort de la jauge, il reste dans « Archivés ».
  await page.getByRole("button", { name: "Archiver", exact: true }).click()
  const tiroirArchive = page.getByRole("dialog")
  await envoyer(page, tiroirArchive.getByRole("button", { name: "Archiver", exact: true }))
  expect((await documentEnBase(equipe, TITRE_STATUTS))?.statut).toBe("archive")

  await page.getByRole("link", { name: "Association", exact: true }).click()
  await expect(page.getByRole("link", { name: new RegExp(TITRE_STATUTS) })).toHaveCount(0)
  await page.getByRole("button", { name: "Archivés (1)", exact: true }).click()
  await expect(page.getByRole("dialog").getByRole("link", { name: new RegExp(TITRE_STATUTS) })).toBeVisible()
  await page.getByRole("button", { name: "Fermer", exact: true }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.locator("section").getByRole("link", { name: "Coffre-fort", exact: true }).click()
  await expect(page.getByRole("link", { name: /Association/ })).toContainText("0 sur 3")

  // 5. Assistance : elle ne voit ni l'assurance ni le Statuts. Elle ajoute son propre document, puis voit celui
  // que la responsable lui partage.
  const contexte = await browser.newContext()
  const assist = await contexte.newPage()
  try {
    await assist.goto(`/connexion/lien?t=${assistance.secretLien}`)
    await assist.waitForURL(/\/qg$/)
    await tuilesDuQg(assist)
      .filter({ has: assist.getByRole("heading", { name: "Documents", exact: true }) })
      .click()
    await expect(assist.getByRole("heading", { name: "Coffre-fort", exact: true })).toBeVisible()
    await expect(assist.getByText("Tes documents, et ceux qui te sont ouverts.", { exact: true })).toBeVisible()
    await expect(assist.getByRole("link", { name: /Association/ })).toHaveCount(0)
    await expect(assist.getByRole("link", { name: /Assurances/ })).toHaveCount(0)
    await expect(assist.getByRole("button", { name: "Dossier", exact: true })).toHaveCount(0)

    await assist.getByRole("button", { name: "Document", exact: true }).click()
    const tiroirAttestation = assist.getByRole("dialog")
    await tiroirAttestation.getByLabel("Titre", { exact: true }).fill(TITRE_ATTESTATION)
    await tiroirAttestation.getByLabel("Type de document", { exact: true }).selectOption("attestation")
    await tiroirAttestation.getByLabel("Dossier", { exact: true }).selectOption({ label: "Attestations" })
    await envoyer(assist, tiroirAttestation.getByRole("button", { name: "Ajouter le document", exact: true }))
    await expect(assist.getByRole("link", { name: /Attestations/ })).toBeVisible()

    // La responsable partage l'assurance avec l'assistance (niveau lecture par défaut).
    await page.getByRole("link", { name: /Assurances/ }).click()
    await page.getByRole("link", { name: TITRE_ASSURANCE }).click()
    await page.getByRole("button", { name: "Partager avec un membre", exact: true }).click()
    const tiroirPartage = page.getByRole("dialog")
    await tiroirPartage.getByLabel("Membre", { exact: true }).selectOption({ label: "Anne Assistance" })
    await envoyer(page, tiroirPartage.getByRole("button", { name: "Partager", exact: true }))
    expect(await accesDocumentEnBase(equipe, assurance?.id ?? "", personneAssistance)).toBe("lecture")

    // L'assistance recharge le coffre : l'assurance partagée apparaît.
    await assist.reload()
    await expect(assist.getByRole("link", { name: /Assurances/ })).toBeVisible()
    await assist.getByRole("link", { name: /Assurances/ }).click()
    await assist.getByRole("link", { name: TITRE_ASSURANCE }).click()
    await expect(assist.getByText("Expire dans 5 jours", { exact: true })).toBeVisible()
  } finally {
    await contexte.close()
  }
})
