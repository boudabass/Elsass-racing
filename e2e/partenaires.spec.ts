// Partenaires, écrans (brief 3.6, §8) : le parcours du responsable, du prospect au lien de la page partenaire ;
// puis les droits, le téléphone, les modèles, l'audit Impeccable (point 0.2) et le thème clair. Les captures partent
// dans docs/captures/ : à 1440 px, à 360 px, et en thème clair à 1440 px. Le PDF d'exemple est docs/captures/convention-exemple.pdf.
import fs from "node:fs"
import path from "node:path"

import type { Browser, BrowserContext, Page } from "@playwright/test"

import { expect, test } from "./aide/fixtures"
import { connecterParLien, tuilesDuQg } from "./aide/navigation"
import { renseignerMentionsConvention } from "./aide/partenaire-page"
import { ajouterMembreConnectable, compterEvenements, jetonEnClairEnBase, preparerSaison } from "./aide/session"

const DOSSIER = path.join(__dirname, "..", "docs", "captures")
const PDF_SIGNE = path.join(__dirname, "fichiers", "preuve.pdf")
const PHOTO = path.join(__dirname, "fichiers", "logo.png")
const BUREAU = { width: 1440, height: 900 }
const TELEPHONE = { width: 360, height: 740 }

// Jour civil (AAAA-MM-JJ) dans n jours, à Paris : la locale suédoise donne ce format. On compte en jours du calendrier :
// ajouter 24 h × n à l'instant passe mal l'heure d'été (72 h à minuit Paris tombent la veille le week-end du changement).
function jourDans(jours: number): string {
  const [annee, mois, jour] = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(new Date()).split("-").map(Number)
  return new Date(Date.UTC(annee, mois - 1, jour + jours)).toISOString().slice(0, 10)
}

// Aucun défilement horizontal sur la page, à la largeur courante.
async function sansDefilementHorizontal(page: Page): Promise<void> {
  const deborde = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(deborde, "défilement horizontal sur la page").toBe(false)
}

// Les boutons de la page font au moins 44 px de haut (cible tactile).
async function boutonsAQuaranteQuatre(page: Page): Promise<void> {
  const boutons = page.locator("main button:visible")
  const nombre = await boutons.count()
  for (let i = 0; i < nombre; i++) {
    const boite = await boutons.nth(i).boundingBox()
    expect(boite?.height ?? 44, `bouton trop petit n° ${i}`).toBeGreaterThanOrEqual(43.5)
  }
}

// Capture pleine page : éléments fixes masqués, comme dans voiture-deco.spec.ts.
async function capturer(page: Page, nom: string): Promise<void> {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" })
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>("body *").forEach((element) => {
      if (getComputedStyle(element).position === "fixed") element.style.display = "none"
    })
  })
  await page.screenshot({ path: path.join(DOSSIER, nom), fullPage: true })
}

// Une entrée du bouton + : un menu sur ordinateur (menuitem), une feuille de liens sur téléphone (link).
function entreeAjouter(page: Page, libelle: string) {
  return page.getByRole("menuitem", { name: libelle, exact: true }).or(page.getByRole("link", { name: libelle, exact: true }))
}

// Ouvre le bouton + et l'entrée « Partenaire », puis le formulaire de prospect.
async function ouvrirNouveauProspect(page: Page): Promise<void> {
  await page.goto("/apps/partenaires")
  await page.getByRole("button", { name: "Ajouter", exact: true }).click()
  await entreeAjouter(page, "Partenaire").click()
  await page.waitForURL(/\/apps\/partenaires\/nouveau$/)
}

// Crée un prospect par le formulaire à deux champs, et renvoie l'identifiant de sa fiche.
async function creerProspect(page: Page, entreprise: string): Promise<string> {
  await ouvrirNouveauProspect(page)
  await page.getByLabel("Entreprise", { exact: true }).fill(entreprise)
  await page.getByRole("button", { name: "Ajouter le prospect", exact: true }).click()
  await page.waitForURL(/\/apps\/partenaires\/[0-9a-f-]{36}$/)
  return new URL(page.url()).pathname.split("/")[3]
}

// Crée une convention de 1 500 € en deux échéances (une par ligne), et renvoie son identifiant.
async function creerConvention(page: Page, partenaireId: string): Promise<string> {
  await page.goto(`/apps/partenaires/${partenaireId}?onglet=conventions`)
  await page.getByRole("link", { name: "Nouvelle convention" }).click()
  await page.waitForURL(/\/conventions\/nouvelle$/)
  await page.getByLabel("Apport financier (€)", { exact: true }).fill("1 500")
  await page.getByLabel("Date, ligne 1", { exact: true }).fill("2027-03-15")
  await page.getByLabel("Montant (€), ligne 1", { exact: true }).fill("750")
  await page.getByRole("button", { name: "Ajouter une ligne" }).click()
  await page.getByLabel("Date, ligne 2", { exact: true }).fill("2027-09-15")
  await page.getByLabel("Montant (€), ligne 2", { exact: true }).fill("750")
  await page.getByRole("button", { name: "Créer la convention" }).click()
  // La création ouvre la convention sur son onglet Contreparties (?onglet=contreparties).
  await page.waitForURL(/\/apps\/partenaires\/conventions\/[0-9a-f-]{36}(\?.*)?$/)
  return new URL(page.url()).pathname.split("/")[4]
}

// La ligne d'une contrepartie, repérée par son titre : le texte seul matche aussi les options des menus de la liste de base.
function ligneContrepartie(page: Page, nom: string) {
  return page.locator('li[id^="contrepartie-"]').filter({ has: page.getByRole("heading", { name: nom, exact: true }) })
}

// Une contrepartie de la liste de base, par son nom. Un logo prend l'emplacement « Portière droite » de la voiture.
async function ajouterContrepartie(page: Page, conventionId: string, nomListe: string, emplacement?: string): Promise<void> {
  await page.goto(`/apps/partenaires/conventions/${conventionId}`)
  await page.getByRole("button", { name: "Ajouter une contrepartie", exact: true }).click()
  const tiroir = page.getByRole("dialog")
  await tiroir.getByLabel("Dans la liste de base", { exact: true }).selectOption({ label: nomListe })
  if (emplacement) {
    const valeur = await tiroir.getByLabel("Emplacement sur la voiture", { exact: true }).locator("option", { hasText: emplacement }).first().getAttribute("value")
    await tiroir.getByLabel("Emplacement sur la voiture", { exact: true }).selectOption(valeur ?? "")
  }
  await tiroir.getByRole("button", { name: "Ajouter la contrepartie", exact: true }).click()
  // Le libellé existe aussi comme option du menu de la liste de base : on vérifie la ligne de la contrepartie.
  await expect(ligneContrepartie(page, nomListe)).toBeVisible()
}

// La Saxo 2 créée par le bouton + : ses emplacements viennent du gabarit (Portière, Capot…).
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

// Signe la convention : marquer envoyée, puis marquer signée avec le PDF. Attend l'envoi du fichier.
async function signerConvention(page: Page, conventionId: string): Promise<void> {
  await page.goto(`/apps/partenaires/conventions/${conventionId}`)
  await page.getByRole("button", { name: "Marquer envoyée" }).click()
  // Le formulaire « Marquer envoyée » disparaît avec son message : c'est le bloc « Marquer signée » qui atteste le statut.
  const actionSignee = page.getByRole("button", { name: "Marquer signée", exact: true })
  await expect(actionSignee).toBeVisible()
  await actionSignee.click()
  const tiroir = page.getByRole("dialog")
  await tiroir.getByLabel("Signataires", { exact: true }).fill("Jeoffrey Koehling, Garage Muller")
  const envoi = page.waitForResponse((reponse) => reponse.url().includes("/api/fichiers") && reponse.request().method() === "POST")
  await tiroir.getByLabel("Document signé", { exact: true }).setInputFiles(PDF_SIGNE)
  await envoi
  await tiroir.getByRole("button", { name: "Marquer signée", exact: true }).click()
  await expect(page.getByText(/^Signée par Jeoffrey Koehling/)).toBeVisible()
}

// Ouvre une session pour un autre membre, dans son propre contexte.
async function connecterMembre(browser: Browser, secretLien: string): Promise<BrowserContext> {
  const contexte = await browser.newContext()
  const page = await contexte.newPage()
  await page.goto(`/connexion/lien?t=${secretLien}`)
  await page.waitForURL(/\/qg$/)
  await page.close()
  return contexte
}

async function passerEnThemeClair(page: Page): Promise<void> {
  await page.goto("/apps/settings/affichage")
  await page.getByRole("button", { name: "Modifier l'affichage", exact: true }).click()
  const tiroir = page.getByRole("dialog")
  await tiroir.locator("#theme").selectOption("clair")
  await tiroir.getByRole("button", { name: "Enregistrer", exact: true }).click()
  await expect(tiroir).toHaveCount(0)
}

test("responsable : prospect, échange, convention, document, signature, avancement, preuve et lien", async ({ page, equipe }) => {
  await preparerSaison(equipe, 2027)
  await connecterParLien(page, equipe)

  // 1. Prospect, puis un second ajout du même nom : refusé, avec le lien vers la fiche.
  const partenaireId = await creerProspect(page, "Garage Muller")
  await expect(page.getByText("À contacter", { exact: true }).first()).toBeVisible()
  await page.goto("/apps/partenaires/nouveau")
  await page.getByLabel("Entreprise", { exact: true }).fill("Garage Muller")
  await expect(page.getByRole("link", { name: "Ouvrir sa fiche" })).toBeVisible()
  await page.getByRole("button", { name: "Ajouter le prospect", exact: true }).click()
  await expect(page.getByRole("alert").filter({ hasText: "Cette entreprise est déjà dans Partenaires." })).toBeVisible()

  // 2. Échange avec une prochaine action dans 3 jours : la relance de la Prospection l'affiche.
  await page.goto(`/apps/partenaires/${partenaireId}?onglet=echanges`)
  await page.getByRole("button", { name: "Ajouter un échange", exact: true }).click()
  await page.getByLabel("Résumé", { exact: true }).fill("Appel de prise de contact")
  await page.getByLabel("Prochaine action", { exact: true }).fill("Rappeler")
  await page.getByLabel("Date de la prochaine action", { exact: true }).fill(jourDans(3))
  await page.getByRole("button", { name: "Ajouter l'échange" }).click()
  // Le texte existe aussi dans le champ « Modifier l'échange » (un textarea) : on vise le paragraphe de la liste.
  await expect(page.getByRole("paragraph").filter({ hasText: "Appel de prise de contact" })).toBeVisible()
  await page.goto("/apps/partenaires")
  // Affiché deux fois (la liste et le widget des relances) : il suffit que la relance soit visible.
  await expect(page.getByText("dans 3 jours").first()).toBeVisible()
  await capturer(page, "partenaires-prospection-liste-1440x900.png")

  // 3. Convention de 1 500 € en deux échéances, avec un logo sur la Saxo et quatre publications.
  await creerSaxoDeux(page)
  const conventionId = await creerConvention(page, partenaireId)
  await ajouterContrepartie(page, conventionId, "Logo sur la voiture", "Portière droite")
  await ajouterContrepartie(page, conventionId, "Publications sur les réseaux")
  await page.goto(`/apps/partenaires/conventions/${conventionId}`)
  await expect(page.getByText("Emplacement : Portière droite")).toBeVisible()

  // 4. Document : un PDF de plus de 2 Ko, qui commence par %PDF-. Les mentions légales sont renseignées, pour que
  // l'exemple publié (docs/captures/convention-exemple.pdf) n'ait pas de blanc.
  await renseignerMentionsConvention(equipe, partenaireId)
  await page.goto(`/apps/partenaires/conventions/${conventionId}?onglet=document`)
  await page.locator("section[aria-labelledby=document-genere]").getByRole("button", { name: /Générer le document/ }).click()
  await expect(page.getByRole("status").filter({ hasText: "Document généré." })).toBeVisible()
  await page.reload()
  const lien = page.getByRole("link", { name: "Télécharger le document", exact: true })
  await expect(lien).toBeVisible()
  const reponse = await page.request.get((await lien.getAttribute("href")) ?? "")
  const octets = await reponse.body()
  expect(octets.subarray(0, 5).toString()).toBe("%PDF-")
  expect(octets.length).toBeGreaterThan(2048)
  fs.writeFileSync(path.join(DOSSIER, "convention-exemple.pdf"), octets)

  // 5. Signature : le partenaire passe à « Partenaire », et l'événement est émis.
  await signerConvention(page, conventionId)
  await page.goto(`/apps/partenaires/${partenaireId}`)
  await expect(page.getByText("Partenaire", { exact: true }).first()).toBeVisible()
  await expect.poll(() => compterEvenements(equipe, "partenaires.convention_signee")).toBe(1)

  // 6. Avancement : 4 sur 4 publications, la contrepartie est tenue.
  await page.goto(`/apps/partenaires/conventions/${conventionId}`)
  const publications = ligneContrepartie(page, "Publications sur les réseaux")
  // « Saisir l'avancement » ouvre un tiroir : on y saisit, puis on enregistre dans le tiroir.
  await publications.getByRole("button", { name: "Saisir l'avancement", exact: true }).click()
  const tiroirAvancement = page.getByRole("dialog")
  await tiroirAvancement.getByLabel("Réalisé sur 4", { exact: true }).fill("4")
  await tiroirAvancement.getByRole("button", { name: "Enregistrer l'avancement", exact: true }).click()
  await expect(publications.getByText("Faite", { exact: true })).toBeVisible()
  await expect.poll(() => compterEvenements(equipe, "partenaires.contrepartie_tenue")).toBe(1)

  // 7. Preuves : un lien, puis une photo que l'on masque pour le partenaire.
  await page.reload()
  await publications.getByRole("button", { name: "Ajouter une preuve", exact: true }).click()
  const formulaireLien = page.getByRole("dialog")
  await formulaireLien.getByLabel("Type", { exact: true }).selectOption("lien")
  await formulaireLien.getByLabel("Lien", { exact: true }).fill("https://www.exemple.test/publication")
  await formulaireLien.getByRole("button", { name: "Ajouter la preuve" }).click()
  await expect(publications.getByRole("link", { name: "Ouvrir le lien" })).toBeVisible()

  await page.reload()
  await publications.getByRole("button", { name: "Ajouter une preuve", exact: true }).click()
  const formulairePhoto = page.getByRole("dialog")
  const envoi = page.waitForResponse((reponse) => reponse.url().includes("/api/fichiers") && reponse.request().method() === "POST")
  await formulairePhoto.getByLabel("Photo", { exact: true }).setInputFiles(PHOTO)
  await envoi
  await formulairePhoto.getByRole("button", { name: "Ajouter la preuve" }).click()
  const photo = publications.locator("li").filter({ has: page.getByAltText("Photo de la preuve", { exact: true }) })
  await expect(photo).toBeVisible()
  await photo.getByRole("button", { name: "Masquer", exact: true }).click()
  await expect(photo.getByText("Masquée pour le partenaire")).toBeVisible()
  await capturer(page, "partenaires-convention-1440x900.png")

  // 8. Lien de la page partenaire : affiché une seule fois. Après rechargement, seul l'état reste.
  await page.goto(`/apps/partenaires/${partenaireId}?onglet=page`)
  await page.getByRole("button", { name: "Créer le lien", exact: true }).click()
  const zone = page.getByRole("status").filter({ hasText: "Copie-le maintenant" })
  await expect(zone).toBeVisible()
  const jeton = (await zone.textContent())?.match(/\/p\/([A-Za-z0-9_-]+)/)?.[1] ?? ""
  expect(jeton.length).toBeGreaterThan(20)
  await capturer(page, "partenaires-lien-1440x900.png")
  await page.reload()
  await expect(page.getByText("Lien actif.")).toBeVisible()
  await expect(page.getByText("Copie-le maintenant")).toHaveCount(0)
  await expect.poll(() => jetonEnClairEnBase(equipe, jeton)).toBe(0)

  // Captures de la fiche et des vues d'ensemble.
  await page.goto(`/apps/partenaires/${partenaireId}`)
  await capturer(page, "partenaires-fiche-1440x900.png")
  await page.goto(`/apps/partenaires/${partenaireId}?onglet=echanges`)
  await capturer(page, "partenaires-echanges-1440x900.png")
  await page.goto("/apps/partenaires/contreparties")
  await capturer(page, "partenaires-contreparties-1440x900.png")
  await page.goto("/apps/partenaires")
  await page.goto("/apps/partenaires?vue=colonnes")
  await capturer(page, "partenaires-prospection-colonnes-1440x900.png")
})

test("droits : l'équipage ne voit pas les actions de gestion, l'assistance est refusée", async ({ page, equipe, browser }) => {
  await preparerSaison(equipe, 2027)
  await connecterParLien(page, equipe)
  const partenaireId = await creerProspect(page, "Atelier Droits")
  const conventionId = await creerConvention(page, partenaireId)
  await signerConvention(page, conventionId)

  // L'équipage : écriture, pas la gestion. Pas de « Résilier », d'avenant, ni d'onglet « Page partenaire ».
  const equipage = await ajouterMembreConnectable(equipe, "equipage")
  const contexteEquipage = await connecterMembre(browser, equipage.secretLien)
  const pageEquipage = await contexteEquipage.newPage()
  await pageEquipage.goto(`/apps/partenaires/conventions/${conventionId}`)
  await expect(pageEquipage.getByText(/^Signée par Jeoffrey Koehling/)).toBeVisible()
  await expect(pageEquipage.getByRole("button", { name: "Résilier la convention", exact: true })).toHaveCount(0)
  await expect(pageEquipage.getByRole("button", { name: "Ajouter un avenant", exact: true })).toHaveCount(0)
  await pageEquipage.goto(`/apps/partenaires/${partenaireId}`)
  await expect(pageEquipage.getByRole("link", { name: "Page partenaire" })).toHaveCount(0)
  await contexteEquipage.close()

  // L'assistance : pas d'accès. La page de refus, et pas d'entrée dans les tuiles du QG.
  const assistance = await ajouterMembreConnectable(equipe, "assistance")
  const contexteAssistance = await connecterMembre(browser, assistance.secretLien)
  const pageAssistance = await contexteAssistance.newPage()
  await pageAssistance.goto("/apps/partenaires")
  await expect(pageAssistance.getByText("Tu n'as pas accès à cette app")).toBeVisible()
  await pageAssistance.goto("/qg")
  await expect(tuilesDuQg(pageAssistance).filter({ hasText: "Partenaires" })).toHaveCount(0)
  await contexteAssistance.close()
})

test("téléphone 360 px : pas de défilement horizontal, boutons de 44 px", async ({ page, equipe }) => {
  await preparerSaison(equipe, 2027)
  await connecterParLien(page, equipe)
  await page.setViewportSize(TELEPHONE)
  const partenaireId = await creerProspect(page, "Garage Telephone")
  const conventionId = await creerConvention(page, partenaireId)

  await page.goto("/apps/partenaires")
  await sansDefilementHorizontal(page)
  await boutonsAQuaranteQuatre(page)
  await capturer(page, "partenaires-prospection-liste-360x740.png")

  await page.goto(`/apps/partenaires/${partenaireId}`)
  await sansDefilementHorizontal(page)
  await boutonsAQuaranteQuatre(page)
  await capturer(page, "partenaires-fiche-360x740.png")

  await page.goto(`/apps/partenaires/conventions/${conventionId}`)
  await sansDefilementHorizontal(page)
  await capturer(page, "partenaires-convention-360x740.png")

  await page.goto("/apps/partenaires/contreparties")
  await sansDefilementHorizontal(page)
  await boutonsAQuaranteQuatre(page)
  await capturer(page, "partenaires-contreparties-360x740.png")
})

test("modèles : insertion au curseur, aperçu sans enregistrer, liste de base", async ({ page, equipe }) => {
  await connecterParLien(page, equipe)
  await page.goto("/apps/partenaires/modeles")
  await expect(page.getByRole("heading", { name: "Modèles de convention" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Liste de base des contreparties" })).toBeVisible()
  await expect(page.getByText("Logo sur la voiture").first()).toBeVisible()

  await page.getByRole("link", { name: /Convention/ }).first().click()
  await page.waitForURL(/\/apps\/partenaires\/modeles\/[0-9a-f-]{36}$/)
  const zone = page.getByLabel("Texte", { exact: true })
  await zone.click()
  await page.getByRole("button", { name: "Insérer le champ team.nom" }).click()
  await expect(zone).toHaveValue(/\{\{team\.nom\}\}/)

  await page.getByRole("button", { name: "Aperçu", exact: true }).click()
  await expect(page.getByText("Équipe Exemple").first()).toBeVisible()
  await expect(page.getByText("Version 2")).toBeVisible()
  await capturer(page, "partenaires-modele-1440x900.png")
})

test("audit : le plan se lit par rôle, et le message hors ligne est le nouveau", async ({ page, equipe, context }) => {
  await connecterParLien(page, equipe)
  const vehiculeId = await creerSaxoDeux(page)
  await page.goto(`/apps/voiture/vehicules/${vehiculeId}?onglet=deco`)
  await expect(page.getByRole("group", { name: /^Plan de Saxo 2/ }).getByRole("button", { name: /Portière/ }).first()).toBeVisible()

  const partenaireId = await creerProspect(page, "Garage Audit")
  await page.goto(`/apps/partenaires/${partenaireId}`)
  // Le champ photo du logo est dans son tiroir : on l'ouvre, puis on passe hors ligne.
  await page.getByRole("button", { name: /^(Ajouter un logo|Changer le logo)$/ }).click()
  await context.setOffline(true)
  await expect(page.getByRole("dialog").getByText("Pas de réseau : l'envoi de la photo reprend quand tu es en ligne.")).toBeVisible()
  await context.setOffline(false)
})

test("thème clair à 1440 px : Prospection et Contreparties", async ({ page, equipe }) => {
  await connecterParLien(page, equipe)
  await passerEnThemeClair(page)
  await page.goto("/apps/partenaires")
  await capturer(page, "partenaires-prospection-clair-1440x900.png")
  await page.goto("/apps/partenaires/contreparties")
  await capturer(page, "partenaires-contreparties-clair-1440x900.png")
})

// Captures 3.13 : la fiche convention en thème clair, avec le tiroir « Saisir l'avancement » ouvert, à 1440 et à 360 px.
// La capture attend la fin de l'animation du tiroir, sinon elle le montre hors de l'écran.
test("captures 3.13 · fiche convention en clair, tiroir « Saisir l'avancement » à 1440 et à 360 px", async ({ page, equipe }) => {
  test.setTimeout(240_000)
  await preparerSaison(equipe, 2027)
  await connecterParLien(page, equipe)
  const partenaireId = await creerProspect(page, "Garage Muller")
  const conventionId = await creerConvention(page, partenaireId)
  await ajouterContrepartie(page, conventionId, "Publications sur les réseaux")
  await passerEnThemeClair(page)

  await page.setViewportSize(BUREAU)
  await page.goto(`/apps/partenaires/conventions/${conventionId}`)
  await ligneContrepartie(page, "Publications sur les réseaux").getByRole("button", { name: "Saisir l'avancement", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Saisir l'avancement", exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.querySelector('[role="dialog"]')?.getAnimations().length ?? 0)).toBe(0)
  await page.screenshot({ path: path.join(DOSSIER, "tiroir-convention-saisir-avancement-1440x900-clair.png") })

  // Même tiroir sur téléphone : la capture montre le tiroir du bas, avec la page derrière.
  await page.setViewportSize(TELEPHONE)
  await expect(page.getByRole("dialog", { name: "Saisir l'avancement", exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.querySelector('[role="dialog"]')?.getAnimations().length ?? 0)).toBe(0)
  await page.screenshot({ path: path.join(DOSSIER, "tiroir-convention-saisir-avancement-360x740-clair.png") })
})
