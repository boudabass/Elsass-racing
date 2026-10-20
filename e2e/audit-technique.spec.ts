import type { Locator, Page } from "@playwright/test"

import { expect, test } from "./aide/fixtures"
import { connecterParLien, tuilesDuQg } from "./aide/navigation"
import { ajouterMembreConnectable, preparerSaison } from "./aide/session"

// Brief 2.12, point 7 : preuves de l'audit technique sur le build de production (port 3101).
// Un seul titre principal, zones de toucher à 44 px, animations réduites ; captures pour John.

const SAISON = 2033

async function capturer(page: Page, nom: string, largeur: number, hauteur: number): Promise<void> {
  await page.setViewportSize({ width: largeur, height: hauteur })
  await page.screenshot({ path: `docs/captures/audit-${nom}-${largeur}x${hauteur}.png`, fullPage: true })
}

// Bord gauche du contenu d'un élément : son x, plus son retrait gauche (le menu de téléphone a un retrait de 16 px).
async function bordContenu(element: Locator): Promise<number> {
  const boite = await element.boundingBox()
  const retrait = await element.evaluate((noeud) => parseFloat(getComputedStyle(noeud).paddingLeft))
  return (boite?.x ?? 0) + retrait
}

function echapper(texte: string): string {
  return texte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// Brief 2.16, point 1 : à 1280 px, chaque bouton d'envoi visible a la largeur de son texte (400 px au plus).
async function verifierBoutonsEtroits(page: Page, ecran: string): Promise<void> {
  const boutons = page.locator("main button[type=submit]")
  const nombre = await boutons.count()
  for (let rang = 0; rang < nombre; rang++) {
    const bouton = boutons.nth(rang)
    if (!(await bouton.isVisible())) continue
    const texte = ((await bouton.textContent()) ?? "").trim()
    const largeur = (await bouton.boundingBox())?.width ?? 0
    expect(largeur, `${ecran} · bouton « ${texte} » à 1280 px`).toBeLessThanOrEqual(400)
  }
}

test("connexion, 360 px : un seul titre principal « Connexion », champ et bouton d'envoi à 44 px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto("/connexion")

  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1)
  await expect(page.getByRole("heading", { level: 1, name: "Connexion" })).toBeVisible()

  const champ = await page.getByLabel("Adresse e-mail").boundingBox()
  const envoi = await page.getByRole("button", { name: "Recevoir mon lien" }).boundingBox()
  expect(champ?.height ?? 0).toBeGreaterThanOrEqual(44)
  expect(envoi?.height ?? 0).toBeGreaterThanOrEqual(44)

  await capturer(page, "connexion", 360, 740)
  await capturer(page, "connexion", 1280, 800)
})

test("réglages : un titre principal « Réglages » après un clic depuis le QG", async ({ page, equipe }) => {
  await connecterParLien(page, equipe)
  await tuilesDuQg(page).filter({ hasText: "Réglages" }).click()

  await expect(page).toHaveURL(/\/apps\/settings/)
  await expect(page.getByRole("heading", { level: 1, name: "Réglages" })).toBeVisible()
})

test("réduire les animations, 360 px : le tiroir « Ajouter » apparaît sans glisser", async ({ page, equipe }) => {
  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 360, height: 740 })
  await page.emulateMedia({ reducedMotion: "reduce" })

  await page.getByRole("button", { name: "Ajouter", exact: true }).click()
  const tiroir = page.getByRole("dialog")
  await expect(tiroir).toBeVisible()
  const glissement = await tiroir.evaluate((element) => getComputedStyle(element).getPropertyValue("--tw-enter-translate-y").trim())
  expect(glissement).toBe("0")

  await page.keyboard.press("Escape")
  await expect(tiroir).toBeHidden()
})

test("captures de l'audit à 360 px et 1280 px : Réglages, formulaires Saison et Budget, filtres avec pastilles", async ({ page, equipe }) => {
  test.setTimeout(240_000)
  await preparerSaison(equipe, SAISON)
  await connecterParLien(page, equipe)

  // Une épreuve est nécessaire pour que le calendrier de Saison affiche ses filtres.
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto("/apps/saison/nouvelle")
  await page.getByLabel("Nom de l'épreuve").fill("Audit e2e")
  await page.getByLabel("Premier jour").fill(`${SAISON}-07-10`)
  await page.getByLabel("Dernier jour").fill(`${SAISON}-07-11`)
  await page.getByRole("button", { name: "Ajouter l'épreuve" }).click()
  await expect(page).toHaveURL(/\/apps\/saison\/epreuves\/[0-9a-f-]+/)

  for (const [largeur, hauteur] of [
    [1280, 800],
    [360, 740],
  ] as const) {
    await page.setViewportSize({ width: largeur, height: hauteur })
    await page.goto("/apps/settings/affichage")
    await expect(page.getByRole("heading", { level: 1, name: "Réglages" })).toBeVisible()
    await capturer(page, "reglages-personnel", largeur, hauteur)

    await page.goto("/apps/saison/nouvelle")
    await expect(page.getByLabel("Nom de l'épreuve")).toBeVisible()
    await capturer(page, "saison-formulaire", largeur, hauteur)

    await page.goto("/apps/budget/nouvelle")
    await expect(page.getByLabel("Montant (€)")).toBeVisible()
    await capturer(page, "budget-formulaire", largeur, hauteur)
  }

  // Filtres avec pastilles : le tiroir sur téléphone, puis le même état à 1280 px (l'état est dans l'adresse).
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto("/apps/saison")
  await page.getByRole("button", { name: /^Filtres/ }).click()
  await page.getByRole("dialog").getByRole("combobox", { name: "Type" }).selectOption({ index: 1 })
  await page.keyboard.press("Escape")
  await expect(page.getByRole("list", { name: "Filtres actifs" })).toBeVisible()
  await capturer(page, "filtres-pastilles", 360, 740)
  await capturer(page, "filtres-pastilles", 1280, 800)
})

// Brief 2.13 : les liens « ← Calendrier » et « ← Mouvements » ne sont plus sur les pages du menu.
test("liens de retour retirés, 360 px : Résultats à valider, Historique, À confirmer, Recette", async ({ page, equipe }) => {
  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 360, height: 740 })

  await tuilesDuQg(page).filter({ hasText: "Saison" }).click()
  const menuSaison = page.getByRole("navigation", { name: "Menu de Saison" })
  await menuSaison.getByRole("link", { name: "Résultats à valider", exact: true }).click()
  await expect(page.getByRole("link", { name: /^←/ })).toHaveCount(0)
  await capturer(page, "resultats-a-valider", 360, 740)
  await capturer(page, "resultats-a-valider", 1280, 800)

  await menuSaison.getByRole("link", { name: "Historique", exact: true }).click()
  await expect(page.getByRole("link", { name: /^←/ })).toHaveCount(0)

  await page.goto("/qg")
  await tuilesDuQg(page).filter({ hasText: "Budget" }).click()
  const menuBudget = page.getByRole("navigation", { name: "Menu de Budget" })
  await menuBudget.getByRole("link", { name: "À confirmer", exact: true }).click()
  await expect(page.getByRole("link", { name: /^←/ })).toHaveCount(0)
  await capturer(page, "a-confirmer", 360, 740)
  await capturer(page, "a-confirmer", 1280, 800)

  await menuBudget.getByRole("link", { name: "Recette", exact: true }).click()
  await expect(page.getByRole("link", { name: /^←/ })).toHaveCount(0)
})

// Brief 2.13 : un seul menu dans Réglages, celui du haut ; la colonne de gauche est retirée.
test("Réglages, responsable : pas de colonne de rubriques, « Affichage » s'ouvre depuis le menu du haut", async ({ page, equipe }) => {
  await connecterParLien(page, equipe)
  await tuilesDuQg(page).filter({ hasText: "Réglages" }).click()

  await expect(page.getByRole("navigation", { name: "Rubriques de Réglages" })).toHaveCount(0)
  const menu = page.getByRole("navigation", { name: "Menu de Réglages" })
  await expect(menu.getByRole("link", { name: "Identité", exact: true })).toBeVisible()
  await expect(menu.getByRole("link", { name: "Affichage", exact: true })).toBeVisible()
  // La redirection vers Identité finit après le menu : on attend le titre de la rubrique avant la capture.
  await expect(page.getByRole("heading", { name: "Identité", exact: true })).toBeVisible()
  await capturer(page, "reglages-responsable", 360, 740)
  await capturer(page, "reglages-responsable", 1280, 800)

  await menu.getByRole("link", { name: "Affichage", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Affichage", exact: true })).toBeVisible()
})

// Brief 2.13 : l'assistance n'a pas le niveau sur Réglages ; elle y accède tout de même à ses rubriques personnelles.
test("Réglages, assistance : arrive sur Affichage, menu sans les rubriques de la team", async ({ browser, equipe }) => {
  const assistance = await ajouterMembreConnectable(equipe, "assistance")
  const contexte = await browser.newContext()
  const assist = await contexte.newPage()
  try {
    await assist.goto(`/connexion/lien?t=${assistance.secretLien}`)
    await assist.waitForURL(/\/qg$/)
    await tuilesDuQg(assist).filter({ hasText: "Réglages" }).click()

    await expect(assist).toHaveURL(/\/apps\/settings\/affichage$/)
    const menu = assist.getByRole("navigation", { name: "Menu de Réglages" })
    await expect(menu.getByRole("link", { name: "Affichage", exact: true })).toBeVisible()
    await expect(menu.getByRole("link", { name: "Mon compte", exact: true })).toBeVisible()
    await expect(menu.getByRole("link", { name: "Identité", exact: true })).toHaveCount(0)
    await expect(menu.getByRole("link", { name: "Membres", exact: true })).toHaveCount(0)
    await expect(assist.getByRole("heading", { name: "Affichage", exact: true })).toBeVisible()
    await capturer(assist, "reglages-assistance", 360, 740)
    await capturer(assist, "reglages-assistance", 1280, 800)
  } finally {
    await contexte.close()
  }
})

// Brief 2.15, point 1 : une seule colonne. Le titre de chaque page s'aligne sous le menu de son app,
// et la bande des onglets de la fiche épreuve s'aligne sous le titre à 1280 px.
test("une seule colonne : le titre de chaque page Saison et Budget s'aligne sous le menu, à 360 px puis à 1280 px", async ({ page, equipe }) => {
  test.setTimeout(300_000)
  await preparerSaison(equipe, SAISON)
  await connecterParLien(page, equipe)

  for (const [largeur, hauteur] of [
    [360, 740],
    [1280, 800],
  ] as const) {
    await page.setViewportSize({ width: largeur, height: hauteur })
    for (const [adresse, nomApp] of [
      ["/apps/saison", "Saison"],
      ["/apps/budget", "Budget"],
    ] as const) {
      await page.goto(adresse)
      const menu = page.getByRole("navigation", { name: `Menu de ${nomApp}` })
      const entrees = await menu.getByRole("link").evaluateAll((liens) =>
        liens.map((lien) => ({ nom: lien.textContent?.trim() ?? "", chemin: new URL((lien as HTMLAnchorElement).href).pathname })),
      )
      expect(entrees.length).toBeGreaterThan(1)

      for (const entree of entrees) {
        await menu.getByRole("link", { name: entree.nom, exact: true }).click()
        await expect(page).toHaveURL(new RegExp(`${echapper(entree.chemin)}$`))
        const titre = page.getByRole("main").getByRole("heading", { level: 1 })
        await expect(titre).toHaveCount(1)
        await expect(titre).toBeVisible()
        const ecart = Math.abs((await bordContenu(menu)) - (await bordContenu(titre)))
        expect(ecart, `${nomApp} · ${entree.nom} à ${largeur} px`).toBeLessThanOrEqual(1)
      }
    }
  }

  // Fiche épreuve, à 1280 px (la largeur de la dernière boucle) : les onglets s'alignent sous le titre.
  await page.goto("/apps/saison/nouvelle")
  await page.getByLabel("Nom de l'épreuve").fill("Alignement e2e")
  await page.getByLabel("Premier jour").fill(`${SAISON}-07-10`)
  await page.getByLabel("Dernier jour").fill(`${SAISON}-07-11`)
  await page.getByRole("button", { name: "Ajouter l'épreuve" }).click()
  await expect(page).toHaveURL(/\/apps\/saison\/epreuves\/[0-9a-f-]+/)
  const titreFiche = page.getByRole("main").getByRole("heading", { level: 1 })
  const onglets = page.getByRole("navigation", { name: "Onglets de l'épreuve" })
  await expect(onglets).toBeVisible()
  const ecartOnglets = Math.abs((await bordContenu(onglets)) - (await bordContenu(titreFiche)))
  expect(ecartOnglets, "Onglets de la fiche épreuve à 1280 px").toBeLessThanOrEqual(1)
})

// Brief 2.16, point 1 : sur ordinateur, les boutons d'envoi ont la largeur de leur texte. Parcours à 1280 px.
test("boutons d'envoi, 1280 px : aucun ne dépasse 400 px sur les menus de Saison et Budget, la fiche épreuve, Ajouter une dépense et Réglages", async ({ page, equipe }) => {
  test.setTimeout(300_000)
  await preparerSaison(equipe, SAISON)
  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 1280, height: 800 })

  // Une épreuve pour que la fiche et ses onglets existent.
  await page.goto("/apps/saison/nouvelle")
  await page.getByLabel("Nom de l'épreuve").fill("Boutons e2e")
  await page.getByLabel("Premier jour").fill(`${SAISON}-07-10`)
  await page.getByLabel("Dernier jour").fill(`${SAISON}-07-11`)
  await page.getByRole("button", { name: "Ajouter l'épreuve" }).click()
  await expect(page).toHaveURL(/\/apps\/saison\/epreuves\/[0-9a-f-]+/)
  const fiche = new URL(page.url()).pathname

  for (const [adresse, nomApp] of [
    ["/apps/saison", "Saison"],
    ["/apps/budget", "Budget"],
  ] as const) {
    await page.goto(adresse)
    const menu = page.getByRole("navigation", { name: `Menu de ${nomApp}` })
    const entrees = await menu.getByRole("link").evaluateAll((liens) =>
      liens.map((lien) => ({ nom: lien.textContent?.trim() ?? "", chemin: new URL((lien as HTMLAnchorElement).href).pathname })),
    )
    expect(entrees.length).toBeGreaterThan(1)

    for (const entree of entrees) {
      await menu.getByRole("link", { name: entree.nom, exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`${echapper(entree.chemin)}$`))
      await verifierBoutonsEtroits(page, `${nomApp} · ${entree.nom}`)
    }
  }

  await page.goto(fiche)
  const onglets = page.getByRole("navigation", { name: "Onglets de l'épreuve" })
  for (const nom of ["Infos", "Engagements", "Reconnaissances", "Résultats"]) {
    await onglets.getByRole("link", { name: nom, exact: true }).click()
    await verifierBoutonsEtroits(page, `Fiche épreuve · ${nom}`)
  }

  await page.goto("/apps/budget/nouvelle")
  await expect(page.getByLabel("Montant (€)")).toBeVisible()
  await verifierBoutonsEtroits(page, "Budget · Ajouter une dépense")

  await page.goto("/apps/settings/identite")
  await expect(page.getByRole("heading", { name: "Identité", exact: true })).toBeVisible()
  await verifierBoutonsEtroits(page, "Réglages · Identité")
})

// Brief 2.16, point 1 : sous sm, la barre de page des formulaires de création tient toute la largeur de l'écran, et son
// bouton principal est à droite, à 44 px de haut au moins. Le bouton est dans la barre fixe (FormulairePage), hors du
// <form> : il le soumet par son attribut form, d'où le sélecteur sur la barre et non sur le formulaire.
test("boutons d'envoi, 360 px : « Ajouter la dépense » est à droite d'une barre pleine largeur, à 44 px au moins", async ({ page, equipe }) => {
  await preparerSaison(equipe, SAISON)
  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto("/apps/budget/nouvelle")
  await expect(page.getByLabel("Montant (€)")).toBeVisible()

  const bouton = page.getByRole("button", { name: "Ajouter la dépense", exact: true })
  const barre = page.locator("div.sticky", { has: bouton })
  await expect(barre).toHaveCount(1)
  const boiteBarre = await barre.boundingBox()
  const boiteBouton = await bouton.boundingBox()
  if (!boiteBarre || !boiteBouton) throw new Error("La barre ou le bouton Ajouter la dépense n'a pas de boîte à 360 px")

  const milieuBarre = boiteBarre.x + boiteBarre.width / 2
  expect(boiteBarre.width, `barre à 360 px : ${boiteBarre.width} px`).toBeGreaterThanOrEqual(360 - 2)
  const milieuBouton = boiteBouton.x + boiteBouton.width / 2
  expect(milieuBouton, `bouton à 360 px : milieu ${milieuBouton}, milieu de la barre ${milieuBarre}`).toBeGreaterThanOrEqual(milieuBarre)
  expect(boiteBouton.x + boiteBouton.width, "bouton à 360 px : déborde à droite de la barre").toBeLessThanOrEqual(boiteBarre.x + boiteBarre.width + 1)
  expect(boiteBouton.height, `bouton à 360 px : hauteur ${boiteBouton.height} px`).toBeGreaterThanOrEqual(44)
  expect(boiteBouton.width, `bouton à 360 px : largeur ${boiteBouton.width} px`).toBeGreaterThanOrEqual(44)
})
