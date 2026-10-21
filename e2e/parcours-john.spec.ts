// Parcours de John (tâche 4.3d) : la team de test créée par pnpm team:creer puis pnpm donnees:koehling, comme la team de
// dev, sans aide SQL pour l'écrire. Seule la connexion passe par la base (code connu, comme connexion.spec.ts). Entrée par
// /connexion, puis des clics depuis le QG : aucune adresse tapée après l'entrée. Chaque écran est ouvert et utilisé comme
// le fait John. Un défaut (l'atelier vide avant « Préparer l'atelier ») fait échouer le test à l'endroit où John le verrait.
import { expect, test, type Locator, type Page } from "@playwright/test"

import { envoyer } from "./aide/envoi"
import { tuilesDuQg } from "./aide/navigation"
import { CODE_CONNU, ajouterCodeConnu } from "./aide/session"
import { TYPES_DEFAUT } from "../src/apps/garage/types-defaut"

// Team créée par la CI avant la suite (étape « Team du parcours de John » du workflow).
const EMAIL = "parcours-john@example.test"
const NOM_VEHICULE = "Citroën Saxo VTS"
const FOURNISSEUR = "Pièces rallye parcours"

const BUREAU = { width: 1440, height: 900 }
const TELEPHONE = { width: 360, height: 740 }

// Une tuile du QG : un lien vers l'app, avec son titre.
function tuile(page: Page, cle: string): Locator {
  return page.locator(`a[href="/apps/${cle}"]`).filter({ has: page.locator("h2") })
}

// Retour au QG par le lien de l'en-tête (le nom de la team, puis « retour au QG »).
async function retourAuQg(page: Page): Promise<void> {
  await page.getByRole("link", { name: /retour au QG/ }).filter({ visible: true }).first().click()
  await expect(tuilesDuQg(page)).toHaveCount(11)
}

// Une page de l'app ouverte depuis une de ses entrées (chips ou liens du bandeau), sans erreur.
async function sansErreur(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Quelque chose s'est mal passé." })).toHaveCount(0)
}

// Aucun défilement horizontal sur la page, à la largeur courante.
async function sansDefilementHorizontal(page: Page): Promise<void> {
  const deborde = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(deborde, "défilement horizontal sur la page").toBe(false)
}

// Connexion du responsable : l'adresse, puis le code (connu en test). C'est la seule étape qui touche la base directement.
async function connecterResponsable(page: Page): Promise<void> {
  await page.goto("/connexion")
  await page.getByLabel("Adresse e-mail").fill(EMAIL)
  await page.getByRole("button", { name: "Recevoir mon lien" }).click()
  await expect(page.getByLabel("Code à 6 chiffres")).toBeVisible()
  await ajouterCodeConnu(EMAIL, CODE_CONNU)
  await page.getByLabel("Code à 6 chiffres").fill(CODE_CONNU)
  await page.getByRole("button", { name: "Valider" }).click()
  await page.waitForURL(/\/qg$/)
}

test("parcours de John : le QG, la Voiture, le Garage, les Travaux, les Commandes et le Budget, sur la team du parcours", async ({ page }) => {
  test.setTimeout(900_000)
  await page.setViewportSize(BUREAU)
  await connecterResponsable(page)

  // 1. Le QG : chacune des onze tuiles s'ouvre sans erreur, puis on revient au QG par son lien.
  const nombre = await tuilesDuQg(page).count()
  expect(nombre).toBe(11)
  for (let rang = 0; rang < nombre; rang++) {
    await tuilesDuQg(page).nth(rang).click()
    await sansErreur(page)
    await retourAuQg(page)
  }

  // 2. Partenaires : le fournisseur des commandes, créé comme John le crée (le « + », puis le prospect).
  await tuile(page, "partenaires").click()
  await page.getByRole("button", { name: "Ajouter", exact: true }).click()
  await page.getByRole("menuitem", { name: "Partenaire", exact: true }).click()
  await page.getByLabel("Entreprise", { exact: true }).fill(FOURNISSEUR)
  await envoyer(page, page.getByRole("button", { name: "Ajouter le prospect", exact: true }))
  await expect(page.getByRole("heading", { name: FOURNISSEUR, exact: true }).filter({ visible: true }).first()).toBeVisible()
  await retourAuQg(page)

  // 3. Voiture : la Saxo, sa Déco. Sans plan, John choisit le modèle, qui crée les emplacements.
  await tuile(page, "voiture").click()
  await page.getByRole("link", { name: NOM_VEHICULE }).click()
  await page.getByRole("link", { name: "Déco", exact: true }).click()
  await expect(page.getByText("Ce véhicule n'a pas encore de plan.")).toBeVisible()
  await page.locator('select[name="gabaritCle"]').selectOption("citadine_3p_saxo")
  await envoyer(page, page.getByRole("button", { name: "Choisir ce modèle", exact: true }))
  await expect(page.getByText("Ce véhicule n'a pas encore de plan.")).toHaveCount(0)
  await page.getByRole("button", { name: "Côté droit", exact: true }).click()
  await sansErreur(page)
  await retourAuQg(page)

  // 4. Garage : l'atelier de la Saxo. Il n'a aucun organe avant « Préparer l'atelier » : c'est ici que le défaut apparaît.
  await tuile(page, "garage").click()
  await expect(page.getByRole("heading", { name: "Atelier", exact: true })).toBeVisible()
  const preparer = page.getByRole("button", { name: "Préparer l'atelier", exact: true })
  await expect(preparer).toBeVisible()
  await envoyer(page, preparer)
  for (const type of TYPES_DEFAUT) {
    await expect(page.getByText(type.nom, { exact: true }).filter({ visible: true }).first()).toBeVisible()
  }

  // Une durée de vie renseignée, sur les freins.
  await page.getByRole("listitem").filter({ hasText: "Freins" }).getByRole("button", { name: "Renseigner la durée de vie" }).click()
  await page.getByLabel("Durée en kilomètres").fill("40000")
  await page.getByLabel("Durée en épreuves").fill("10")
  await envoyer(page, page.getByRole("button", { name: "Enregistrer la durée", exact: true }))

  // Une pièce ajoutée par le bouton +, puis posée sur les freins depuis la fiche de l'organe.
  await page.getByRole("button", { name: "Ajouter", exact: true }).click()
  await page.getByRole("menuitem", { name: "Pièce", exact: true }).click()
  await page.getByLabel("Organe").selectOption({ label: "Freins" })
  await page.getByLabel("Désignation").fill("Plaquettes avant parcours")
  await page.getByLabel("Marque").fill("Brembo")
  await envoyer(page, page.getByRole("button", { name: "Ajouter la pièce", exact: true }))
  await expect(page.getByText("Plaquettes avant parcours", { exact: true }).filter({ visible: true }).first()).toBeVisible()

  await page.getByRole("link", { name: "Atelier", exact: true }).click()
  await page.getByRole("link", { name: /^Freins,/ }).first().click()
  await page.getByRole("button", { name: "Poser une pièce", exact: true }).click()
  await page.getByLabel("Pièce de rechange").selectOption({ label: "Plaquettes avant parcours · Brembo" })
  await envoyer(page, page.getByRole("button", { name: "Poser la pièce", exact: true }))

  // Retour à l'atelier : les freins sont posés, durée connue, zone verte.
  await page.getByRole("link", { name: "Atelier", exact: true }).click()
  await expect(page.getByRole("link", { name: "Freins, Bon, 100%" })).toBeVisible()

  // 5. Travaux : un ordre créé sur les freins, puis terminé avec sa main-d'œuvre (une proposition au Budget).
  await page.getByRole("link", { name: "Travaux", exact: true }).click()
  await page.getByRole("button", { name: "Nouvel ordre", exact: true }).click()
  await page.locator('input[name="titre"]').fill("Plaquettes avant à remplacer")
  const organeFreins = await page.locator('select[name="vehicleComponentId"] option').filter({ hasText: "Freins" }).first().getAttribute("value")
  await page.locator('select[name="vehicleComponentId"]').selectOption(organeFreins ?? "")
  await envoyer(page, page.getByRole("dialog").getByRole("button", { name: "Créer l'ordre", exact: true }))
  await page.getByRole("link", { name: "Plaquettes avant à remplacer", exact: true }).click()
  await page.getByRole("button", { name: "Terminer l'ordre", exact: true }).click()
  await page.getByLabel("Main-d'œuvre, en euros (facultatif)").fill("80")
  await envoyer(page, page.getByRole("dialog").getByRole("button", { name: "Terminer l'ordre", exact: true }))
  await expect(page.getByText("Terminé", { exact: true }).filter({ visible: true }).first()).toBeVisible()

  // 6. Commandes : une commande de plaquettes, expédiée, puis reçue (une proposition au Budget).
  await page.getByRole("link", { name: "Commandes", exact: true }).click()
  await page.getByRole("link", { name: "Nouvelle commande", exact: true }).click()
  await page.locator('select[name="supplierContactId"]').selectOption({ label: FOURNISSEUR })
  await page.locator('input[name="ligne1Designation"]').fill("Plaquettes avant")
  await page.locator('select[name="ligne1ComponentTypeId"]').selectOption({ label: "Freins" })
  await page.locator('input[name="ligne1Quantite"]').fill("2")
  await page.locator('input[name="ligne1Prix"]').fill("12,50")
  await envoyer(page, page.getByRole("button", { name: "Enregistrer la commande", exact: true }))
  await expect(page.getByRole("heading", { name: "Livraisons attendues (1)" })).toBeVisible()
  await page.getByRole("button", { name: "Marquer expédiée", exact: true }).click()
  await envoyer(page, page.getByRole("dialog").getByRole("button", { name: "Marquer expédiée", exact: true }))
  await page.getByRole("button", { name: "Recevoir", exact: true }).click()
  await envoyer(page, page.getByRole("dialog").getByRole("button", { name: "Recevoir la commande", exact: true }))
  await expect(page.getByRole("heading", { name: "Reçues (1)" })).toBeVisible()

  // 7. Budget : les deux propositions venues du Garage (la main-d'œuvre et la pièce achetée) sont à confirmer.
  await retourAuQg(page)
  await tuile(page, "budget").click()
  await page.getByRole("link", { name: /À confirmer/ }).click()
  await expect(page.getByRole("button", { name: "Confirmer", exact: true })).toHaveCount(2)
  await retourAuQg(page)

  // 8. Téléphone : l'atelier tient dans la largeur, avec ses organes.
  await page.setViewportSize(TELEPHONE)
  await tuile(page, "garage").click()
  await expect(page.getByRole("heading", { name: "Atelier", exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "Freins, Bon, 100%" })).toBeVisible()
  await sansDefilementHorizontal(page)
})
