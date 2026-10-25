// Parcours complet du Garage (tâche 4.7, brief §1) : les neuf étapes du lot 4, dans l'ordre où un responsable les vit, sur
// une team et une voiture (une Saxo). Le parcours part du QG et passe par les tuiles, les menus, les liens et les boutons ;
// seule l'entrée est une URL. Les données qu'aucun écran ne crée ici (saison, épreuves, spéciales, inscription à l'épreuve
// suivante, fournisseur, équipiers) passent par les aides de la base, comme dans les autres specs. Les vérifications en base
// portent sur les règles en jeu : usure appliquée une seule fois (journal d'usure, km, épreuves, rev), proposition Budget
// décidée. Captures 1440 et 360 px des étapes 1, 6, 7 et 9 dans docs/captures/ (garage-parcours-*), relues avant commit.
import path from "node:path"

import type { Browser, Page } from "@playwright/test"

import { TYPES_DEFAUT } from "../src/apps/garage/types-defaut"

import { envoyer } from "./aide/envoi"
import { jourParis } from "./aide/dates"
import {
  fournisseurDeTest,
  journalUsureResultatEnBase,
  organesDeLaVoitureEnBase,
  piecesDeCommandeEnBase,
  piecesEnStockDeTypeEnBase,
  piecesMonteesDeLaVoitureEnBase,
  posesDeLOrganeEnBase,
} from "./aide/garage"
import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import {
  ajouterEpreuveEnBase,
  ajouterMembreConnectable,
  ajouterSpecialeEnBase,
  ajouterVoitureSaxo,
  depenseBudgetParLibelle,
  donnerAccesSaison,
  engagerVehiculeEnBase,
  preparerSaison,
  type Equipe,
  type Membre,
} from "./aide/session"

const DOSSIER = path.join(__dirname, "..", "docs", "captures")
const BUREAU = { width: 1440, height: 900 }
const TELEPHONE = { width: 360, height: 740 }
const ANNEE = new Date().getFullYear()
const SAXO = "Saxo parcours e2e"
const PIECE_ACHETEE = "Plaquettes avant"
const PROPOSITION_BUDGET = "Pièces achetées (Garage)"
const MONTANT_PIECES_CENTIMES = 2 * 1250
const KM_SPECIALE = 12.5
const TITRE_NON_SUIVIE = "Le Garage ne suit pas encore cette voiture."

const EPREUVE_PASSEE = "Rallye parcours e2e"
const EPREUVE_SUIVANTE = "Rallye suivant parcours e2e"
const EPREUVE_ABANDON = "Rallye abandon parcours e2e"

// Capture pleine page : éléments fixes masqués, sauf le tiroir ouvert (même convention que les autres specs du Garage).
async function capturer(page: Page, nom: string): Promise<void> {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" })
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>("body *").forEach((element) => {
      if (element.closest('[role="dialog"]')) return
      if (getComputedStyle(element).position === "fixed") element.style.display = "none"
    })
  })
  await page.screenshot({ path: path.join(DOSSIER, nom), fullPage: true, animations: "disabled" })
}

// Une étape captée à 1440 px, puis à 360 px sans défilement horizontal ; le bureau est rétabli ensuite.
async function capturerDeuxTailles(page: Page, nom: string): Promise<void> {
  await page.setViewportSize(BUREAU)
  await capturer(page, `${nom}-1440.png`)
  await page.setViewportSize(TELEPHONE)
  const deborde = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(deborde, `défilement horizontal à 360 px (${nom})`).toBe(false)
  await capturer(page, `${nom}-360.png`)
  await page.setViewportSize(BUREAU)
}

// Un membre connecté dans son propre contexte, comme dans les specs de Saison.
async function connecterMembre(browser: Browser, membre: Membre & { secretLien: string }): Promise<{ page: Page; fermer: () => Promise<void> }> {
  const contexte = await browser.newContext()
  const page = await contexte.newPage()
  await page.goto(`/connexion/lien?t=${membre.secretLien}`)
  await page.waitForURL(/\/qg$/)
  return { page, fermer: () => contexte.close() }
}

// Tuile d'une app sur le QG (le lien avec son titre : les menus ont les mêmes libellés).
function tuile(page: Page, cle: string) {
  return page.locator(`a[href="/apps/${cle}"]`).filter({ has: page.locator("h2") })
}

// Ouvre le Garage depuis le QG et attend son atelier avant de cliquer dans son menu : sans cette attente, un clic de menu
// part pendant le chargement de l'app, et sa navigation peut être reprise par celle de la tuile.
async function ouvrirGarage(page: Page): Promise<void> {
  await tuile(page, "garage").click()
  await expect(page.getByRole("heading", { name: "Atelier", exact: true })).toBeVisible()
}

// Clic sur un lien du menu du Garage, navigation contrôlée. Un clic peut être perdu juste après l'arrivée sur l'Atelier :
// au run 40148965567, « Casses » n'a jamais navigué (l'URL est restée sur l'Atelier), cause non établie. Le clic est relancé
// une fois et compté dans le log, comme le 418 toléré ; une seconde perte fait échouer le test.
async function cliquerMenuGarage(page: Page, nom: string, chemin: RegExp): Promise<void> {
  const lien = page.getByRole("link", { name: nom, exact: true })
  await lien.click()
  const arrive = await expect(page).toHaveURL(chemin, { timeout: 5_000 }).then(
    () => true,
    () => false,
  )
  if (!arrive) {
    console.log(`clic sur « ${nom} » perdu : relancé`)
    await lien.click()
  }
  await expect(page).toHaveURL(chemin)
}

// Retour au QG par le lien d'enveloppe, comme John. Sans effet sur le QG.
async function allerAuQg(page: Page): Promise<void> {
  if (/\/qg$/.test(new URL(page.url()).pathname)) return
  await page.getByRole("link", { name: /retour au QG/ }).filter({ visible: true }).first().click()
  await page.waitForURL(/\/qg$/)
}

// L'épreuve, ouverte par Saison (calendrier en liste, puis l'épreuve). Son onglet par défaut est « Prêt pour l'épreuve ? ».
async function ouvrirEpreuveDansSaison(page: Page, nom: string): Promise<void> {
  await allerAuQg(page)
  await tuile(page, "saison").click()
  await page.getByRole("link", { name: "Liste", exact: true }).click()
  await page.getByRole("link", { name: nom }).first().click()
  await expect(page).toHaveURL(/\/apps\/saison\/epreuves\/[0-9a-f-]{36}/)
}

// Valeur lisible de l'indice de préparation (« Préparation : N pour cent »), ou null si l'écran ne l'affiche pas.
async function indiceDePreparation(page: Page): Promise<string | null> {
  const indice = page.locator('[aria-label^="Préparation : "]').first()
  return (await indice.count()) > 0 ? indice.getAttribute("aria-label") : null
}

// Pourcentage de fiabilité de la voiture, lu à l'écran (« Zone · N % »).
async function fiabiliteDeLaVoiture(page: Page): Promise<number> {
  const libelle = page.getByText("Fiabilité de la voiture", { exact: true }).locator("xpath=following-sibling::span[1]")
  const texte = await libelle.innerText()
  const pourcent = /(\d+)\s*%/.exec(texte)
  expect(pourcent, `fiabilité lisible à l'écran : « ${texte} »`).not.toBeNull()
  return Number(pourcent?.[1])
}

// Identifiant de l'organe d'un type (vehicle_component) : pour choisir un organe par son lien ou son select.
async function organeDeType(equipe: Equipe, vehicleId: string, cle: string): Promise<string> {
  const organe = (await organesDeLaVoitureEnBase(equipe, vehicleId)).find((ligne) => ligne.cle === cle)
  if (!organe) throw new Error(`Organe « ${cle} » absent de l'atelier.`)
  return organe.id
}

// Le repère ou la ligne d'un organe de l'atelier, par son identifiant : un clic, pas une URL.
function lienOrgane(page: Page, organeId: string) {
  return page.locator(`a[href="/apps/garage/organes/${organeId}"]`).filter({ visible: true }).first()
}

test("parcours complet du Garage : les neuf étapes du lot 4, de la préparation de l'atelier à la casse", async ({ browser, page, equipe }) => {
  test.setTimeout(900_000)

  // Données de départ : une voiture, une saison, trois épreuves (deux passées, une à venir), des spéciales, l'inscription à
  // l'épreuve suivante, un fournisseur, deux équipiers avec accès à Saison.
  const vehicleId = await ajouterVoitureSaxo(equipe, SAXO)
  const saisonId = await preparerSaison(equipe, ANNEE)
  const passee = await ajouterEpreuveEnBase(equipe, saisonId, EPREUVE_PASSEE, jourParis(-60), jourParis(-59))
  const suivante = await ajouterEpreuveEnBase(equipe, saisonId, EPREUVE_SUIVANTE, jourParis(30), jourParis(31))
  const abandon = await ajouterEpreuveEnBase(equipe, saisonId, EPREUVE_ABANDON, jourParis(-30), jourParis(-29))
  await ajouterSpecialeEnBase(equipe, passee, 1, "ES 1 parcours", KM_SPECIALE, 1)
  await ajouterSpecialeEnBase(equipe, abandon, 1, "ES 1 abandon", 8, 1)
  await engagerVehiculeEnBase(equipe, suivante, vehicleId, "inscrit")
  const fournisseurId = await fournisseurDeTest(equipe, "Pièces parcours e2e")
  const equipierA = await ajouterMembreConnectable(equipe, "equipage")
  const equipierB = await ajouterMembreConnectable(equipe, "equipage", "-b")
  await donnerAccesSaison(equipe, equipierA, "ecriture")
  await donnerAccesSaison(equipe, equipierB, "ecriture")
  // Un lien de connexion ne sert qu'une fois : l'équipier C valide l'abandon de l'étape 9, B ayant déjà servi à l'étape 5.
  const equipierC = await ajouterMembreConnectable(equipe, "equipage", "-c")
  await donnerAccesSaison(equipe, equipierC, "ecriture")

  await connecterParLien(page, equipe)
  await page.setViewportSize(BUREAU)

  await test.step("1 · atelier préparé : emplacements, pièces et train d'origine", async () => {
    await tuile(page, "garage").click()
    await expect(page.getByRole("heading", { name: TITRE_NON_SUIVIE })).toBeVisible()
    await envoyer(page, page.getByRole("button", { name: "Préparer l'atelier", exact: true }))
    await expect(page.getByRole("heading", { name: TITRE_NON_SUIVIE })).toHaveCount(0)
    for (const type of TYPES_DEFAUT) {
      await expect(page.getByText(type.nom, { exact: true }).filter({ visible: true }).first()).toBeVisible()
    }
    // Pièces d'origine montées sans durée de vie : l'atelier demande les durées, sans dire que tout va bien.
    await expect(page.getByText("Renseigne la durée de vie de :").filter({ visible: true }).first()).toBeVisible()
    expect((await organesDeLaVoitureEnBase(equipe, vehicleId)).length).toBeGreaterThanOrEqual(TYPES_DEFAUT.length)
    await capturerDeuxTailles(page, "garage-parcours-1-atelier")
  })

  await test.step("2 · commande, réception : pièces en stock, proposition Budget décidée dans Budget", async () => {
    await page.getByRole("link", { name: "Commandes", exact: true }).click()
    await page.getByRole("link", { name: "Nouvelle commande", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Nouvelle commande", exact: true })).toBeVisible()
    await page.locator('select[name="supplierContactId"]').selectOption(fournisseurId)
    await page.locator('input[name="ligne1Designation"]').fill(PIECE_ACHETEE)
    await page.locator('select[name="ligne1ComponentTypeId"]').selectOption({ label: TYPES_DEFAUT.find((type) => type.cle === "freins")?.nom ?? "Freins" })
    await page.locator('input[name="ligne1Quantite"]').fill("2")
    await page.locator('input[name="ligne1Prix"]').fill("12,50")
    await envoyer(page, page.getByRole("button", { name: "Enregistrer la commande", exact: true }))
    await expect(page.getByRole("heading", { name: "Livraisons attendues (1)" })).toBeVisible()

    await page.getByRole("button", { name: "Marquer expédiée", exact: true }).click()
    await envoyer(page, page.getByRole("dialog").getByRole("button", { name: "Marquer expédiée", exact: true }))
    await expect(page.getByText("Expédiée", { exact: true })).toBeVisible()

    await page.getByRole("button", { name: "Recevoir", exact: true }).click()
    await envoyer(page, page.getByRole("dialog").getByRole("button", { name: "Recevoir la commande", exact: true }))
    await expect(page.getByRole("heading", { name: "Reçues (1)" })).toBeVisible()

    // Deux pièces en stock, au prix unitaire et chez le fournisseur.
    const recues = await piecesDeCommandeEnBase(equipe, PIECE_ACHETEE)
    expect(recues).toHaveLength(2)
    for (const piece of recues) {
      expect(piece).toMatchObject({ statut: "en_stock", prix_cents: 1250, fournisseur_contact_id: fournisseurId })
    }

    // Budget reçoit une seule proposition pour la commande ; le responsable la confirme dans « À confirmer ».
    await allerAuQg(page)
    await tuile(page, "budget").click()
    // Première ouverture de Budget par ce membre : l'accueil montre son écran explicatif. On attend qu'il soit là, puis on
    // passe par « Commencer », comme John. Sans cette attente, le clic sur « À confirmer » part avant la fin de l'accueil,
    // et la navigation de l'accueil reprend la main (la page reste sur les mouvements).
    await expect(page.getByRole("button", { name: "Commencer", exact: true })).toBeVisible()
    await envoyer(page, page.getByRole("button", { name: "Commencer", exact: true }))
    await page.getByRole("link", { name: "À confirmer", exact: true }).click()
    await expect(page).toHaveURL(/\/apps\/budget\/a-confirmer$/)
    await expect(async () => {
      await page.reload()
      await expect(page.getByRole("heading", { name: PROPOSITION_BUDGET })).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 60_000 })
    await expect(page.getByRole("heading", { name: PROPOSITION_BUDGET })).toHaveCount(1)
    await page.getByRole("button", { name: "Confirmer", exact: true }).click()
    await envoyer(page, page.getByRole("dialog").getByRole("button", { name: "Confirmer le mouvement" }))
    await expect(page.getByRole("heading", { name: PROPOSITION_BUDGET })).toHaveCount(0)
    // En base : une seule dépense, du montant de la commande (deux pièces à 12,50 €).
    await expect.poll(async () => (await depenseBudgetParLibelle(equipe, PROPOSITION_BUDGET))?.montant ?? null, { timeout: 30_000 }).toBe(MONTANT_PIECES_CENTIMES)
  })

  await test.step("3 · remplacement des freins par la pièce achetée, ancienne pièce en réserve", async () => {
    await allerAuQg(page)
    await ouvrirGarage(page)
    await page.getByRole("link", { name: "Atelier", exact: true }).click()
    const freins = await organeDeType(equipe, vehicleId, "freins")
    await lienOrgane(page, freins).click()
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()

    await page.getByRole("button", { name: "Remplacer", exact: true }).click()
    const tiroir = page.getByRole("dialog")
    await expect(tiroir).toBeVisible()
    await tiroir.locator('select[name="source"]').selectOption("rechange")
    await tiroir.locator('select[name="partId"]').selectOption({ label: PIECE_ACHETEE })
    await tiroir.getByLabel("Motif de dépose de la pièce en place").selectOption("usure")
    await tiroir.getByLabel("Ce que devient l'ancienne pièce").selectOption({ label: "En réserve (en stock)" })
    await envoyer(page, tiroir.getByRole("button", { name: "Remplacer la pièce", exact: true }))
    await expect(tiroir).toBeHidden()
    await expect(page.getByText(PIECE_ACHETEE, { exact: true }).first()).toBeVisible()

    // En base : la pièce achetée est posée, l'ancienne est déposée pour usure et part en réserve ; une pièce reste en stock.
    const poses = await posesDeLOrganeEnBase(equipe, freins)
    expect(poses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ designation: PIECE_ACHETEE, deposee: false, statut: "montee" }),
        expect.objectContaining({ deposee: true, motif_depose: "usure", statut: "en_stock" }),
      ]),
    )
    expect(await piecesEnStockDeTypeEnBase(equipe, PIECE_ACHETEE)).toBe(1)
  })

  await test.step("4 · engagement de la voiture sur l'épreuve passée, avec sa spéciale, paiement enregistré", async () => {
    await ouvrirEpreuveDansSaison(page, EPREUVE_PASSEE)
    await page.getByRole("link", { name: "Engagements", exact: true }).click()
    await page.getByRole("button", { name: "Engager une voiture", exact: true }).click()
    await page.getByLabel("Voiture", { exact: true }).selectOption({ label: SAXO })
    await envoyer(page, page.getByRole("dialog").getByRole("button", { name: "Engager la voiture", exact: true }))
    await expect(page.getByRole("link", { name: new RegExp(SAXO) }).first()).toBeVisible()

    // Un engagement sans paiement reste « envisagé » : on enregistre le paiement, l'engagement est alors parti.
    await page.getByRole("link", { name: new RegExp(SAXO) }).first().click()
    await page.getByRole("button", { name: "Enregistrer un paiement", exact: true }).click()
    await page.getByLabel("Montant payé (€)").fill("450")
    await envoyer(page, page.getByRole("dialog").getByRole("button", { name: "Enregistrer le paiement", exact: true }))
    await expect(page.getByRole("dialog")).toHaveCount(0)
  })

  await test.step("5 · résultat saisi, validé par un autre membre : usure appliquée une seule fois", async () => {
    // L'usure ne s'applique qu'au résultat validé : on mesure avant la validation.
    const avant = await piecesMonteesDeLaVoitureEnBase(equipe, vehicleId)
    expect(avant.length).toBeGreaterThan(0)

    await ouvrirEpreuveDansSaison(page, EPREUVE_PASSEE)
    await page.getByRole("link", { name: "Résultats", exact: true }).click()
    await page.getByRole("button", { name: /^(Saisir|Modifier) le résultat$/ }).click()
    await page.getByRole("button", { name: "Plus de détails", exact: true }).click()
    await page.getByLabel("Km chronométrés").fill("12,5")
    await page.getByLabel("Classement de classe").fill("2")
    await envoyer(page, page.getByRole("dialog").getByRole("button", { name: "Enregistrer le résultat", exact: true }))

    // Le résultat attend un membre d'équipage, qui le valide depuis « Résultats à valider ». Le responsable pourrait le
    // valider lui-même (la règle le permet) : ce parcours teste la validation par un autre membre.
    const b = await connecterMembre(browser, equipierB)
    try {
      await b.page.goto("/apps/saison/a-valider")
      await b.page.getByRole("button", { name: "Valider", exact: true }).click()
      await expect(b.page.locator("main").getByRole("link", { name: new RegExp(EPREUVE_PASSEE) })).toHaveCount(0)
    } finally {
      await b.fermer()
    }

    // En base : une ligne du journal par pièce montée (pas deux), km et épreuve ajoutés une seule fois, rev + 1.
    await expect.poll(async () => (await journalUsureResultatEnBase(equipe, vehicleId)).length, { timeout: 60_000 }).toBe(avant.length)
    const journal = await journalUsureResultatEnBase(equipe, vehicleId)
    expect(new Set(journal.map((ligne) => ligne.partId)).size, "une ligne par pièce montée").toBe(avant.length)
    expect(journal.every((ligne) => ligne.km === KM_SPECIALE && ligne.epreuveComptee)).toBe(true)
    const apres = await piecesMonteesDeLaVoitureEnBase(equipe, vehicleId)
    for (const piece of avant) {
      const suivante = apres.find((ligne) => ligne.id === piece.id)
      expect(suivante?.km ?? NaN, `km de la pièce ${piece.id}`).toBeCloseTo(piece.km + KM_SPECIALE, 5)
      expect(suivante?.epreuves, `épreuves de la pièce ${piece.id}`).toBe(piece.epreuves + 1)
      expect(suivante?.rev, `rev de la pièce ${piece.id}`).toBe(piece.rev + 1)
    }
  })

  await test.step("6 · organe en zone rouge : bloc « À surveiller » dans Saison, indice de préparation inchangé", async () => {
    // Indice de l'épreuve suivante avant le changement de durée.
    await ouvrirEpreuveDansSaison(page, EPREUVE_SUIVANTE)
    const indiceAvant = await indiceDePreparation(page)

    // Durée de vie courte saisie par le test : 13 km sur l'embrayage, un organe critique (12,5 km déjà roulés), 10 épreuves.
    await allerAuQg(page)
    await ouvrirGarage(page)
    await page.getByRole("link", { name: "Atelier", exact: true }).click()
    const embrayage = await organeDeType(equipe, vehicleId, "embrayage")
    await lienOrgane(page, embrayage).click()
    await page.getByRole("button", { name: "Régler l'organe", exact: true }).click()
    await page.getByLabel("Durée de référence en kilomètres").fill("13")
    await page.getByLabel("Durée de référence en épreuves").fill("10")
    await envoyer(page, page.getByRole("dialog").getByRole("button", { name: "Enregistrer les réglages", exact: true }))
    await expect(page.getByRole("dialog")).toHaveCount(0)

    // Atelier : la carte de l'organe passe en zone rouge, et l'indice le nomme.
    await page.getByRole("link", { name: "Atelier", exact: true }).click()
    await expect(page.getByRole("link", { name: /Embrayage.*Zone rouge/ }).filter({ visible: true }).first()).toBeVisible()
    await capturerDeuxTailles(page, "garage-parcours-6-zone-rouge")

    // Saison : le bloc « À surveiller » le dit, sans toucher à l'indice.
    await ouvrirEpreuveDansSaison(page, EPREUVE_SUIVANTE)
    await expect(page.getByText("À surveiller, sans effet sur l'indice")).toBeVisible()
    await expect(page.getByText("Garage : 1 organe(s) en zone rouge")).toBeVisible()
    expect(await indiceDePreparation(page), "indice de préparation après le passage en zone rouge").toBe(indiceAvant)
  })

  await test.step("7 · plan avant épreuve de l'épreuve suivante : état actuel, estimation, ordre à faire avant", async () => {
    // L'ordre « à faire avant » est créé dans Travaux, avec l'épreuve suivante comme échéance.
    await allerAuQg(page)
    await ouvrirGarage(page)
    await page.getByRole("link", { name: "Travaux", exact: true }).click()
    await page.getByRole("button", { name: "Nouvel ordre", exact: true }).click()
    const tiroir = page.getByRole("dialog")
    await expect(tiroir).toBeVisible()
    await tiroir.getByLabel("Titre", { exact: true }).fill("Contrôle de l'embrayage")
    await tiroir.locator('select[name="vehicleComponentId"]').selectOption(await organeDeType(equipe, vehicleId, "embrayage"))
    await tiroir.locator('select[name="aFaireAvantEventId"]').selectOption(suivante)
    await envoyer(page, tiroir.getByRole("button", { name: "Créer l'ordre", exact: true }))
    await expect(page.getByText("Contrôle de l'embrayage", { exact: true }).first()).toBeVisible()

    await page.getByRole("link", { name: "Plan avant épreuve", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Plan avant épreuve", level: 1 })).toBeVisible()
    await expect(page.getByRole("heading", { name: EPREUVE_SUIVANTE, exact: true })).toBeVisible()
    await expect(page.getByText("Après l'épreuve").first()).toBeVisible()
    await expect(page.getByText("Contrôle de l'embrayage", { exact: true }).first()).toBeVisible()
    await expect(page.getByText(/Zone rouge/).first()).toBeVisible()
    await capturerDeuxTailles(page, "garage-parcours-7-plan")
  })

  await test.step("8 · réparation à 80 % : alerte levée à Saison, fiabilité remontée", async () => {
    await ouvrirEpreuveDansSaison(page, EPREUVE_SUIVANTE)
    const fiabiliteAvant = await fiabiliteDeLaVoiture(page)

    await allerAuQg(page)
    await ouvrirGarage(page)
    await page.getByRole("link", { name: "Atelier", exact: true }).click()
    await lienOrgane(page, await organeDeType(equipe, vehicleId, "embrayage")).click()
    await page.getByRole("button", { name: "Réparer", exact: true }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.getByLabel("Ce qui est réparé").fill("Embrayage remplacé")
    await envoyer(page, page.getByRole("button", { name: "Ajouter la réparation", exact: true }))
    await expect(page).toHaveURL(/\/apps\/garage\/travaux/)
    await page.getByRole("link", { name: /Embrayage remplacé/ }).first().click()
    await expect(page).toHaveURL(/\/apps\/garage\/travaux\/[0-9a-f-]+$/)
    await page.getByRole("button", { name: "Terminer l'ordre", exact: true }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.getByLabel("État de la pièce après réparation (%)").fill("80")
    await envoyer(page, page.getByRole("dialog").getByRole("button", { name: "Terminer l'ordre", exact: true }))
    await expect(page.getByText("Cet ordre est terminé : il ne se modifie plus.")).toBeVisible()

    await ouvrirEpreuveDansSaison(page, EPREUVE_SUIVANTE)
    await expect(page.getByText("Garage : aucun organe en zone rouge")).toBeVisible()
    await expect(page.getByText("Garage : 1 organe(s) en zone rouge")).toHaveCount(0)
    expect(await fiabiliteDeLaVoiture(page), "fiabilité après la réparation").toBeGreaterThan(fiabiliteAvant)
  })

  await test.step("9 · abandon déclaré dans Saison : fiche casse au Garage, réparation liée", async () => {
    // Le membre A saisit l'abandon, le membre C le valide.
    await ouvrirEpreuveDansSaison(page, EPREUVE_ABANDON)
    await page.getByRole("link", { name: "Engagements", exact: true }).click()
    await page.getByRole("button", { name: "Engager une voiture", exact: true }).click()
    await page.getByLabel("Voiture", { exact: true }).selectOption({ label: SAXO })
    await envoyer(page, page.getByRole("dialog").getByRole("button", { name: "Engager la voiture", exact: true }))
    await page.getByRole("link", { name: new RegExp(SAXO) }).first().click()
    await page.getByRole("button", { name: "Enregistrer un paiement", exact: true }).click()
    await page.getByLabel("Montant payé (€)").fill("450")
    await envoyer(page, page.getByRole("dialog").getByRole("button", { name: "Enregistrer le paiement", exact: true }))

    const a = await connecterMembre(browser, equipierA)
    try {
      await a.page.goto(`/apps/saison/epreuves/${abandon}?onglet=resultats`)
      await a.page.getByRole("button", { name: /^(Saisir|Modifier) le résultat$/ }).click()
      await a.page.getByLabel("Statut final").selectOption({ label: "Abandon" })
      await a.page.getByRole("button", { name: "Plus de détails", exact: true }).click()
      await a.page.getByLabel("Cause de l'abandon").fill("Casse de cardan")
      await a.page.getByLabel("Spéciale d'abandon").selectOption({ label: "1. ES 1 abandon" })
      await envoyer(a.page, a.page.getByRole("dialog").getByRole("button", { name: "Enregistrer le résultat", exact: true }))
    } finally {
      await a.fermer()
    }

    const c = await connecterMembre(browser, equipierC)
    try {
      await c.page.goto("/apps/saison/a-valider")
      await c.page.getByRole("button", { name: "Valider", exact: true }).click()
      await expect(c.page.locator("main").getByRole("link", { name: new RegExp(EPREUVE_ABANDON) })).toHaveCount(0)
    } finally {
      await c.fermer()
    }

    // Le responsable ouvre la fiche casse au Garage : elle arrive par un événement, donc on la relit jusqu'à ce qu'elle soit là.
    await allerAuQg(page)
    await ouvrirGarage(page)
    await cliquerMenuGarage(page, "Casses", /\/apps\/garage\/casses$/)
    const casse = page.getByRole("link", { name: new RegExp(`· ${EPREUVE_ABANDON}`) })
    await expect(async () => {
      await page.reload()
      await expect(casse.first()).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 60_000 })
    await casse.first().click()
    await expect(page).toHaveURL(/\/apps\/garage\/casses\/[0-9a-f-]+$/)
    await page.getByLabel("Type de casse").selectOption({ label: "Casse mécanique" })
    await page.getByLabel("Cause (facultatif)").fill("Casse de cardan")
    // Les organes à plusieurs emplacements se distinguent par leur position, comme dans l'atelier et le plan.
    await expect(page.getByRole("checkbox", { name: /^Freins · / })).toHaveCount(4)
    await expect(page.getByRole("checkbox", { name: "Freins · avant gauche", exact: true })).toBeVisible()
    await expect(page.getByRole("checkbox", { name: /^Transmissions · / })).toHaveCount(2)
    await page.getByRole("checkbox", { name: "Boîte de vitesses", exact: true }).check()
    await envoyer(page, page.getByRole("button", { name: "Enregistrer la fiche", exact: true }))
    await envoyer(page, page.getByRole("button", { name: "Ouvrir une réparation : Boîte de vitesses", exact: true }))
    await expect(page.getByRole("link", { name: "Voir la réparation liée", exact: true })).toBeVisible()

    // La réparation liée est dans les travaux, titrée d'après la casse ; la fiche garde le lien, sans second ordre.
    await page.getByRole("link", { name: "Voir la réparation liée", exact: true }).click()
    await expect(page).toHaveURL(/\/apps\/garage\/travaux\/[0-9a-f-]+$/)
    await expect(page.getByText(`Casse : ${EPREUVE_ABANDON}`).first()).toBeVisible()

    await page.getByRole("link", { name: "Casses", exact: true }).click()
    await casse.first().click()
    await expect(page.getByRole("link", { name: "Voir la réparation liée", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: /Ouvrir une réparation/ })).toHaveCount(0)
    await capturerDeuxTailles(page, "garage-parcours-9-casse")
  })
})
