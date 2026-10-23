// Parcours de John (tâche 4.3d) : la team de test créée par pnpm team:creer puis pnpm donnees:koehling, comme la team de
// dev, sans aide SQL pour l'écrire. Seule la connexion passe par la base (code connu, comme connexion.spec.ts). Entrée par
// /connexion, puis des clics depuis le QG : aucune adresse tapée après l'entrée. Chaque écran est ouvert et utilisé comme
// le fait John. Un défaut (l'atelier vide avant « Préparer l'atelier ») fait échouer le test à l'endroit où John le verrait.
// Règle humaine : après chaque clic qui navigue, le test attend la page d'arrivée (son URL, puis son titre h1) avant le
// clic suivant. Une page dont l'URL a changé mais dont le contenu est resté celui de la page précédente fait échouer le
// test à cet endroit, comme John le verrait.
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

// Titre h1 attendu à l'arrivée de chaque app depuis le QG (les apps sans titre fixe n'ont que l'URL vérifiée).
const TITRE_APP: Record<string, RegExp> = {
  saison: /^Saison/,
  budget: /Mouvements|Budget/,
  partenaires: /^Prospection$/,
  voiture: /^Mes véhicules$/,
  garage: /^Atelier$/,
  settings: /^Réglages$/,
}

// Une tuile du QG : un lien vers l'app, avec son titre.
function tuile(page: Page, cle: string): Locator {
  return page.locator(`a[href="/apps/${cle}"]`).filter({ has: page.locator("h2") })
}

// Arrivée d'une navigation, vue comme John : l'URL d'abord, puis le titre h1 (s'il est connu). Le clic suivant ne part qu'après.
// L'URL s'attend sur son chemin seul : les paramètres (?vehicule=…) ne comptent pas.
async function arriver(page: Page, chemin: RegExp, titre?: RegExp): Promise<void> {
  await page.waitForURL((adresse) => chemin.test(adresse.pathname))
  if (titre) await expect(page.getByRole("heading", { level: 1 }).filter({ visible: true }).filter({ hasText: titre }).first()).toBeVisible()
}

// Retour au QG par le lien de l'en-tête (le nom de la team, puis « retour au QG »).
async function retourAuQg(page: Page): Promise<void> {
  await page.getByRole("link", { name: /retour au QG/ }).filter({ visible: true }).first().click()
  await page.waitForURL(/\/qg$/)
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
    const tuileRang = tuilesDuQg(page).nth(rang)
    const cible = (await tuileRang.getAttribute("href")) ?? ""
    const cle = cible.split("/").pop() ?? ""
    await tuileRang.click()
    await arriver(page, new RegExp(`^/apps/${cle}(/|$)`), TITRE_APP[cle])
    await sansErreur(page)
    await retourAuQg(page)
  }

  // 2. Partenaires : le fournisseur des commandes, créé comme John le crée (le « + », puis le prospect).
  await tuile(page, "partenaires").click()
  await arriver(page, /\/apps\/partenaires$/, /^Prospection$/)
  await page.getByRole("button", { name: "Ajouter", exact: true }).click()
  await page.getByRole("menuitem", { name: "Partenaire", exact: true }).click()
  await arriver(page, /\/apps\/partenaires\/nouveau$/, /^Nouveau prospect$/)
  await page.getByLabel("Entreprise", { exact: true }).fill(FOURNISSEUR)
  await envoyer(page, page.getByRole("button", { name: "Ajouter le prospect", exact: true }))
  await arriver(page, /\/apps\/partenaires\/[0-9a-f-]{36}$/)
  await expect(page.getByRole("heading", { name: FOURNISSEUR, exact: true }).filter({ visible: true }).first()).toBeVisible()
  await retourAuQg(page)

  // 3. Garage : l'atelier de la Saxo, sans gabarit. Il n'a aucun organe avant « Préparer l'atelier » : c'est ici que le défaut apparaît.
  await tuile(page, "garage").click()
  await arriver(page, /\/apps\/garage$/, /^Atelier$/)
  const preparer = page.getByRole("button", { name: "Préparer l'atelier", exact: true })
  await expect(preparer).toBeVisible()
  await envoyer(page, preparer)
  for (const type of TYPES_DEFAUT) {
    await expect(page.getByText(type.nom, { exact: true }).filter({ visible: true }).first()).toBeVisible()
  }

  // La voiture part équipée (954 v1.2, « Voiture équipée dès le départ ») : chaque emplacement a sa pièce d'origine montée,
  // sans durée de vie. John renseigne la durée des freins, puis la carte passe en zone verte. Le remplacement d'une pièce
  // est l'étape 6 du brief 4.3e, il n'est pas dans ce parcours pour l'instant.
  await expect(page.getByRole("listitem").filter({ hasText: "Freins" }).getByRole("button", { name: "Renseigner la durée de vie" }).first()).toBeVisible()
  await page.getByRole("listitem").filter({ hasText: "Freins" }).getByRole("button", { name: "Renseigner la durée de vie" }).first().click()
  await page.getByLabel("Durée en kilomètres").fill("40000")
  await page.getByLabel("Durée en épreuves").fill("10")
  await envoyer(page, page.getByRole("button", { name: "Enregistrer la durée", exact: true }))
  // Le pourcentage de la barre a une espace insécable avant « % » (mise-en-forme.ts) : \s l'accepte.
  await expect(page.getByRole("img", { name: /État : 100\s%/ }).first()).toBeVisible()

  // 5. Travaux : un ordre créé sur les freins, puis terminé avec sa main-d'œuvre (une proposition au Budget).
  await page.getByRole("link", { name: "Travaux", exact: true }).click()
  await arriver(page, /\/apps\/garage\/travaux$/)
  await page.getByRole("button", { name: "Nouvel ordre", exact: true }).click()
  await page.locator('input[name="titre"]').fill("Plaquettes avant à remplacer")
  const organeFreins = await page.locator('select[name="vehicleComponentId"] option').filter({ hasText: "Freins" }).first().getAttribute("value")
  await page.locator('select[name="vehicleComponentId"]').selectOption(organeFreins ?? "")
  await envoyer(page, page.getByRole("dialog").getByRole("button", { name: "Créer l'ordre", exact: true }))
  await page.getByRole("link", { name: "Plaquettes avant à remplacer", exact: true }).click()
  await arriver(page, /\/apps\/garage\/travaux\/[0-9a-f-]{36}$/)
  // Le coût se saisit d'abord (« Coût et prestataire », tiroir propre à l'ordre), puis l'ordre se termine.
  await page.getByRole("button", { name: "Coût et prestataire", exact: true }).click()
  await page.getByRole("dialog").getByLabel("Main-d'œuvre, en euros (facultatif)").fill("80")
  await envoyer(page, page.getByRole("dialog").getByRole("button", { name: "Enregistrer", exact: true }))
  await page.getByRole("button", { name: "Terminer l'ordre", exact: true }).click()
  // Une réparation sur un organe avec pièce montée demande l'état de la pièce après réparation (954 v1.3, §4).
  await page.getByRole("dialog").getByLabel("État de la pièce après réparation (%)").fill("80")
  await envoyer(page, page.getByRole("dialog").getByRole("button", { name: "Terminer l'ordre", exact: true }))
  await expect(page.getByText("Terminé", { exact: true }).filter({ visible: true }).first()).toBeVisible()

  // 6. Commandes : une commande de plaquettes, expédiée, puis reçue (une proposition au Budget).
  await page.getByRole("link", { name: "Commandes", exact: true }).click()
  await arriver(page, /\/apps\/garage\/commandes$/)
  await page.getByRole("link", { name: "Nouvelle commande", exact: true }).click()
  await arriver(page, /\/apps\/garage\/commandes\/nouvelle$/)
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
  await arriver(page, /\/apps\/budget$/, TITRE_APP.budget)
  await page.getByRole("link", { name: /À confirmer/ }).click()
  await arriver(page, /\/apps\/budget\/a-confirmer$/)
  await expect(page.getByRole("button", { name: "Confirmer", exact: true })).toHaveCount(2)
  await retourAuQg(page)

  // 8. Voiture : la Déco de la Saxo. Sans plan, John choisit le modèle, qui crée les emplacements, puis la silhouette apparaît à l'atelier.
  await tuile(page, "voiture").click()
  await arriver(page, /\/apps\/voiture$/, TITRE_APP.voiture)
  await page.getByRole("link", { name: NOM_VEHICULE }).click()
  await arriver(page, /\/apps\/voiture\/vehicules\/[0-9a-f-]{36}$/)
  await page.getByRole("link", { name: "Déco", exact: true }).click()
  await expect(page.getByText("Ce véhicule n'a pas encore de plan.")).toBeVisible()
  await page.locator('select[name="gabaritCle"]').selectOption("citadine_3p_saxo")
  await envoyer(page, page.getByRole("button", { name: "Choisir ce modèle", exact: true }))
  await expect(page.getByText("Ce véhicule n'a pas encore de plan.")).toHaveCount(0)
  await page.getByRole("button", { name: "Côté droit", exact: true }).click()
  await sansErreur(page)
  await retourAuQg(page)

  // 9. Téléphone : l'atelier tient dans la largeur, avec ses organes et sa silhouette.
  await page.setViewportSize(TELEPHONE)
  await tuile(page, "garage").click()
  await arriver(page, /\/apps\/garage$/, /^Atelier$/)
  // Freins réparés à l'étape 6 avec un état saisi de 80 % : c'est cet état qui s'affiche (954 v1.3, §4), pas le calcul à 100 %.
  await expect(page.getByRole("link", { name: "Freins, Bon, 80%" })).toBeVisible()
  await sansDefilementHorizontal(page)
})
