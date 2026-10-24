// Parcours de John (tâche 4.3d, réécrit à l'étape 7 du brief 4.3e) : la team de test créée par pnpm team:creer puis pnpm
// donnees:koehling, comme la team de dev, sans aide SQL pour l'écrire. Seule la connexion passe par la base (code connu,
// comme connexion.spec.ts). Entrée par /connexion, puis des clics depuis le QG : aucune adresse tapée après l'entrée. Chaque
// écran est ouvert et utilisé comme le fait John. Le parcours part d'un atelier au rouge (un roulage qui use les freins), et
// le fait repasser au vert par une réparation, puis par deux remplacements : un avec prix et fournisseur, un depuis le stock
// avec sa destination (954 v1.2, §2 ; v1.3, §4). Puis un train de pneus pluie monté, et un abandon validé dans Saison dont
// la fiche casse est complétée au Garage (brief 4.4). Les captures à 1440 et à 360 px partent dans docs/captures/.
// Règle humaine : après chaque clic qui navigue, le test attend la page d'arrivée (son URL, puis son titre h1) avant le
// clic suivant. Une page dont l'URL a changé mais dont le contenu est resté celui de la page précédente fait échouer le
// test à cet endroit, comme John le verrait.
import path from "node:path"

import { expect, test, type Locator, type Page } from "@playwright/test"

import { envoyer } from "./aide/envoi"
import { tuilesDuQg } from "./aide/navigation"
import { CODE_CONNU, ajouterCodeConnu } from "./aide/session"
import { TYPES_DEFAUT } from "../src/apps/garage/types-defaut"

// Team créée par la CI avant la suite (étape « Team du parcours de John » du workflow).
const EMAIL = "parcours-john@example.test"
const NOM_VEHICULE = "Citroën Saxo VTS"
const FOURNISSEUR = "Pièces rallye parcours"
const DOSSIER = path.join(__dirname, "..", "docs", "captures")

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

// Capture pleine page : éléments fixes masqués, sauf le tiroir ouvert (même convention que garage-captures.spec.ts).
async function capturerPage(page: Page, nom: string): Promise<void> {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" })
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>("body *").forEach((element) => {
      if (element.closest('[role="dialog"]')) return
      if (getComputedStyle(element).position === "fixed") element.style.display = "none"
    })
  })
  await page.screenshot({ path: path.join(DOSSIER, nom), fullPage: true, animations: "disabled" })
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

// Ouvre l'atelier depuis le QG : la tuile, puis l'arrivée sur son titre.
async function ouvrirAtelier(page: Page): Promise<void> {
  await tuile(page, "garage").click()
  await arriver(page, /\/apps\/garage$/, /^Atelier$/)
}

// La carte des freins, dans l'atelier : son nom accessible suit « Organe, zone, état ».
function carteFreins(page: Page, nom: RegExp | string): Locator {
  return page.getByRole("link", { name: nom }).filter({ visible: true }).first()
}

test("parcours de John : le QG, l'atelier du rouge au vert, Commandes, Budget, la Voiture, et le téléphone", async ({ page }) => {
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
  await ouvrirAtelier(page)
  const preparer = page.getByRole("button", { name: "Préparer l'atelier", exact: true })
  await expect(preparer).toBeVisible()
  await envoyer(page, preparer)
  for (const type of TYPES_DEFAUT) {
    await expect(page.getByText(type.nom, { exact: true }).filter({ visible: true }).first()).toBeVisible()
  }

  // La voiture part équipée (954 v1.2, « Voiture équipée dès le départ ») : chaque emplacement a sa pièce d'origine montée,
  // sans durée de vie. John renseigne la durée des freins (40 000 km, 10 épreuves) : la carte passe en zone verte.
  await page.getByRole("listitem").filter({ hasText: "Freins" }).getByRole("button", { name: "Renseigner la durée de vie" }).first().click()
  await page.getByLabel("Durée en kilomètres").fill("40000")
  await page.getByLabel("Durée en épreuves").fill("10")
  await envoyer(page, page.getByRole("button", { name: "Enregistrer la durée", exact: true }))
  // Le pourcentage de la barre a une espace insécable avant « % » (mise-en-forme.ts) : \s l'accepte.
  await expect(page.getByRole("img", { name: /État : 100\s%/ }).first()).toBeVisible()

  // 4. Au rouge : un roulage de 38 000 km use les freins à 95 % de leur durée (seuil rouge à 10 %). La carte passe en zone rouge.
  await page.getByRole("button", { name: "Ajouter", exact: true }).click()
  await page.getByRole("menuitem", { name: "Roulage", exact: true }).click()
  await arriver(page, /\/apps\/garage\/roulage$/, /^Roulage$/)
  await page.getByLabel("Kilomètres roulés").fill("38000")
  await envoyer(page, page.getByRole("button", { name: "Enregistrer le roulage", exact: true }))
  await arriver(page, /\/apps\/garage$/, /^Atelier$/)
  await expect(carteFreins(page, /^Freins, Zone rouge/)).toBeVisible()
  await capturerPage(page, "parcours-john-atelier-rouge-1440.png")

  // 5. Réparer les freins (954 v1.3, §2 et §4) : « Réparer » crée un ordre de réparation, avec sa main-d'œuvre. Sa fin
  // demande l'état de la pièce après réparation : 80 %. La carte repasse en zone verte, à l'état saisi.
  await carteFreins(page, /^Freins, Zone rouge/).click()
  await arriver(page, /\/apps\/garage\/organes\/[0-9a-f-]{36}$/)
  await page.getByRole("button", { name: "Réparer", exact: true }).click()
  await page.getByLabel("Ce qui est réparé").fill("Plaquettes et disques refaits")
  await page.getByLabel("Main-d'œuvre, en euros (facultatif)").fill("80,00")
  await envoyer(page, page.getByRole("button", { name: "Ajouter la réparation", exact: true }))
  await arriver(page, /\/apps\/garage\/travaux$/)
  await page.getByRole("link", { name: /Plaquettes et disques refaits/ }).first().click()
  await arriver(page, /\/apps\/garage\/travaux\/[0-9a-f-]{36}$/)
  await page.getByRole("button", { name: "Terminer l'ordre", exact: true }).click()
  await page.getByRole("dialog").getByLabel("État de la pièce après réparation (%)").fill("80")
  await envoyer(page, page.getByRole("dialog").getByRole("button", { name: "Terminer l'ordre", exact: true }))
  await expect(page.getByText("Cet ordre est terminé : il ne se modifie plus.")).toBeVisible()
  await retourAuQg(page)
  await ouvrirAtelier(page)
  await expect(carteFreins(page, "Freins, Bon, 80%")).toBeVisible()

  // 6. Remplacer les freins avec une pièce achetée : prix et fournisseur, la pièce usée part en réserve. La réception
  // ouvre une dépense côté Budget (954 v1.2, §2 ; décision de John : Budget pour le remplacement avec prix).
  await carteFreins(page, "Freins, Bon, 80%").click()
  await arriver(page, /\/apps\/garage\/organes\/[0-9a-f-]{36}$/)
  await page.getByRole("button", { name: "Remplacer", exact: true }).click()
  const tiroir = page.getByRole("dialog")
  await expect(tiroir).toBeVisible()
  await tiroir.getByLabel("Désignation").fill("Plaquettes avant neuves")
  await tiroir.getByLabel("Marque (facultatif)").fill("Ferodo")
  await tiroir.getByLabel("Prix, en euros (facultatif)").fill("45,00")
  await tiroir.locator('select[name="fournisseurContactId"]').selectOption({ label: FOURNISSEUR })
  await tiroir.getByLabel("Motif de dépose de la pièce en place").selectOption("usure")
  await tiroir.getByLabel("Ce que devient l'ancienne pièce").selectOption({ label: "En réserve (en stock)" })
  await envoyer(page, tiroir.getByRole("button", { name: "Remplacer la pièce", exact: true }))
  await expect(tiroir).toBeHidden()
  await expect(page.getByText("Plaquettes avant neuves", { exact: true }).first()).toBeVisible()
  await capturerPage(page, "parcours-john-remplacement-prix-1440.png")

  // 7. Remplacer depuis le stock, avec destination : la pièce mise en réserve à l'étape 6 est posée, et la pièce achetée
  // part au rebut (cassée). La destination n'a pas de valeur par défaut : John la choisit.
  await page.getByRole("button", { name: "Remplacer", exact: true }).click()
  const tiroirStock = page.getByRole("dialog")
  await expect(tiroirStock).toBeVisible()
  await expect(tiroirStock.getByLabel("Pièce de rechange")).toBeVisible()
  await tiroirStock.getByLabel("Motif de dépose de la pièce en place").selectOption("usure")
  await tiroirStock.getByLabel("Ce que devient l'ancienne pièce").selectOption({ label: "Au rebut (cassée)" })
  await envoyer(page, tiroirStock.getByRole("button", { name: "Remplacer la pièce", exact: true }))
  await expect(tiroirStock).toBeHidden()

  // 8. Commandes : une commande de plaquettes, expédiée, puis reçue (une proposition au Budget).
  await retourAuQg(page)
  await tuile(page, "garage").click()
  await arriver(page, /\/apps\/garage$/, /^Atelier$/)
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
  // La réception de l'étape 6 est déjà listée : deux commandes reçues, dont celle-ci (2 × 12,50 €).
  await expect(page.getByRole("heading", { name: "Reçues (2)" })).toBeVisible()
  await expect(page.getByText("2 × Plaquettes avant (Freins, Origine)")).toBeVisible()

  // 9. Budget : trois propositions venues du Garage, à confirmer : la main-d'œuvre de la réparation, la pièce achetée
  // au remplacement, et la commande reçue.
  await retourAuQg(page)
  await tuile(page, "budget").click()
  await arriver(page, /\/apps\/budget$/, TITRE_APP.budget)
  await page.getByRole("link", { name: /À confirmer/ }).click()
  await arriver(page, /\/apps\/budget\/a-confirmer$/)
  await expect(page.getByRole("button", { name: "Confirmer", exact: true })).toHaveCount(3)
  await retourAuQg(page)

  // 10. Voiture : la Déco de la Saxo. Sans plan, John choisit le modèle, qui crée les emplacements, puis la silhouette apparaît à l'atelier.
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

  // 11. Pneus : un train pluie, ajouté puis monté sur l'organe Pneus de la Saxo avant une épreuve sous la pluie (954 v1.2, §2 ;
  // brief 4.4, §2). La capture part à 360 px, puis le test revient au bureau pour le QG.
  await tuile(page, "garage").click()
  await arriver(page, /\/apps\/garage$/, /^Atelier$/)
  await page.locator('a[href="/apps/garage/pneus"]').click()
  await arriver(page, /\/apps\/garage\/pneus$/, /^Pneus$/)
  await page.getByRole("link", { name: "Ajouter un train", exact: true }).click()
  await arriver(page, /\/apps\/garage\/pneus\/nouveau$/)
  await page.getByLabel("Marque", { exact: true }).fill("Pirelli")
  await page.getByRole("combobox", { name: "Type", exact: true }).selectOption({ label: "Pluie" })
  await page.getByLabel("Modèle (facultatif)").fill("Cinturato")
  await page.getByLabel("Dimensions (facultatif)").fill("195/55 R15")
  await envoyer(page, page.getByRole("button", { name: "Ajouter le train", exact: true }))
  await arriver(page, /\/apps\/garage\/pneus$/)
  await expect(page.getByText("Pirelli").first()).toBeVisible()
  // La team de démonstration a déjà un train : on ouvre celui qu'on vient d'ajouter.
  await page.locator("li", { hasText: "Pirelli" }).getByRole("link", { name: "Ouvrir le train", exact: true }).click()
  await arriver(page, /\/apps\/garage\/pneus\/[0-9a-f-]{36}$/)
  await envoyer(page, page.getByRole("button", { name: "Monter ce train", exact: true }))
  await expect(page.getByRole("button", { name: "Monter ce train", exact: true })).toHaveCount(0)
  await page.setViewportSize(TELEPHONE)
  await sansDefilementHorizontal(page)
  await capturerPage(page, "parcours-john-pneus-360.png")
  await page.setViewportSize(BUREAU)
  await retourAuQg(page)

  // 12. Abandon, fiche casse complétée (954 v1.3, §1 et §3 ; brief 4.4, §4). John saisit l'abandon de l'épreuve de démonstration
  // (la Saxo y est engagée), et le valide lui-même : un responsable peut valider son propre résultat. La validation ouvre la
  // fiche casse au Garage, que John complète : type, cause, organe touché. La capture part à 360 px.
  // L'engagement de la démonstration n'a ni dossier ni paiement : Saison le laisse « envisagé ». John enregistre le paiement ;
  // l'épreuve étant passée, l'engagement est parti, et son résultat se saisit.
  await tuile(page, "saison").click()
  await arriver(page, /\/apps\/saison$/, TITRE_APP.saison)
  await page.getByRole("link", { name: "Liste", exact: true }).click()
  await page.getByRole("link", { name: /20e Rallye de l'Alsace Bossue/ }).click()
  await arriver(page, /\/apps\/saison\/epreuves\/[0-9a-f-]{36}$/)
  await page.getByRole("link", { name: "Engagements", exact: true }).click()
  await page.getByRole("link", { name: /Citroën Saxo VTS/ }).first().click()
  await arriver(page, /\/apps\/saison\/engagements\/[0-9a-f-]{36}$/)
  await page.getByRole("button", { name: "Enregistrer un paiement", exact: true }).click()
  await page.getByLabel("Montant payé (€)").fill("450")
  await envoyer(page, page.getByRole("dialog").getByRole("button", { name: "Enregistrer le paiement", exact: true }))
  await expect(page.getByRole("dialog")).toHaveCount(0)

  // Retour à l'épreuve par son lien d'en-tête (la page de l'engagement n'a pas le QG), puis l'onglet Résultats.
  await page.getByRole("link", { name: /← 20e Rallye de l'Alsace Bossue/ }).click()
  await arriver(page, /\/apps\/saison\/epreuves\/[0-9a-f-]{36}$/)
  await page.getByRole("link", { name: "Résultats", exact: true }).click()
  await page.getByRole("button", { name: /^(Saisir|Modifier) le résultat$/ }).first().click()
  const tiroirAbandon = page.getByRole("dialog")
  await expect(tiroirAbandon).toBeVisible()
  await tiroirAbandon.getByLabel("Statut final").selectOption({ label: "Abandon" })
  await tiroirAbandon.getByRole("button", { name: "Plus de détails", exact: true }).click()
  await tiroirAbandon.getByLabel("Cause de l'abandon").fill("Casse de cardan")
  await envoyer(page, tiroirAbandon.getByRole("button", { name: "Enregistrer le résultat", exact: true }))
  await expect(tiroirAbandon).toBeHidden()
  await envoyer(page, page.getByRole("button", { name: "Valider", exact: true }).first())
  await expect(page.getByRole("button", { name: "Valider", exact: true })).toHaveCount(0)

  await tuile(page, "garage").click()
  await arriver(page, /\/apps\/garage$/, /^Atelier$/)
  await page.getByRole("link", { name: "Casses", exact: true }).click()
  await arriver(page, /\/apps\/garage\/casses$/)
  await page.getByRole("link", { name: /19 septembre 2026 · 20e Rallye de l'Alsace Bossue/ }).click()
  await arriver(page, /\/apps\/garage\/casses\/[0-9a-f-]{36}$/)
  await expect(page.getByRole("heading", { name: "Casse du 19 septembre 2026", exact: true, level: 1 })).toBeVisible()
  await page.getByLabel("Type de casse").selectOption({ label: "Casse mécanique" })
  await page.getByLabel("Cause (facultatif)").fill("Casse de cardan")
  await page.getByRole("checkbox", { name: "Freins", exact: true }).check()
  await envoyer(page, page.getByRole("button", { name: "Enregistrer la fiche", exact: true }))
  await expect(page.getByText("À compléter", { exact: true })).toHaveCount(0)
  await page.setViewportSize(TELEPHONE)
  await sansDefilementHorizontal(page)
  await capturerPage(page, "parcours-john-casse-360.png")
  await page.setViewportSize(BUREAU)
  await retourAuQg(page)

  // 13. Téléphone : l'atelier tient dans la largeur, avec ses organes et sa silhouette, après les remplacements.
  await page.setViewportSize(TELEPHONE)
  await tuile(page, "garage").click()
  await arriver(page, /\/apps\/garage$/, /^Atelier$/)
  await expect(carteFreins(page, /^Freins,/)).toBeVisible()
  await sansDefilementHorizontal(page)
  await capturerPage(page, "parcours-john-atelier-360.png")
})
