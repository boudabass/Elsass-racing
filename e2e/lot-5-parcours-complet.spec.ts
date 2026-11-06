// Parcours du lot 5 (tâche 5.8, brief §2) : ce que la team vit à travers Équipe, Documents, Check-lists, Garage et Saison, par
// clics depuis le QG. Une seule team, un seul test, des étapes numérotées comme le brief. Les étapes qui ne sont pas couvertes
// ici sont listées en tête de section, avec leur raison : ne pas les présumer vérifiées.
import path from "node:path"

import type { BrowserContext, Page, Response } from "@playwright/test"

import { preparerEpreuveChecklist } from "./aide/checklist"
import { DOSSIER_CAPTURES } from "./aide/equipe"
import { jourParis } from "./aide/dates"
import { accesDocumentEnBase, documentEnBase, rattacherPersonneAuCompte } from "./aide/documents"
import { ajouterEquipement, ajouterLicence, choisirTheme, creerPersonne, ouvrirOnglet } from "./aide/equipe"
import { envoyer, envoyerSansFermeture } from "./aide/envoi"
import { expect, test } from "./aide/fixtures"
import { preparerAtelierSaxo, ordresEnBase } from "./aide/garage"
import { connecterParLien, tuilesDuQg } from "./aide/navigation"
import {
  ajouterEquipier,
  ajouterMembreConnectable,
  ajouterResultatValideEnBase,
  engagementsEnBase,
  lienPointChecklistEnBase,
  statutAction,
  statutActionTitreEnBase,
  statutPointChecklistEnBase,
  tachesPointChecklistEnBase,
  type Equipe,
} from "./aide/session"

// Non couvert ici, à faire ou à reprendre ailleurs (rien n'est présumé vérifié) :
// - étape 1 : l'ASA de la licence (aucun helper ne crée de contact ASA) et la dépense « Montant payé » décidée dans Budget ;
// - étape 2 : l'équipage est choisi dans Saison, mais le test ne vérifie pas le panneau au-delà de la licence ;
// - étape 4 : le lien de partage (ouverture publique comptée, révocation, lien refusé) : documents-echeances-partages.spec.ts ;
// - étape 5 : la licence d'une autre personne (404) et la photo d'une liste fermée (404) ne sont pas encore vérifiées ici ;
//   le logo de Voiture (200) non plus ;
// - étape 8 : l'ignorance d'une proposition (qui ne revient pas) n'est pas testée ;
// - étape 9 : le palier et le « Ajouter au modèle » du débrief ne sont pas encore vérifiés ici ;
// - étape 10 : pas de point assigné au membre retiré, donc pas de « Réassigner les points » à l'écran.

const ANNEE = new Date().getFullYear() + 1
const PDF = path.resolve("e2e/fichiers/preuve.pdf")
const PHOTO = path.resolve("e2e/fichiers/photo.jpg")
const NOM_DOSSIER_GESTION = "Gestion du lot 5"
const TITRE_PLAN = "Plan de sécurité du lot 5"
const REPONSE_ACTION = (r: Response) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined

// Ouvre une épreuve de Saison par clics : tuile, liste, puis l'épreuve. Son panneau « Prêt pour l'épreuve ? » est l'onglet par défaut.
async function ouvrirEpreuveDansSaison(page: Page, nom: string): Promise<void> {
  await page.goto("/qg")
  await tuilesDuQg(page)
    .filter({ has: page.getByRole("heading", { name: "Saison", exact: true }) })
    .click()
  await page.getByRole("link", { name: "Liste", exact: true }).click()
  await page.getByRole("link", { name: nom }).first().click()
  await expect(page).toHaveURL(/\/apps\/saison\/epreuves\/[0-9a-f-]{36}/)
}

// Indice de préparation de l'épreuve, lu sur le libellé « Préparation : N pour cent » (jamais sur la couleur seule).
async function indicePreparation(page: Page): Promise<number> {
  const libelle = await page.locator('[aria-label^="Préparation : "]').first().getAttribute("aria-label")
  return Number(libelle?.match(/(\d+) pour cent/)?.[1] ?? "-1")
}

// Capture d'une étape : 1440 et 360 px, clair et sombre. Le thème de l'app est une préférence du membre (Réglages), pas le
// thème du système : on le règle par Réglages, puis on revient à l'écran (`revenir`) pour capturer. La préférence est
// remise sur sombre (valeur par défaut) à la fin.
async function capturerEtape(page: Page, nom: string, revenir: () => Promise<void>): Promise<void> {
  for (const theme of ["clair", "sombre"] as const) {
    await choisirTheme(page, theme)
    await revenir()
    for (const [largeur, hauteur, suffixe] of [
      [1440, 900, "1440x900"],
      [360, 740, "360x740"],
    ] as const) {
      await page.setViewportSize({ width: largeur, height: hauteur })
      // Animations finies avant la capture : une boîte encore en glissement ne se lit pas (étape 7 à 360 px).
      await page.screenshot({ path: path.join(DOSSIER_CAPTURES, `lot5-${nom}-${suffixe}-${theme}.png`), fullPage: true, animations: "disabled" })
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 })
}

// Accepte la proposition « Créer les listes » : les listes de l'engagement existent ensuite.
async function accepterListes(page: Page, equipe: Equipe, entryId: string): Promise<void> {
  await page.goto("/qg")
  await page.getByRole("button", { name: /Boîte d'actions/ }).click()
  const boite = page.getByRole("dialog")
  await expect(boite.getByRole("heading", { name: "Créer les listes de l'engagement" })).toBeVisible()
  await boite.getByRole("button", { name: "Accepter", exact: true }).click()
  await expect.poll(() => statutAction(equipe, `creer_listes:${entryId}`)).toBe("decidee")
}

// Roulage par le menu « + » du Garage (la boîte de la voiture passe en zone rouge au-delà du seuil).
async function rouler(page: Page, kilometres: string): Promise<void> {
  await page.goto("/qg")
  await page.locator('a[href="/apps/garage"]').filter({ has: page.locator("h2") }).click()
  await expect(page.getByRole("heading", { name: "Atelier", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Ajouter", exact: true }).click()
  await page.getByRole("menuitem", { name: "Roulage", exact: true }).click()
  await page.getByLabel("Kilomètres roulés").fill(kilometres)
  await page.getByRole("button", { name: "Enregistrer le roulage", exact: true }).click()
  await expect(page).toHaveURL(/\/apps\/garage\?vehicule=/)
}

test("lot 5 · parcours : Équipe, Saison, Documents, Check-lists, Garage, Équipe après l'épreuve, membre retiré", async ({ page, equipe, browser }) => {
  test.setTimeout(900_000)
  await page.setViewportSize({ width: 1440, height: 900 })

  // Données de l'épreuve : une épreuve dans trois jours, sa Saxo, le modèle de Check-lists de la team à échéance J-7 (donc déjà
  // dû : les points critiques entrent dans la boîte). L'engagement, lui, se crée par Saison (étape 2), avec l'équipage.
  const { eventId, vehicleId } = await preparerEpreuveChecklist(equipe, { debutDans: 3, echeanceRelative: "j_moins_7" })
  const nomEpreuve = `Rallye Check-lists ${equipe.horodatage}`
  const nomVoiture = `Saxo ${equipe.horodatage}`
  const organes = await preparerAtelierSaxo(equipe, vehicleId)

  await connecterParLien(page, equipe)

  let piloteId = ""
  let copiloteId = ""
  // Lue à l'étape 1 (pièce de la licence de Théo), relue par l'assistance à l'étape 5.
  let urlLicence: string | null = null
  // Ouvert à l'étape 5, fermé en fin de test : ses requêtes gardent sa session d'assistance.
  let contexteAssistance: BrowserContext | undefined
  await test.step("1. Équipe : pilote et copilote, licence avec document joint, casque", async () => {
    piloteId = await creerPersonne(page, "Théo", "Pilote", "Pilote")
    await ajouterLicence(page, "Licence FFSA régionale", "L-PIL-5", `${ANNEE}-12-31`, PDF)
    urlLicence = await page.locator('a[href^="/api/fichiers/"]').first().getAttribute("href")
    expect(urlLicence).toMatch(/^\/api\/fichiers\/[^/?#]+$/)
    await ajouterEquipement(page, "Casque", "Arai")

    copiloteId = await creerPersonne(page, "Nina", "Copilote", "Copilote")
    // La licence de la copilote expire avant l'épreuve : le point « Prêt pour l'épreuve ? » est ouvert (étape 2).
    await ajouterLicence(page, "Licence FFSA régionale", "L-COP-5", jourParis(-10))
  })

  let entryId = ""
  let indiceAvant = -1
  await test.step("2. Saison : l'engagement avec le binôme ; licence expirée, « Régler » mène à la fiche, correction, point réglé", async () => {
    await ouvrirEpreuveDansSaison(page, nomEpreuve)
    await page.getByRole("link", { name: "Engagements", exact: true }).click()
    await page.getByRole("button", { name: "Engager une voiture", exact: true }).click()
    const tiroir = page.getByRole("dialog")
    await tiroir.getByLabel("Voiture", { exact: true }).selectOption({ label: nomVoiture })
    await tiroir.getByLabel("Pilote", { exact: true }).selectOption({ label: "Théo Pilote" })
    await tiroir.getByLabel("Copilote", { exact: true }).selectOption({ label: "Nina Copilote" })
    await envoyer(page, tiroir.getByRole("button", { name: "Engager la voiture", exact: true }))
    entryId = (await engagementsEnBase(equipe)).at(-1)?.id ?? ""
    expect(entryId).not.toBe("")

    // Le panneau « Prêt pour l'épreuve ? » : la licence de la copilote expire, le point est ouvert.
    await page.getByRole("link", { name: "Prêt pour l'épreuve ?", exact: true }).click()
    await expect(page.getByText(/Licence de Nina expire le/)).toBeVisible()
    indiceAvant = await indicePreparation(page)

    // « Régler » mène à l'onglet Licences de la copilote dans Équipe. Le lien est celui de la ligne « Licence de Nina » : le paiement en a un aussi.
    const ligneLicence = page.locator("li").filter({ hasText: "Licence de Nina expire le" })
    await ligneLicence.getByRole("link", { name: "Régler", exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/apps/equipe/personnes/${copiloteId}\\?onglet=licences`))
    await expect(page.getByRole("heading", { name: "Nina Copilote", exact: true })).toBeVisible()

    // Correction : la licence est renouvelée jusqu'à la fin de l'année.
    await page.getByRole("button", { name: "Modifier", exact: true }).first().click()
    const tiroirLicence = page.getByRole("dialog")
    await tiroirLicence.getByLabel("Valable jusqu'au").fill(`${ANNEE}-12-31`)
    await envoyer(page, tiroirLicence.getByRole("button", { name: "Enregistrer", exact: true }))

    // Retour à Saison : le point est réglé, il ne reste plus d'expiration, et l'indice suit.
    await ouvrirEpreuveDansSaison(page, nomEpreuve)
    await page.getByRole("link", { name: "Prêt pour l'épreuve ?", exact: true }).click()
    await expect(page.getByText(/Licence de Nina expire le/)).toHaveCount(0)
    await expect.poll(() => indicePreparation(page)).toBeGreaterThan(indiceAvant)
    // Retour à l'écran après le réglage du thème (Réglages quitte la page) : l'épreuve, onglet « Prêt pour l'épreuve ? ».
    await capturerEtape(page, "etape-2-pret", async () => {
      await page.goto(`/apps/saison/epreuves/${eventId}?onglet=pret`)
      await expect(page.getByRole("link", { name: "Prêt pour l'épreuve ?", exact: true })).toBeVisible()
    })
  })

  await test.step("3. Équipe : une personne d'assistance répond « vient », puis est affectée sur Prochaine épreuve ; sa tâche se marque faite", async () => {
    await creerPersonne(page, "Bruno", "Vidal", "Assistance")
    await ouvrirOnglet(page, "Disponibilités")
    await page.getByRole("button", { name: "Répondre", exact: true }).click()
    await page.getByRole("dialog").getByLabel("Vient", { exact: true }).check()
    await envoyer(page, page.getByRole("dialog").getByRole("button", { name: "Enregistrer ma réponse", exact: true }))
    await expect(page.getByText("Réponse : Vient", { exact: true })).toBeVisible()

    await page.goto("/apps/equipe/epreuve")
    await expect(page.getByRole("heading", { name: nomEpreuve, exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Affecter une personne", exact: true }).click()
    const tiroir = page.getByRole("dialog")
    await tiroir.getByLabel("Personne", { exact: true }).selectOption({ label: "Bruno Vidal" })
    await tiroir.getByLabel("Rôle d'épreuve", { exact: true }).selectOption({ label: "Logistique" })
    await envoyer(page, tiroir.getByRole("button", { name: "Affecter", exact: true }))
    // La ligne de tâche est le li sans li à l'intérieur : la carte de la personne qui la contient n'est pas visée.
    const tache = page.locator("li:not(:has(li))").filter({ hasText: "Logistique · à faire" })
    await expect(tache).toBeVisible()
    await tache.getByRole("button", { name: "Marquer fait", exact: true }).click()
    await expect(page.getByText("Logistique · fait")).toBeVisible()
  })

  await test.step("4. Documents : une assurance à vingt jours, l'action de renouvellement sort par « Reporter »", async () => {
    await page.goto("/qg")
    await tuilesDuQg(page)
      .filter({ has: page.getByRole("heading", { name: "Documents", exact: true }) })
      .click()
    await expect(page.getByRole("heading", { name: "Coffre-fort", exact: true })).toBeVisible()
    await page.getByRole("link", { name: "Coffre-fort", exact: true }).click()
    await page.getByRole("button", { name: "Document", exact: true }).click()
    const tiroir = page.getByRole("dialog")
    await tiroir.getByLabel("Titre", { exact: true }).fill("Assurance de l'association")
    await tiroir.getByLabel("Type de document", { exact: true }).selectOption("assurance_asso")
    await tiroir.getByLabel("Dossier", { exact: true }).selectOption({ label: "Assurances" })
    await tiroir.getByLabel("Date de validité", { exact: true }).fill(jourParis(20))
    await envoyer(page, tiroir.getByRole("button", { name: "Ajouter le document", exact: true }))
    expect(await documentEnBase(equipe, "Assurance de l'association")).not.toBeNull()

    await page.goto("/qg")
    await page.getByRole("button", { name: /Boîte d'actions/ }).click()
    const boite = page.getByRole("dialog")
    await expect(boite.getByText(/Renouveler Assurance de l'association : expire le/)).toBeVisible()
    const reponse = page.waitForResponse(REPONSE_ACTION)
    await boite.getByRole("button", { name: "Reporter d'une semaine", exact: true }).click()
    await reponse
    await expect(boite.getByText(/Renouveler Assurance de l'association/)).toHaveCount(0)
    await page.keyboard.press("Escape")
  })

  // Preuve principale du §3.1 : un fichier de dossier caché répond 404 à l'assistance, 200 une fois partagé, 404 après retrait.
  // Le fichier s'ouvre par son URL directe /api/fichiers/<id> : elle se lit sur la fiche du document, comme pour la responsable.
  await test.step("5. Assistance : dossier caché, fichier 404, 200 après partage interne, 404 après retrait", async () => {
    const assistance = await ajouterMembreConnectable(equipe, "assistance", "-l5")
    const personneAssistance = await rattacherPersonneAuCompte(equipe, assistance, "Anne", "Assistance")

    await tuilesDuQg(page)
      .filter({ has: page.getByRole("heading", { name: "Documents", exact: true }) })
      .click()
    await expect(page.getByRole("heading", { name: "Coffre-fort", exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Dossier", exact: true }).click()
    const tiroirDossier = page.getByRole("dialog")
    await tiroirDossier.getByLabel("Nom", { exact: true }).fill(NOM_DOSSIER_GESTION)
    await tiroirDossier.getByLabel("Qui peut voir", { exact: true }).selectOption("gestion")
    await envoyer(page, tiroirDossier.getByRole("button", { name: "Créer le dossier", exact: true }))

    await page.getByRole("button", { name: "Document", exact: true }).click()
    const tiroirPlan = page.getByRole("dialog")
    await tiroirPlan.getByLabel("Titre", { exact: true }).fill(TITRE_PLAN)
    await tiroirPlan.getByLabel("Type de document", { exact: true }).selectOption("autre")
    await tiroirPlan.getByLabel("Dossier", { exact: true }).selectOption({ label: NOM_DOSSIER_GESTION })
    await tiroirPlan.locator('input[type="file"]').setInputFiles(PDF)
    await expect(tiroirPlan.getByRole("button", { name: "Remplacer", exact: true })).toBeVisible()
    await envoyer(page, tiroirPlan.getByRole("button", { name: "Ajouter le document", exact: true }))

    const plan = await documentEnBase(equipe, TITRE_PLAN)
    expect(plan).not.toBeNull()
    // Le plan est rangé dans le dossier « gestion » : le coffre n'affiche que le dossier, on l'ouvre avant le document.
    await page.getByRole("link", { name: new RegExp(NOM_DOSSIER_GESTION) }).click()
    await page.getByRole("link", { name: TITRE_PLAN }).click()
    const urlFichier = await page.locator('a[href^="/api/fichiers/"]').first().getAttribute("href")
    expect(urlFichier).toMatch(/^\/api\/fichiers\/[^/?#]+$/)

    contexteAssistance = await browser.newContext()
    const assist = await contexteAssistance.newPage()
    await assist.goto(`/connexion/lien?t=${assistance.secretLien}`)
    await assist.waitForURL(/\/qg$/)
    await tuilesDuQg(assist)
      .filter({ has: assist.getByRole("heading", { name: "Documents", exact: true }) })
      .click()
    await expect(assist.getByRole("heading", { name: "Coffre-fort", exact: true })).toBeVisible()
    await expect(assist.getByRole("link", { name: new RegExp(NOM_DOSSIER_GESTION) })).toHaveCount(0)
    expect((await contexteAssistance.request.get(urlFichier!)).status()).toBe(404)

    // La licence de Théo : la responsable la lit (contrôle : 200), Anne, qui n'est pas Théo, la reçoit en 404.
    expect((await page.request.get(urlLicence!)).status()).toBe(200)
    expect((await contexteAssistance.request.get(urlLicence!)).status()).toBe(404)

    // La responsable partage le plan : le fichier s'ouvre, le dossier apparaît avec ce seul document.
    await page.getByRole("button", { name: "Partager avec un membre", exact: true }).click()
    const tiroirPartage = page.getByRole("dialog")
    await tiroirPartage.getByLabel("Membre", { exact: true }).selectOption({ label: "Anne Assistance" })
    await envoyer(page, tiroirPartage.getByRole("button", { name: "Partager", exact: true }))
    expect(await accesDocumentEnBase(equipe, plan!.id, personneAssistance)).toBe("lecture")

    await assist.reload()
    await expect(assist.getByRole("link", { name: new RegExp(NOM_DOSSIER_GESTION) })).toContainText("1 document")
    expect((await contexteAssistance.request.get(urlFichier!)).status()).toBe(200)

    // Retrait du partage : l'accès est retiré en base et le fichier répond de nouveau 404.
    await page.getByRole("button", { name: "Retirer", exact: true }).click()
    const tiroirRetrait = page.getByRole("dialog")
    await envoyer(page, tiroirRetrait.getByRole("button", { name: "Retirer le partage", exact: true }))
    expect(await accesDocumentEnBase(equipe, plan!.id, personneAssistance)).toBeNull()

    await assist.reload()
    expect((await contexteAssistance.request.get(urlFichier!)).status()).toBe(404)
  })

  await test.step("6. Check-lists : « Créer les listes » acceptée ; le point critique à J-7 est dans la boîte, levé à la coche", async () => {
    await accepterListes(page, equipe, entryId)
    // Le point critique du modèle est dans la boîte (la liste est à échéance proche) : la carte porte le libellé du point.
    await page.goto("/qg")
    await page.getByRole("button", { name: /Boîte d'actions/ }).click()
    const boite = page.getByRole("dialog")
    await expect(boite.getByText("Triangle de présentation", { exact: true })).toBeVisible()
    await page.keyboard.press("Escape")

    // Coche : le point est fait, l'action sort de la boîte (levée, pas décidée).
    await page.goto("/apps/checklist")
    await page.getByRole("region", { name: "Par engagement" }).getByRole("link").first().click()
    await expect(page).toHaveURL(/\/apps\/checklist\/liste\/[^?]+$/)
    const reponse = page.waitForResponse(REPONSE_ACTION)
    await page.locator("li").filter({ hasText: "Triangle de présentation" }).getByRole("button", { name: "Faire", exact: true }).first().click()
    await reponse
    await expect.poll(() => statutPointChecklistEnBase(equipe, "Triangle de présentation")).toBe("fait")
    await expect.poll(() => statutActionTitreEnBase(equipe, "point_critique:", "Triangle de présentation")).toBe("annulee")
  })

  await test.step("7. Liaisons : problème sur un point lié à un organe, ordre créé à l'acceptation, visible dans Travaux ; sans organe, une tâche", async () => {
    await page.getByRole("button", { name: "+ Ajouter un point", exact: true }).click()
    const ajout = page.getByRole("dialog")
    await ajout.getByLabel("Libellé du point", { exact: true }).fill("Niveau d'huile moteur")
    await envoyer(page, ajout.getByRole("button", { name: "Ajouter le point", exact: true }))
    await page.locator("li").filter({ hasText: "Niveau d'huile moteur" }).getByRole("link", { name: "Détail", exact: true }).click()
    const fiche = page.getByRole("dialog").first()
    await fiche.getByLabel("Objet lié", { exact: true }).selectOption(`organe_garage|${organes.moteur}`)
    const reponseLien = page.waitForResponse(REPONSE_ACTION)
    await fiche.getByRole("button", { name: "Enregistrer le lien", exact: true }).click()
    await reponseLien
    await expect.poll(() => lienPointChecklistEnBase(equipe, "Niveau d'huile moteur")).toEqual({ lienType: "organe_garage", lienId: organes.moteur })

    // Photo sur ce point : la liste est fermée à l'assistance (par défaut). La responsable la lit (200, contrôle) ;
    // Anne, membre de l'assistance, la reçoit en 404 (§3.1).
    await fiche.getByRole("button", { name: "Ajouter une photo", exact: true }).click()
    const tiroirPhoto = page.getByRole("dialog").last()
    await tiroirPhoto.locator('input[type="file"]').setInputFiles(PHOTO)
    const reponsePhoto = page.waitForResponse(REPONSE_ACTION)
    await tiroirPhoto.getByRole("button", { name: "Envoyer la photo", exact: true }).click()
    await reponsePhoto
    await expect(page.getByRole("dialog")).toHaveCount(1)
    const urlPhoto = await fiche.locator('img[src^="/api/fichiers/"]').first().getAttribute("src")
    expect(urlPhoto).toMatch(/^\/api\/fichiers\/[^/?#]+$/)
    expect((await page.request.get(urlPhoto!)).status()).toBe(200)
    expect((await contexteAssistance!.request.get(urlPhoto!)).status()).toBe(404)

    const reponseProbleme = page.waitForResponse(REPONSE_ACTION)
    await fiche.getByRole("button", { name: "Problème", exact: true }).click()
    await reponseProbleme
    await expect.poll(() => statutPointChecklistEnBase(equipe, "Niveau d'huile moteur")).toBe("probleme")
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toHaveCount(0)

    // Un point lié à un organe : Garage propose un ordre, rien n'est créé avant l'acceptation.
    await page.getByRole("button", { name: /Boîte d'actions/ }).click()
    const boite = page.getByRole("dialog")
    await expect(boite.getByText("Problème signalé : Moteur", { exact: true })).toBeVisible()
    await expect.poll(() => ordresEnBase(equipe, "Problème signalé : Moteur")).toEqual([])
    const reponseOrdre = page.waitForResponse(REPONSE_ACTION)
    await boite.getByRole("button", { name: "Créer l'ordre", exact: true }).click()
    await reponseOrdre
    await expect.poll(async () => (await ordresEnBase(equipe, "Problème signalé : Moteur")).map((ordre) => ordre.vehicle_component_id)).toEqual([organes.moteur])
    await page.keyboard.press("Escape")
    await expect(boite).toHaveCount(0)

    // L'ordre est visible dans Travaux, par les menus.
    await page.getByRole("navigation", { name: "Apps" }).getByRole("link", { name: "Garage", exact: true }).click()
    await page.getByRole("navigation", { name: "Menu de Garage" }).getByRole("link", { name: "Travaux", exact: true }).click()
    await expect(page.getByText("Problème signalé : Moteur").first()).toBeVisible()

    // Un point sans organe en problème : une tâche du socle, une seule, et la boîte la montre.
    await page.getByRole("navigation", { name: "Apps" }).getByRole("link", { name: "Check-lists", exact: true }).click()
    await page.getByRole("region", { name: "Par engagement" }).getByRole("link").first().click()
    await expect(page).toHaveURL(/\/apps\/checklist\/liste\/[^?]+$/)
    await page.locator("li").filter({ hasText: "Trousse de secours" }).getByRole("link", { name: "Détail", exact: true }).click()
    const ficheTrousse = page.getByRole("dialog").first()
    const reponseTrousse = page.waitForResponse(REPONSE_ACTION)
    await ficheTrousse.getByRole("button", { name: "Problème", exact: true }).click()
    await reponseTrousse
    await expect.poll(() => statutPointChecklistEnBase(equipe, "Trousse de secours")).toBe("probleme")
    await expect.poll(() => tachesPointChecklistEnBase(equipe, "Trousse de secours")).toBe(1)
    await page.keyboard.press("Escape")
    await page.goto("/qg")
    await page.getByRole("button", { name: /Boîte d'actions/ }).click()
    await expect(page.getByRole("dialog").getByText(/Problème : Trousse de secours/)).toBeVisible()
    // Retour au QG après le réglage du thème, la boîte se rouvre à la main (elle ne survit pas à la sortie de l'écran).
    await capturerEtape(page, "etape-7-boite-liaisons", async () => {
      await page.goto("/qg")
      await page.getByRole("button", { name: /Boîte d'actions/ }).click()
      await expect(page.getByRole("dialog").getByText(/Problème : Trousse de secours/)).toBeVisible()
    })
    await page.keyboard.press("Escape")
  })

  await test.step("8. Propositions : pièce en zone rouge, proposition dans la boîte, acceptée, point ajouté avec son lien", async () => {
    await rouler(page, "16000")
    const titre = "Remplacer la pièce : Boîte de vitesses"
    await page.goto("/apps/checklist")
    await page.getByRole("button", { name: /Boîte d'actions/ }).click()
    await expect(page.getByRole("dialog").getByText(titre, { exact: true })).toBeVisible()
    expect(await lienPointChecklistEnBase(equipe, titre), "point ajouté avant acceptation").toBeNull()
    const ligne = page.getByRole("dialog").locator("li").filter({ hasText: titre })
    await envoyerSansFermeture(page, ligne.getByRole("button", { name: "Accepter", exact: true }))
    await expect.poll(() => statutActionTitreEnBase(equipe, "proposition:", titre)).toBe("decidee")
    await page.keyboard.press("Escape")
    await expect.poll(() => lienPointChecklistEnBase(equipe, titre)).toEqual({ lienType: "organe_garage", lienId: organes.boite })
  })

  await test.step("9. Après l'épreuve : résultat validé, statistiques et Binômes à jour, une seule fois", async () => {
    await ajouterResultatValideEnBase(equipe, entryId, 3)
    await page.goto(`/apps/equipe/personnes/${piloteId}?onglet=statistiques`)
    await expect(page.getByRole("heading", { name: "Statistiques", exact: true })).toBeVisible()
    const valeur = (libelle: string) => page.locator(`xpath=//dt[normalize-space(.)="${libelle}"]/following-sibling::dd`)
    await expect(valeur("Épreuves")).toHaveText("1")
    await expect(valeur("Arrivées")).toHaveText("1")
    // Une seule fois : recharger ne compte pas l'épreuve une seconde fois.
    await page.reload()
    await expect(valeur("Épreuves")).toHaveText("1")

    await page.goto("/apps/equipe/binomes")
    await expect(page.getByRole("heading", { name: "Binômes", exact: true })).toBeVisible()
    await expect(page.getByText("Théo Pilote", { exact: false }).first()).toBeVisible()
    await capturerEtape(page, "etape-9-fiche-binomes", async () => {
      await page.goto("/apps/equipe/binomes")
      await expect(page.getByRole("heading", { name: "Binômes", exact: true })).toBeVisible()
    })
  })

  await test.step("10. Membre retiré : un point qui lui est affecté, « Réassigner les points » dans la boîte, réassigné ; « Anciens membres » garde son nom", async () => {
    // La personne de Lou est celle du compte (rattachement) : une seconde fiche « Lou Retiree » non liée au compte ferait
    // passer la réassignation à côté de la bonne personne.
    const membre = await ajouterEquipier(equipe)
    await rattacherPersonneAuCompte(equipe, membre, "Lou", "Retiree")

    // Un point de la liste est affecté à Lou (le point est en problème : il reste à traiter).
    await page.getByRole("navigation", { name: "Apps" }).getByRole("link", { name: "Check-lists", exact: true }).click()
    await page.getByRole("region", { name: "Par engagement" }).getByRole("link").first().click()
    await expect(page).toHaveURL(/\/apps\/checklist\/liste\/[^?]+$/)
    await page.locator("li").filter({ hasText: "Trousse de secours" }).getByRole("link", { name: "Détail", exact: true }).click()
    const ficheAffectee = page.getByRole("dialog").first()
    const affectation = ficheAffectee.getByRole("region", { name: "Affectation" })
    await affectation.getByRole("combobox").selectOption({ label: "Lou Retiree" })
    const reponseAffectation = page.waitForResponse(REPONSE_ACTION)
    await affectation.getByRole("button", { name: "Enregistrer l'affectation", exact: true }).click()
    await reponseAffectation
    await page.keyboard.press("Escape")

    // Réglages, rubrique Membres : Lou quitte la team par « Retirer » de sa carte (le seul chemin qui émet l'événement).
    await page.getByRole("navigation", { name: "Apps" }).getByRole("link", { name: "Réglages", exact: true }).click()
    await page.getByRole("link", { name: "Membres", exact: true }).click()
    await page.getByRole("listitem").filter({ hasText: membre.email }).getByRole("button", { name: "Retirer", exact: true }).click()
    await envoyer(page, page.getByRole("dialog").getByRole("button", { name: "Retirer", exact: true }))

    // La boîte porte « Réassigner les points » pour Lou (lien vers les listes, pas de décision au clic).
    await page.getByRole("button", { name: /Boîte d'actions/ }).click()
    await expect(page.getByRole("dialog").getByText("Réassigner les points de Lou Retiree", { exact: true })).toBeVisible({ timeout: 15_000 })
    await page.keyboard.press("Escape")

    // Réassignation : le point passe à Théo, l'action sort (levée, pas décidée).
    await page.getByRole("navigation", { name: "Apps" }).getByRole("link", { name: "Check-lists", exact: true }).click()
    await page.getByRole("region", { name: "Par engagement" }).getByRole("link").first().click()
    await page.locator("li").filter({ hasText: "Trousse de secours" }).getByRole("link", { name: "Détail", exact: true }).click()
    const ficheReassignee = page.getByRole("dialog").first()
    const reponseReassignation = page.waitForResponse(REPONSE_ACTION)
    await ficheReassignee.getByRole("region", { name: "Affectation" }).getByRole("combobox").selectOption({ label: "Théo Pilote" })
    await ficheReassignee.getByRole("region", { name: "Affectation" }).getByRole("button", { name: "Enregistrer l'affectation", exact: true }).click()
    await reponseReassignation
    await page.keyboard.press("Escape")
    await expect.poll(() => statutActionTitreEnBase(equipe, "reassigner_points:", "Réassigner les points de Lou Retiree")).toBe("annulee")

    // « Anciens membres » garde son nom : Lou n'est plus membre, sa fiche et son historique restent.
    await page.getByRole("navigation", { name: "Apps" }).getByRole("link", { name: "Équipe", exact: true }).click()
    await expect(page.getByRole("heading", { name: "L'équipe", exact: true })).toBeVisible()
    // Le bouton porte le compteur : « Anciens membres (1) ».
    await page.getByRole("button", { name: /^Anciens membres/ }).click()
    await expect(page.getByRole("dialog").getByText("Lou Retiree", { exact: false })).toBeVisible()
  })

  // Fin du parcours : la session d'assistance ouverte à l'étape 5 se ferme ici.
  await contexteAssistance?.close()
})
