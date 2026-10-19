// Parcours du lot 3 (brief 3.8, §9) : une convention, du prospect à la résiliation, avec ses liaisons vers Voiture,
// Budget et Saison. Un seul test long : chaque étape prend l'état laissé par la précédente.
// Les captures partent dans docs/captures/ (lot3-*), à 1440 px et à 360 px. Les PDF d'exemple sont régénérés ici.
import fs from "node:fs"
import path from "node:path"

import type { Locator, Page } from "@playwright/test"

import { expect, test } from "./aide/fixtures"
import { connecterParLien, tuilesDuQg } from "./aide/navigation"
import { renseignerMentionsConvention } from "./aide/partenaire-page"
import {
  ajouterEpreuveEnBase,
  compterEvenements,
  passerEpreuveDansLePasseEnBase,
  livraisonsEnBase,
  preparerSaison,
  rattacherPersonne,
  statutEpreuveEnBase,
} from "./aide/session"

const DOSSIER = path.join(__dirname, "..", "docs", "captures")
const PDF_SIGNE = path.join(__dirname, "fichiers", "preuve.pdf")
const PHOTO_POSE = path.join(__dirname, "fichiers", "photo.jpg")
// Photo prise au téléphone : un JPEG de plusieurs Mo (brief 3.11, §12). Des segments COM, sans effet sur l'image, le grossissent.
// PHOTO_TELEPHONE : une vraie photo de téléphone, si on la fournit ; sinon, un JPEG fabriqué ici.
const PHOTO_LOURDE = process.env.PHOTO_TELEPHONE ?? path.join(__dirname, "..", "test-results", "photo-lourde.jpg")
function fabriquerPhotoLourde(): void {
  const original = fs.readFileSync(PHOTO_POSE)
  // Segment COM : marqueur FFFE, longueur 65002 (0xFDEA, longueur comprise), puis 65000 octets de remplissage.
  const segment = Buffer.concat([Buffer.from([0xff, 0xfe, 0xfd, 0xea]), Buffer.alloc(65000, 0x20)])
  const segments = Array.from({ length: 80 }, () => segment)
  fs.mkdirSync(path.dirname(PHOTO_LOURDE), { recursive: true })
  fs.writeFileSync(PHOTO_LOURDE, Buffer.concat([original.subarray(0, 2), ...segments, original.subarray(2)]))
}
const TELEPHONE = { width: 360, height: 740 }
const NOM_EPREUVE = "Rallye de test"

// Jour civil (AAAA-MM-JJ) à Paris : la locale suédoise donne ce format.
function jourCivil(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(new Date())
}

// Encaisse une recette prévue par son bouton « Encaisser » : date du jour et caisse par défaut (brief 3.9, §3).
// Le formulaire disparaît quand la recette est encaissée et que la page est rechargée.
async function encaisserRecette(conteneur: Locator): Promise<void> {
  await conteneur.getByRole("button", { name: "Encaisser", exact: true }).click()
  await conteneur.getByRole("button", { name: "Confirmer l'encaissement", exact: true }).click()
  await expect(conteneur.getByRole("button", { name: "Confirmer l'encaissement", exact: true })).toHaveCount(0, { timeout: 30_000 })
}

// Aucun défilement horizontal sur la page, à la largeur courante.
async function sansDefilementHorizontal(page: Page): Promise<void> {
  const deborde = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(deborde, "défilement horizontal sur la page").toBe(false)
}

// Capture pleine page : éléments fixes masqués, comme dans partenaires.spec.ts.
async function capturer(page: Page, nom: string): Promise<void> {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" })
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>("body *").forEach((element) => {
      if (getComputedStyle(element).position === "fixed") element.style.display = "none"
    })
  })
  await page.screenshot({ path: path.join(DOSSIER, nom), fullPage: true })
}

// Capture de la boîte d'actions ouverte : la boîte est un panneau fixe, que « capturer » masque ; ici on le garde.
async function capturerBoite(page: Page, nom: string): Promise<void> {
  // Le panneau glisse depuis la droite : on attend qu'il ait fini sa course (position stable deux lectures de suite).
  const boite = page.getByRole("dialog")
  await expect(boite).toBeVisible()
  let precedent = Number.NaN
  await expect
    .poll(async () => {
      const x = (await boite.boundingBox())?.x ?? Number.NaN
      const stable = x === precedent
      precedent = x
      return stable
    })
    .toBe(true)
  await page.screenshot({ path: path.join(DOSSIER, nom) })
}

// Une entrée du bouton + : un menu sur ordinateur (menuitem), une feuille de liens sur téléphone (link).
function entreeAjouter(page: Page, libelle: string) {
  return page.getByRole("menuitem", { name: libelle, exact: true }).or(page.getByRole("link", { name: libelle, exact: true }))
}

// Ouvre la boîte d'actions depuis le QG, et attend qu'un texte y figure.
async function ouvrirBoite(page: Page, texte: string): Promise<void> {
  await page.goto("/qg")
  await page.getByRole("button", { name: /Boîte d'actions/ }).click()
  await expect(page.getByRole("dialog").getByText(texte, { exact: false }).first()).toBeVisible({ timeout: 30_000 })
}

// Clique un bouton d'une action de la boîte, par son libellé exact. On attend que le réseau soit au repos : une
// navigation trop tôt couperait la requête de décision (ECONNRESET côté serveur).
async function decider(page: Page, libelle: string): Promise<void> {
  await page.getByRole("dialog").getByRole("button", { name: libelle, exact: true }).first().click()
  await page.waitForLoadState("networkidle")
}

// La ligne d'une contrepartie, repérée par son titre : le texte seul matche aussi les options des menus.
function ligneContrepartie(page: Page, nom: string) {
  return page.locator('li[id^="contrepartie-"]').filter({ has: page.getByRole("heading", { name: nom, exact: true }) })
}

async function creerProspect(page: Page, entreprise: string): Promise<string> {
  await page.goto("/apps/partenaires")
  await page.getByRole("button", { name: "Ajouter", exact: true }).click()
  await entreeAjouter(page, "Partenaire").click()
  await page.waitForURL(/\/apps\/partenaires\/nouveau$/)
  await page.getByLabel("Entreprise", { exact: true }).fill(entreprise)
  await page.locator("form").getByRole("button", { name: "Ajouter" }).click()
  await page.waitForURL(/\/apps\/partenaires\/[0-9a-f-]{36}$/)
  return new URL(page.url()).pathname.split("/")[3]
}

async function creerSaxoDeux(page: Page): Promise<string> {
  await page.goto("/apps/voiture")
  await page.getByRole("button", { name: "Ajouter", exact: true }).click()
  await entreeAjouter(page, "Véhicule").click()
  await page.waitForURL(/\/apps\/voiture\/nouveau$/)
  await page.locator('input[name="nom"]').fill("Saxo 2")
  await page.locator('select[name="gabaritCle"]').selectOption("citadine_3p_saxo")
  await page.getByRole("button", { name: "Ajouter le véhicule" }).click()
  await page.waitForURL(/\/apps\/voiture\/vehicules\/[0-9a-f-]{36}/)
  return new URL(page.url()).pathname.split("/")[4]
}

// Convention de 1 500 € en deux versements de 750 €, pour la saison de l'année courante.
async function creerConvention(page: Page, partenaireId: string, annee: number): Promise<string> {
  await page.goto(`/apps/partenaires/${partenaireId}?onglet=conventions`)
  await page.getByRole("link", { name: "Nouvelle convention" }).click()
  await page.waitForURL(/\/conventions\/nouvelle$/)
  await page.getByLabel("Apport financier (€)", { exact: true }).fill("1 500")
  await page.getByLabel("Date, ligne 1", { exact: true }).fill(`${annee}-03-15`)
  await page.getByLabel("Montant (€), ligne 1", { exact: true }).fill("750")
  await page.getByRole("button", { name: "Ajouter une ligne" }).click()
  await page.getByLabel("Date, ligne 2", { exact: true }).fill(`${annee}-09-15`)
  await page.getByLabel("Montant (€), ligne 2", { exact: true }).fill("750")
  await page.getByRole("button", { name: "Créer la convention" }).click()
  // Après la création, la convention s'ouvre directement sur ses contreparties (brief 3.11, §2).
  await page.waitForURL(/\/apps\/partenaires\/conventions\/[0-9a-f-]{36}\?onglet=contreparties$/)
  return new URL(page.url()).pathname.split("/")[4]
}

// Logo sur la Portière, pris dans la liste de base.
async function ajouterLogo(page: Page, conventionId: string): Promise<void> {
  await page.goto(`/apps/partenaires/conventions/${conventionId}`)
  await page.getByText("Ajouter une contrepartie", { exact: true }).click()
  await page.getByLabel("Dans la liste de base", { exact: true }).selectOption({ label: "Logo sur la voiture" })
  const valeur = await page.getByLabel("Emplacement sur la voiture", { exact: true }).locator("option", { hasText: "Portière" }).first().getAttribute("value")
  await page.getByLabel("Emplacement sur la voiture", { exact: true }).selectOption(valeur ?? "")
  await page.locator("form").filter({ hasText: "Ajouter la contrepartie" }).getByRole("button", { name: "Ajouter la contrepartie" }).click()
  await expect(ligneContrepartie(page, "Logo sur la voiture")).toBeVisible()
}

// Publications : quantité promise 2, pour l'épreuve passée, cochée dans « Épreuves concernées ».
async function ajouterPublications(page: Page, conventionId: string): Promise<void> {
  await page.goto(`/apps/partenaires/conventions/${conventionId}`)
  await page.getByText("Ajouter une contrepartie", { exact: true }).click()
  await page.getByLabel("Dans la liste de base", { exact: true }).selectOption({ label: "Publications sur les réseaux" })
  const formulaire = page.locator("form").filter({ hasText: "Ajouter la contrepartie" })
  await formulaire.getByLabel("Quantité promise", { exact: true }).fill("2")
  await formulaire.getByRole("group", { name: "Épreuves concernées" }).getByRole("checkbox", { name: new RegExp(NOM_EPREUVE) }).check()
  await formulaire.getByRole("button", { name: "Ajouter la contrepartie" }).click()
  await expect(ligneContrepartie(page, "Publications sur les réseaux")).toBeVisible()
}

// Marquer envoyée, puis signée avec le PDF. Attend l'envoi du fichier avant de valider.
async function signerConvention(page: Page, conventionId: string): Promise<void> {
  await page.goto(`/apps/partenaires/conventions/${conventionId}`)
  await page.getByRole("button", { name: "Marquer envoyée" }).click()
  const actionSignee = page.locator("summary", { hasText: "Marquer signée" })
  await expect(actionSignee).toBeVisible()
  await actionSignee.click()
  await page.getByLabel("Signataires", { exact: true }).fill("Jeoffrey Koehling, Garage Muller")
  const envoi = page.waitForResponse((reponse) => reponse.url().includes("/api/fichiers") && reponse.request().method() === "POST")
  await page.getByLabel("Document signé", { exact: true }).setInputFiles(PDF_SIGNE)
  await envoi
  await page.locator("form").filter({ hasText: "Date de signature" }).getByRole("button", { name: "Marquer signée" }).click()
  await expect(page.getByText(/^Signée par Jeoffrey Koehling/)).toBeVisible()
}

test("lot 3 : prospect, convention, liaisons vers Voiture, Budget et Saison, apport, bilan et résiliation", async ({ page, equipe }) => {
  if (!process.env.PHOTO_TELEPHONE) fabriquerPhotoLourde()
  const annee = new Date().getFullYear()
  const saisonId = await preparerSaison(equipe, annee)
  const personneId = await rattacherPersonne(equipe, equipe.responsable, "Jeoffrey", "Koehling")
  // Épreuve à venir au départ : elle se termine plus tard, quand ses dates sont passées (voir l'étape 7).
  const epreuveId = await ajouterEpreuveEnBase(equipe, saisonId, NOM_EPREUVE, `${annee}-12-01`, `${annee}-12-02`)
  await connecterParLien(page, equipe)

  // 1. Prospect « Garage Muller », passé à « Intéressé », suivi par Jo (la proposition de publications en a besoin).
  const partenaireId = await creerProspect(page, "Garage Muller")
  await page.goto(`/apps/partenaires/${partenaireId}`)
  await page.locator("summary", { hasText: "Changer le statut" }).click()
  await page.locator("select[name=statut]").selectOption({ label: "Intéressé" })
  await page.locator("form").filter({ has: page.locator("select[name=statut]") }).getByRole("button", { name: "Changer le statut" }).click()
  await page.waitForLoadState("networkidle")
  await page.goto(`/apps/partenaires/${partenaireId}`)
  // Source et « Suivi par » : après « Enregistrer le suivi », la valeur enregistrée est la valeur par défaut des champs,
  // sans rechargement de la page (brief 3.11, §2). Le test lit l'attribut selected, pas la saisie de l'utilisateur.
  await page.locator("#source").selectOption({ index: 1 })
  const source = await page.locator("#source option:checked").textContent()
  await page.locator("#suivi-par").selectOption({ value: personneId })
  const suiviPar = await page.locator("#suivi-par option:checked").textContent()
  await page.getByRole("button", { name: "Enregistrer le suivi", exact: true }).click()
  await expect(page.locator("#source option[selected]")).toHaveText(source ?? "")
  await expect(page.locator("#suivi-par option[selected]")).toHaveText(suiviPar ?? "")
  await page.waitForLoadState("networkidle")
  await page.reload()
  await expect(page.locator(`#statut-${partenaireId}`)).toHaveValue("interesse")

  // 2. Saxo 2, convention de 1 500 € en deux versements, logo sur la Portière, deux publications pour l'épreuve.
  const vehiculeId = await creerSaxoDeux(page)
  const conventionId = await creerConvention(page, partenaireId, annee)
  await ajouterLogo(page, conventionId)
  await ajouterPublications(page, conventionId)
  await page.goto(`/apps/partenaires/conventions/${conventionId}`)
  await expect(page.getByText("Emplacement : Portière")).toBeVisible()

  // 3. Document : mentions renseignées, sauf la fonction de l'interlocuteur. La convention le signale avant le
  // téléchargement ; la fonction se saisit dans la fiche du partenaire, puis le document est généré sans blanc (brief 3.9, §4).
  await renseignerMentionsConvention(equipe, partenaireId, false)
  await page.goto(`/apps/partenaires/conventions/${conventionId}?onglet=document`)
  await expect(page.getByRole("status").filter({ hasText: "1 champ à compléter" })).toBeVisible()
  // L'interlocuteur se saisit dans la fiche, à l'écran : la ligne « Interlocuteur » s'affiche sans recharger la page.
  await page.goto(`/apps/partenaires/${partenaireId}`)
  await page.locator("#interlocuteur-nom").fill("Marc Dupont")
  await page.locator("#interlocuteur-qualite").fill("Gérant")
  await page.getByRole("button", { name: "Enregistrer l'interlocuteur", exact: true }).click()
  await expect(page.getByText("Interlocuteur : Marc Dupont", { exact: true })).toBeVisible()
  await capturer(page, "lot3-fiche-qualite-1440x900.png")
  await page.goto(`/apps/partenaires/conventions/${conventionId}?onglet=document`)
  await expect(page.getByRole("status").filter({ hasText: "champ à compléter" })).toHaveCount(0)
  await page.locator("section[aria-labelledby=document-genere]").getByRole("button", { name: /Générer le document/ }).click()
  await expect(page.getByRole("status").filter({ hasText: "Document généré." })).toBeVisible()
  await page.reload()
  const lienDocument = page.getByRole("link", { name: "Télécharger le document", exact: true })
  await expect(lienDocument).toBeVisible()
  const document = await page.request.get((await lienDocument.getAttribute("href")) ?? "")
  const octetsDocument = await document.body()
  expect(octetsDocument.subarray(0, 5).toString()).toBe("%PDF-")
  expect(octetsDocument.length).toBeGreaterThan(2048)
  fs.writeFileSync(path.join(DOSSIER, "convention-exemple.pdf"), octetsDocument)

  // 4. Signature : la convention passe signée, et Budget reçoit deux recettes à confirmer.
  await signerConvention(page, conventionId)
  await expect.poll(() => compterEvenements(equipe, "partenaires.convention_signee")).toBe(1)
  await ouvrirBoite(page, "Réserver la Portière pour Garage Muller ?")
  await capturerBoite(page, "lot3-boite-reserver-1440x900.png")
  await page.keyboard.press("Escape")

  await page.goto("/apps/budget/a-confirmer")
  await expect(page.getByText("Garage Muller, versement 1 sur 2", { exact: false }).first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText("Garage Muller, versement 2 sur 2", { exact: false }).first()).toBeVisible()
  await capturer(page, "lot3-budget-recettes-a-confirmer-1440x900.png")

  // 5. Réservation depuis la boîte. Puis confirmation des deux recettes dans Budget : chaque clic retire une proposition.
  await ouvrirBoite(page, "Réserver la Portière pour Garage Muller ?")
  await decider(page, "Réserver")
  await page.goto("/apps/budget/a-confirmer")
  const confirmer = page.getByRole("button", { name: "Confirmer", exact: true })
  await expect(confirmer).toHaveCount(2, { timeout: 30_000 })
  await confirmer.first().click()
  await expect(confirmer).toHaveCount(1, { timeout: 30_000 })
  await confirmer.first().click()
  await expect(confirmer).toHaveCount(0, { timeout: 30_000 })
  // Sur la convention, les deux versements sont prévus : chacun porte son lien vers Budget (brief 3.11, §4).
  await page.goto(`/apps/partenaires/conventions/${conventionId}`)
  const versementsPrevus = page.getByRole("list", { name: "Versements prévus" })
  await expect(versementsPrevus.getByRole("link", { name: "Encaisser dans Budget" })).toHaveCount(2)

  // 6. Logo posé avec sa photo : la boîte propose d'ajouter la photo comme preuve, et la contrepartie devient tenue.
  await page.goto(`/apps/voiture/vehicules/${vehiculeId}?onglet=deco`)
  await page.getByRole("group", { name: /^Plan de Saxo 2/ }).getByRole("button", { name: /Portière/ }).first().click()
  await page.getByRole("button", { name: "Marquer le logo posé", exact: true }).click()
  await page.locator('input[name="poseLe"]').fill(jourCivil())
  // La réponse de l'envoi est retenue 1,5 s : pendant ce temps, « Enregistrer la pose » est désactivé (brief 3.11, §12).
  await page.route("**/api/fichiers", async (route) => {
    await new Promise((resoudre) => setTimeout(resoudre, 1500))
    await route.continue()
  }, { times: 1 })
  const envoiPhoto = page.waitForResponse((reponse) => reponse.url().includes("/api/fichiers") && reponse.request().method() === "POST")
  await page.getByLabel("Photo de la pose (facultatif)", { exact: true }).setInputFiles(PHOTO_LOURDE)
  await expect(page.getByRole("button", { name: "Envoi de la photo…", exact: true })).toBeDisabled()
  await envoiPhoto
  await page.getByRole("button", { name: "Enregistrer la pose", exact: true }).click()
  await page.waitForLoadState("networkidle")
  await ouvrirBoite(page, "Ajouter la photo de pose comme preuve pour Garage Muller ?")
  await decider(page, "Ajouter")
  await page.goto(`/apps/partenaires/conventions/${conventionId}`)
  await expect(ligneContrepartie(page, "Logo sur la voiture").getByText("Tenue", { exact: true })).toBeVisible({ timeout: 30_000 })

  // 7. L'épreuve a lieu : ses dates passent, et le QG la passe à « terminée ». La boîte propose alors les publications promises à Jo.
  await passerEpreuveDansLePasseEnBase(equipe, epreuveId, `${annee}-03-01`, `${annee}-03-02`)
  await page.goto("/qg")
  await expect.poll(() => statutEpreuveEnBase(equipe, epreuveId), { timeout: 30_000 }).toBe("terminee")
  await ouvrirBoite(page, "Publications promises après Rallye de test")
  await capturerBoite(page, "lot3-boite-publications-1440x900.png")
  await page.keyboard.press("Escape")

  // 8. Apport : le premier versement encaissé le rend « partiel », le second « reçu ». L'encaissement passe par le
  // bouton « Encaisser » de Budget, comme il le fera à l'écran (brief 3.9, §3).
  const bureau = page.viewportSize() ?? { width: 1440, height: 900 }
  await page.goto("/apps/budget")
  const commencer = page.getByRole("button", { name: "Commencer" })
  if (await commencer.isVisible().catch(() => false)) await commencer.click()
  const versement1 = page.locator("li").filter({ has: page.getByText("Garage Muller, versement 1 sur 2", { exact: false }) })
  await expect(versement1.getByRole("button", { name: "Encaisser", exact: true })).toBeVisible({ timeout: 30_000 })
  await capturer(page, "lot3-budget-encaisser-1440x900.png")
  await encaisserRecette(versement1)
  await versement1.getByRole("link").click()
  const fiche = page.getByRole("complementary", { name: "Fiche du mouvement" })
  await expect(fiche.getByText(/^Encaissée le /)).toBeVisible()
  await capturer(page, "lot3-budget-recette-encaissee-1440x900.png")
  await page.goto(`/apps/partenaires/conventions/${conventionId}`)
  await expect(page.getByTestId("apport-recu")).toHaveText("Apport partiel", { timeout: 30_000 })
  // Le versement encaissé porte sa date ; l'autre reste à encaisser.
  const versementsEncaisses = page.getByRole("list", { name: "Versements prévus" })
  await expect(versementsEncaisses.getByText("encaissé le", { exact: false })).toHaveCount(1)
  await expect(versementsEncaisses.getByRole("link", { name: "Encaisser dans Budget" })).toHaveCount(1)
  await capturer(page, "lot3-convention-apport-partiel-1440x900.png")

  // Téléphone : la recette prévue sur sa fiche, avec le bouton « Encaisser », puis encaissée.
  await page.setViewportSize(TELEPHONE)
  await page.goto("/apps/budget")
  const versement2 = page.locator("li").filter({ has: page.getByText("Garage Muller, versement 2 sur 2", { exact: false }) })
  await versement2.getByRole("link").click()
  const ficheTelephone = page.getByRole("complementary", { name: "Fiche du mouvement" })
  await expect(ficheTelephone.getByRole("button", { name: "Encaisser", exact: true })).toBeVisible({ timeout: 30_000 })
  await sansDefilementHorizontal(page)
  await capturer(page, "lot3-budget-encaisser-360x740.png")
  await encaisserRecette(ficheTelephone)
  await expect(ficheTelephone.getByText(/^Encaissée le /)).toBeVisible()
  await sansDefilementHorizontal(page)
  await capturer(page, "lot3-budget-recette-encaissee-360x740.png")
  await page.setViewportSize(bureau)
  await page.goto(`/apps/partenaires/conventions/${conventionId}`)
  await expect(page.getByTestId("apport-recu")).toHaveText("Apport reçu", { timeout: 30_000 })

  // Téléphone : la ligne d'actions de la convention (avenant, résiliation) passe à la ligne sans déborder (brief 3.9, §6).
  await page.setViewportSize(TELEPHONE)
  await page.goto(`/apps/partenaires/conventions/${conventionId}`)
  await sansDefilementHorizontal(page)
  await capturer(page, "lot3-convention-actions-360x740.png")
  await page.setViewportSize(bureau)

  // 9. Bilan : le PDF se génère et se télécharge.
  await page.goto(`/apps/partenaires/${partenaireId}?onglet=bilans`)
  await page.getByRole("button", { name: "Générer le bilan", exact: true }).click()
  const lienBilan = page.getByRole("link", { name: "Télécharger le PDF", exact: true })
  await expect(lienBilan).toBeVisible({ timeout: 30_000 })
  const bilan = await page.request.get((await lienBilan.getAttribute("href")) ?? "")
  const octetsBilan = await bilan.body()
  expect(octetsBilan.subarray(0, 5).toString()).toBe("%PDF-")
  expect(octetsBilan.length).toBeGreaterThan(2048)
  fs.writeFileSync(path.join(DOSSIER, "bilan-partenaire-exemple.pdf"), octetsBilan)

  // 10. Résiliation : la boîte propose de libérer la Portière, et la décision la libère.
  await page.goto(`/apps/partenaires/conventions/${conventionId}`)
  await page.locator("summary", { hasText: "Résilier la convention" }).click()
  await page.locator("#motif-resiliation").fill("Fin de saison de test")
  await page.locator("form").filter({ has: page.locator("#motif-resiliation") }).getByRole("button", { name: "Résilier la convention", exact: true }).click()
  await page.waitForLoadState("networkidle")
  await ouvrirBoite(page, "Libérer la Portière ? La convention de Garage Muller est terminée.")
  await decider(page, "Libérer")
  await page.goto(`/apps/voiture/vehicules/${vehiculeId}?onglet=deco`)
  await expect(page.getByRole("group", { name: /^Plan de Saxo 2/ }).getByRole("button", { name: /Portière/ }).first()).toHaveAccessibleName(/Portière, Libre/)

  // 11. Téléphone 360 px : les écrans du parcours, sans défilement horizontal.
  await page.setViewportSize(TELEPHONE)
  await page.goto(`/apps/partenaires/conventions/${conventionId}`)
  await sansDefilementHorizontal(page)
  await capturer(page, "lot3-convention-360x740.png")
  await page.goto(`/apps/partenaires/${partenaireId}`)
  await sansDefilementHorizontal(page)
  await capturer(page, "lot3-fiche-360x740.png")
  await page.goto("/qg")
  await expect(tuilesDuQg(page).first()).toBeVisible()
  await sansDefilementHorizontal(page)

  // Aucune livraison du bus n'a échoué pendant le parcours.
  const enErreur = (await livraisonsEnBase(equipe)).filter((ligne) => ligne.includes("[erreur]"))
  expect(enErreur).toEqual([])
})
