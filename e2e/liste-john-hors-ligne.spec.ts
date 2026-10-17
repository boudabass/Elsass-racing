import type { Browser, Page } from "@playwright/test"

import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import {
  ajouterMembreConnectable,
  ajouterVoitureDeCourse,
  compterEvenements,
  debriefsEnBase,
  donnerAccesSaison,
  rattacherPersonne,
  type Membre,
} from "./aide/session"

// Liste de John (brief 2.9, point 9), hors ligne : un débrief saisi par l'équipage sans réseau part au retour du
// réseau, une seule fois. Et le solde de la barre haute, en clair, pour un membre de contribution.

const ANNEE = new Date().getUTCFullYear()

async function connecterMembre(browser: Browser, membre: Membre & { secretLien: string }): Promise<{ page: Page; contexte: Awaited<ReturnType<Browser["newContext"]>> }> {
  const contexte = await browser.newContext()
  const page = await contexte.newPage()
  await page.goto(`/connexion/lien?t=${membre.secretLien}`)
  await page.waitForURL(/\/qg$/)
  return { page, contexte }
}

// Le service worker doit contrôler la page, pour qu'elle reste disponible hors ligne.
async function attendreServiceWorker(page: Page): Promise<void> {
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await page.evaluate(() => navigator.serviceWorker.ready)
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
}

test("liste de John : débrief saisi hors ligne par l'équipage, part au retour du réseau, une seule fois", async ({ browser, page, equipe }) => {
  test.setTimeout(420_000)
  await ajouterVoitureDeCourse(equipe, "Saxo debrief John")
  await rattacherPersonne(equipe, equipe.responsable, "Responsable", "E2E")
  const equipier = await ajouterMembreConnectable(equipe, "equipage", "-dbf")
  await donnerAccesSaison(equipe, equipier, "ecriture")

  // Responsable : saison et épreuve passée à l'écran, engagement payé (l'épreuve est partie).
  await connecterParLien(page, equipe)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.getByRole("navigation", { name: "Apps" }).getByRole("link", { name: "Saison" }).click()
  await page.getByRole("button", { name: "Ouvrir la saison" }).click()
  await page.getByRole("link", { name: "Ajouter une épreuve" }).click()
  await page.getByLabel("Nom de l'épreuve").fill("Rallye débrief John")
  await page.getByLabel("Premier jour").fill(`${ANNEE}-01-10`)
  await page.getByLabel("Dernier jour").fill(`${ANNEE}-01-11`)
  await page.getByRole("button", { name: "Ajouter l'épreuve" }).click()
  await expect(page).toHaveURL(/\/apps\/saison\/epreuves\/[0-9a-f-]+/)
  await page.getByRole("navigation", { name: "Onglets de l'épreuve" }).getByRole("link", { name: "Engagements" }).click()
  await page.getByLabel("Voiture").selectOption({ label: "Saxo debrief John" })
  await page.getByRole("button", { name: "Engager la voiture" }).click()
  await page.getByRole("link", { name: /Saxo debrief John/ }).first().click()
  await expect(page).toHaveURL(/\/apps\/saison\/engagements\/[0-9a-f-]+/)
  const adresse = page.url().split("?")[0]
  const entryId = adresse.split("/").pop() ?? ""
  await page.getByLabel("Montant payé (€)").fill("450")
  await page.getByRole("button", { name: "Enregistrer le paiement" }).click()
  await expect(page.getByText("Enregistré.")).toBeVisible()

  // Équipier : la fiche est mise en cache en ligne, puis le débrief s'écrit sans réseau.
  const eq = await connecterMembre(browser, equipier)
  try {
    await attendreServiceWorker(eq.page)
    await eq.page.goto(adresse)
    await expect(eq.page.getByRole("button", { name: "Ressenti 3 sur 5" })).toBeVisible()

    await eq.contexte.setOffline(true)
    await eq.page.goto(adresse)
    await eq.page.getByLabel("Points positifs").fill("Bon départ")
    await eq.page.getByRole("button", { name: "Ressenti 3 sur 5" }).click()
    await expect(eq.page.getByText("Enregistré. Le débrief part")).toBeVisible()
    expect(await debriefsEnBase(equipe, entryId)).toBe(0)

    // Retour du réseau : le débrief arrive en base, et son événement est émis une seule fois.
    await eq.contexte.setOffline(false)
    await expect.poll(() => debriefsEnBase(equipe, entryId), { timeout: 60_000 }).toBe(1)
    await expect.poll(() => compterEvenements(equipe, "saison.debrief_saisi"), { timeout: 60_000 }).toBe(1)
  } finally {
    await eq.contexte.close()
  }
})

test("liste de John : la barre haute dit en clair le solde d'un membre de contribution", async ({ browser, page, equipe }) => {
  test.setTimeout(240_000)
  await rattacherPersonne(equipe, equipe.responsable, "Responsable", "E2E")
  const assistance = await ajouterMembreConnectable(equipe, "assistance", "-solde")
  await rattacherPersonne(equipe, assistance, "Assistante", "E2E")
  await connecterParLien(page, equipe)

  const assist = await connecterMembre(browser, assistance)
  try {
    // Aucune dépense : la phrase du solde dit qu'il n'y a rien à régler, sans chiffre à déchiffrer.
    await expect(assist.page.getByRole("link", { name: /Rien à régler|La team te doit|Tu dois/ }).first()).toBeVisible()
  } finally {
    await assist.contexte.close()
  }
})
