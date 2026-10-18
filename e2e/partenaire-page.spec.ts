// Page partenaire, de bout en bout (brief 3.7, §8) : ce que voit un partenaire sans compte, les fichiers, le lien
// révoqué, renouvelé ou expiré, les en-têtes, les consultations, le message, la limite, le service worker, le bilan,
// le téléphone et le journal. Les captures partent dans docs/captures/ ; le PDF de bilan d'exemple aussi.
// Le navigateur du visiteur est un contexte neuf, sans cookie : aucune session.
import fs from "node:fs"
import path from "node:path"

import type { Browser, BrowserContext, Page } from "@playwright/test"

import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { expirerLien, noterJetonDeTest, preparerPageDePartenaire, type PageDePartenaire } from "./aide/partenaire-page"
import { creerEquipe, supprimerEquipe, type Equipe } from "./aide/session"

const DOSSIER = path.join(__dirname, "..", "docs", "captures")
const URL_DE_BASE = "http://localhost:3101"
const BUREAU = { width: 1440, height: 900 }
const TELEPHONE = { width: 360, height: 740 }
// Un jeton inventé : 43 caractères en base64url, jamais créé par l'application.
const JETON_INVENTE = "Zx9qLm2RtV8wNpKc4YhJ6sFdBgE1aUoTiWrXy0QlMnA"

// Une adresse d'IP de test par scénario : la limite des jetons invalides est par IP, et les scénarios ne doivent pas
// se gêner entre eux.
// Le visiteur n'a pas de préférence de thème : la page s'affiche en sombre, le thème par défaut de l'application.
function visiteurSansSession(browser: Browser, ip: string, viewport = BUREAU): Promise<BrowserContext> {
  return browser.newContext({
    baseURL: URL_DE_BASE,
    viewport,
    extraHTTPHeaders: { "x-real-ip": ip },
  })
}

// Thème clair pour le membre connecté (réglages, affichage) : la page partenaire le suit, comme les autres écrans.
async function passerEnThemeClair(page: Page): Promise<void> {
  await page.goto("/apps/settings/affichage")
  const formulaire = page.locator("form", { has: page.locator("#theme") })
  await formulaire.locator("#theme").selectOption("clair")
  await formulaire.getByRole("button", { name: "Enregistrer" }).click()
  await page.waitForURL(/ok=1$/)
}

// Le jeton affiché une seule fois, lu dans l'élément qui porte l'URL (le reste de la zone n'est pas l'URL).
async function lireJetonAffiche(page: Page): Promise<string> {
  const zone = page.getByRole("status").filter({ hasText: "Copie-le maintenant" })
  await expect(zone).toBeVisible()
  return (await zone.locator(".font-mono").textContent())?.match(/\/p\/([A-Za-z0-9_-]{43})$/)?.[1] ?? ""
}

// Crée un lien de page partenaire par l'interface ; renvoie le jeton, affiché une seule fois.
async function creerLien(page: Page, partenaireId: string): Promise<string> {
  await page.goto(`/apps/partenaires/${partenaireId}?onglet=page`)
  await page.getByRole("button", { name: "Créer le lien", exact: true }).click()
  await expect.poll(async () => lireJetonAffiche(page)).toHaveLength(43)
  const jeton = await lireJetonAffiche(page)
  noterJetonDeTest(jeton)
  return jeton
}

// Aucun défilement horizontal sur la page, à la largeur courante.
async function sansDefilementHorizontal(page: Page): Promise<void> {
  const deborde = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(deborde, "défilement horizontal sur la page").toBe(false)
}

// Capture pleine page : éléments fixes masqués, comme dans partenaires.spec.ts.
async function capturer(page: Page, nom: string): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>("body *").forEach((element) => {
      if (getComputedStyle(element).position === "fixed") element.style.display = "none"
    })
  })
  await page.screenshot({ path: path.join(DOSSIER, nom), fullPage: true })
}

// Une équipe étrangère, pour le test des fichiers : supprimée à la fin du test, comme l'équipe principale.
async function avecAutreTeam(scenario: (autre: Equipe) => Promise<void>): Promise<void> {
  const autre = await creerEquipe()
  try {
    await scenario(autre)
  } finally {
    await supprimerEquipe(autre)
  }
}

// Corps d'une réponse, avec le jeton remplacé : la page 404 reprend le chemin demandé dans son HTML.
async function corpsSansJeton(reponse: { text: () => Promise<string> }, jeton: string): Promise<string> {
  return (await reponse.text()).split(jeton).join("<jeton>")
}

// 1. Le lien de A affiche la convention, les contreparties, la preuve visible, le résultat public et le bilan ;
// ni le brouillon, ni la preuve masquée, ni le résultat masqué, ni B, ni « Budget ».
test("1 · le lien de A n'affiche que ce qui est public", async ({ page, equipe, browser }) => {
  await avecAutreTeam(async (autre) => {
    const donnees = await preparerPageDePartenaire(equipe, autre)
    await connecterParLien(page, equipe)
    const jeton = await creerLien(page, donnees.partenaireA)
    const visiteur = await visiteurSansSession(browser, "198.51.100.1")
    const vue = await visiteur.newPage()
    const reponse = await vue.goto(`/p/${jeton}`)
    expect(reponse?.status()).toBe(200)

    await expect(vue.getByText("Espace partenaire de Garage Alpha")).toBeVisible()
    await expect(vue.getByText("Publications Alpha", { exact: false }).first()).toBeVisible()
    await expect(vue.getByText("Photo prise au départ")).toBeVisible()
    // Le nom des épreuves figure aussi au calendrier : on vérifie le résultat par son classement.
    await expect(vue.getByText("Au général : 3")).toBeVisible()
    await expect(vue.getByRole("link", { name: "Télécharger le bilan" })).toBeVisible()
    await expect(vue.getByAltText("Photo de la preuve")).toHaveCount(1)

    for (const interdit of ["Contrepartie brouillon secrète", "Note interne masquée", "Au général : 11", "Garage Beta", "Contrepartie de Beta", "Budget"]) {
      await expect(vue.getByText(interdit, { exact: false }), `« ${interdit} » ne doit pas apparaître`).toHaveCount(0)
    }
    await visiteur.close()
  })
})

// 2. Décocher « Résultats » dans la fiche fait disparaître la section, pour le partenaire.
test("2 · décocher une section la retire de la page", async ({ page, equipe, browser }) => {
  await avecAutreTeam(async (autre) => {
    const donnees = await preparerPageDePartenaire(equipe, autre)
    await connecterParLien(page, equipe)
    const jeton = await creerLien(page, donnees.partenaireA)

    await page.goto(`/apps/partenaires/${donnees.partenaireA}?onglet=page`)
    await page.getByLabel("Résultats", { exact: true }).uncheck()
    await page.getByRole("button", { name: "Enregistrer les sections", exact: true }).click()
    // Le rechargement lit l'état enregistré : il ne suffit pas que la case soit décochée à l'écran.
    await page.waitForLoadState("networkidle")
    await page.reload()
    await expect(page.getByLabel("Résultats", { exact: true })).not.toBeChecked()

    const visiteur = await visiteurSansSession(browser, "198.51.100.2")
    const vue = await visiteur.newPage()
    await vue.goto(`/p/${jeton}`)
    await expect(vue.getByRole("heading", { name: "Résultats", exact: true })).toHaveCount(0)
    await expect(vue.getByText("Au général : 3")).toHaveCount(0)
    await expect(vue.getByRole("heading", { name: "Conventions", exact: true })).toBeVisible()
    await visiteur.close()
  })
})

// 3. Fichiers : le document signé de A se télécharge ; les autres identifiants renvoient 404.
test("3 · les fichiers ne sortent que par le lien du partenaire", async ({ page, equipe, browser }) => {
  await avecAutreTeam(async (autre) => {
    const donnees: PageDePartenaire = await preparerPageDePartenaire(equipe, autre)
    await connecterParLien(page, equipe)
    const jeton = await creerLien(page, donnees.partenaireA)
    const visiteur = await visiteurSansSession(browser, "198.51.100.3")

    const document = await visiteur.request.get(`/p/${jeton}/fichiers/${donnees.fichierDocumentA}`)
    expect(document.status()).toBe(200)
    const octets = await document.body()
    expect(octets.subarray(0, 5).toString()).toBe("%PDF-")

    for (const [quoi, identifiant] of [
      ["le document de B", donnees.fichierDocumentB],
      ["la preuve masquée de A", donnees.fichierPreuveMasquee],
      ["un fichier de l'autre team", donnees.fichierAutreTeam],
    ] as const) {
      const refus = await visiteur.request.get(`/p/${jeton}/fichiers/${identifiant}`)
      expect(refus.status(), `${quoi} doit renvoyer 404`).toBe(404)
    }
    await visiteur.close()
  })
})

// 4. Révoqué, renouvelé ou expiré : l'ancien lien renvoie 404, avec le même texte qu'un jeton inventé.
test("4 · un lien révoqué, renouvelé ou expiré ne sert plus", async ({ page, equipe, browser }) => {
  await avecAutreTeam(async (autre) => {
    const donnees = await preparerPageDePartenaire(equipe, autre)
    await connecterParLien(page, equipe)
    const visiteur = await visiteurSansSession(browser, "198.51.100.4")

    // Révoqué.
    const premier = await creerLien(page, donnees.partenaireA)
    await page.goto(`/apps/partenaires/${donnees.partenaireA}?onglet=page`)
    await page.locator("summary", { hasText: "Révoquer le lien" }).click()
    await page.getByRole("button", { name: "Révoquer le lien", exact: true }).click()
    await page.reload()
    const revoque = await visiteur.request.get(`/p/${premier}`)
    const invente = await visiteur.request.get(`/p/${JETON_INVENTE}`)
    expect(revoque.status()).toBe(404)
    expect(invente.status()).toBe(404)
    expect(await corpsSansJeton(revoque, premier)).toBe(await corpsSansJeton(invente, JETON_INVENTE))

    // Renouvelé : l'ancien lien tombe, le nouveau marche.
    const second = await creerLien(page, donnees.partenaireA)
    await page.getByRole("button", { name: "Renouveler le lien", exact: true }).click()
    // La zone garde l'ancien jeton le temps de la réponse : on attend qu'il change.
    await expect.poll(async () => lireJetonAffiche(page)).not.toBe(second)
    const troisieme = await lireJetonAffiche(page)
    noterJetonDeTest(troisieme)
    expect(troisieme).not.toBe(second)
    expect((await visiteur.request.get(`/p/${second}`)).status()).toBe(404)
    expect((await visiteur.request.get(`/p/${troisieme}`)).status()).toBe(200)

    // Expiré : la date d'expiration passée coupe le lien actif.
    await expirerLien(equipe, donnees.partenaireA)
    expect((await visiteur.request.get(`/p/${troisieme}`)).status()).toBe(404)
    await visiteur.close()
  })
})

// 5. En-têtes sur la page et sur un fichier.
test("5 · en-têtes de la page et des fichiers", async ({ page, equipe, browser }) => {
  await avecAutreTeam(async (autre) => {
    const donnees = await preparerPageDePartenaire(equipe, autre)
    await connecterParLien(page, equipe)
    const jeton = await creerLien(page, donnees.partenaireA)
    const visiteur = await visiteurSansSession(browser, "198.51.100.5")

    for (const url of [`/p/${jeton}`, `/p/${jeton}/fichiers/${donnees.fichierDocumentA}`]) {
      const reponse = await visiteur.request.get(url)
      expect(reponse.status(), url).toBe(200)
      const entetes = reponse.headers()
      expect(entetes["referrer-policy"], url).toBe("no-referrer")
      expect(entetes["x-robots-tag"], url).toContain("noindex")
      expect(entetes["cache-control"], url).toContain("no-store")
      expect(entetes["content-security-policy"], url).toContain("frame-ancestors 'none'")
    }
    await visiteur.close()
  })
})

// 6. Une consultation est comptée, et la fiche l'affiche avec sa date.
test("6 · la fiche compte les consultations", async ({ page, equipe, browser }) => {
  await avecAutreTeam(async (autre) => {
    const donnees = await preparerPageDePartenaire(equipe, autre)
    await connecterParLien(page, equipe)
    const jeton = await creerLien(page, donnees.partenaireA)
    const visiteur = await visiteurSansSession(browser, "198.51.100.6")
    await visiteur.newPage().then((vue) => vue.goto(`/p/${jeton}`))

    await page.goto(`/apps/partenaires/${donnees.partenaireA}?onglet=page`)
    await expect(page.getByText("Consultations : 1", { exact: false })).toBeVisible()
    await expect(page.getByText("Dernière consultation :", { exact: false })).toBeVisible()
    await visiteur.close()
  })
})

// 7. Message : il arrive dans l'onglet Messages, en texte ; le champ piège ne crée rien.
test("7 · le message du partenaire arrive en texte, et le champ piège ne crée rien", async ({ page, equipe, browser }) => {
  await avecAutreTeam(async (autre) => {
    const donnees = await preparerPageDePartenaire(equipe, autre)
    await connecterParLien(page, equipe)
    const jeton = await creerLien(page, donnees.partenaireA)
    const visiteur = await visiteurSansSession(browser, "198.51.100.7")
    const vue = await visiteur.newPage()
    await vue.goto(`/p/${jeton}`)

    await vue.getByLabel("Ton nom", { exact: true }).fill("Aurélie")
    await vue.getByLabel("Ton message", { exact: true }).fill('Bonjour <img src="x" onerror="window.__piege = 1"> test')
    await vue.getByRole("button", { name: "Envoyer le message", exact: true }).click()
    await expect(vue.getByRole("status").filter({ hasText: "Merci, votre message a bien été transmis à la team." })).toBeVisible()

    // Le champ piège rempli : succès apparent, rien n'est enregistré.
    await vue.getByLabel("Ton nom", { exact: true }).fill("Robot")
    await vue.getByLabel("Ton message", { exact: true }).fill("Message piège")
    await vue.locator('input[name="site"]').evaluate((champ: HTMLInputElement) => {
      champ.value = "rempli par un robot"
    })
    await vue.getByRole("button", { name: "Envoyer le message", exact: true }).click()
    await expect(vue.getByRole("status").filter({ hasText: "Merci, votre message a bien été transmis à la team." })).toBeVisible()

    await page.goto(`/apps/partenaires/${donnees.partenaireA}?onglet=messages`)
    // Le texte s'affiche tel quel ; le « onerror » n'est pas exécuté et aucune balise img n'est créée.
    await expect(page.getByText('Bonjour <img src="x" onerror="window.__piege = 1"> test')).toBeVisible()
    await expect(page.getByText("Message piège")).toHaveCount(0)
    expect(await page.evaluate(() => (window as unknown as { __piege?: number }).__piege)).toBeUndefined()
    await expect(page.locator('img[src="x"]')).toHaveCount(0)
    await visiteur.close()
  })
})

// 8. Limite : 31 jetons inventés depuis une même IP donnent un 429 au 31e.
test("8 · trop de jetons inventés donnent un 429", async ({ browser }) => {
  const visiteur = await visiteurSansSession(browser, "198.51.100.8")
  const statuts: number[] = []
  for (let i = 0; i < 31; i++) {
    const reponse = await visiteur.request.get(`/p/${JETON_INVENTE}`)
    statuts.push(reponse.status())
  }
  expect(statuts.slice(0, 30).every((statut) => statut === 404)).toBe(true)
  expect(statuts[30]).toBe(429)
  await visiteur.close()
})

// 9. Service worker : une session de membre ouvre /p/<jeton> ; rien de /p/ n'entre dans le cache.
test("9 · le service worker ne met rien de /p/ en cache", async ({ page, equipe, browser }) => {
  await avecAutreTeam(async (autre) => {
    const donnees = await preparerPageDePartenaire(equipe, autre)
    await connecterParLien(page, equipe)
    const jeton = await creerLien(page, donnees.partenaireA)
    await page.goto(`/p/${jeton}`)
    await page.waitForLoadState("networkidle")

    const entrees = await page.evaluate(async () => {
      const trouvees: string[] = []
      for (const nom of await caches.keys()) {
        for (const requete of await (await caches.open(nom)).keys()) {
          if (new URL(requete.url).pathname.startsWith("/p/")) trouvees.push(requete.url)
        }
      }
      return trouvees
    })
    expect(entrees).toEqual([])
    const dansLeCache = await page.evaluate(async (chemin) => (await caches.match(chemin)) !== undefined, `/p/${jeton}`)
    expect(dansLeCache).toBe(false)
  })
})

// 10. Bilan : « Générer le bilan » produit un PDF de plus de 2 Ko, qui apparaît sur la page du partenaire.
test("10 · un bilan se génère, se télécharge et s'affiche sur la page", async ({ page, equipe, browser }) => {
  await avecAutreTeam(async (autre) => {
    const donnees = await preparerPageDePartenaire(equipe, autre)
    await connecterParLien(page, equipe)
    const jeton = await creerLien(page, donnees.partenaireA)

    await page.goto(`/apps/partenaires/${donnees.partenaireA}?onglet=bilans`)
    await page.getByRole("button", { name: "Générer le bilan", exact: true }).click()
    await expect(page.getByRole("status").filter({ hasText: "Bilan généré." })).toBeVisible()
    await page.reload()

    // Le plus récent est en tête de liste : c'est le premier lien de téléchargement.
    const lien = page.getByRole("link", { name: "Télécharger le PDF", exact: true }).first()
    const octets = await (await page.request.get((await lien.getAttribute("href")) ?? "")).body()
    expect(octets.subarray(0, 5).toString()).toBe("%PDF-")
    expect(octets.length).toBeGreaterThan(2048)
    fs.writeFileSync(path.join(DOSSIER, "bilan-partenaire-exemple.pdf"), octets)
    await capturer(page, "partenaires-bilans-1440x900.png")

    const visiteur = await visiteurSansSession(browser, "198.51.100.10")
    const vue = await visiteur.newPage()
    await vue.goto(`/p/${jeton}`)
    await expect(vue.getByRole("link", { name: "Télécharger le bilan" }).first()).toBeVisible()
    await visiteur.close()
  })
})

// 11. Téléphone 360 px : pas de défilement horizontal, boutons d'au moins 44 px.
test("11 · la page partenaire tient sur un téléphone de 360 px", async ({ page, equipe, browser }) => {
  await avecAutreTeam(async (autre) => {
    const donnees = await preparerPageDePartenaire(equipe, autre)
    await connecterParLien(page, equipe)
    const jeton = await creerLien(page, donnees.partenaireA)
    const visiteur = await visiteurSansSession(browser, "198.51.100.11", TELEPHONE)
    const vue = await visiteur.newPage()
    await vue.goto(`/p/${jeton}`)
    await sansDefilementHorizontal(vue)

    const boutons = vue.locator("button:visible")
    const nombre = await boutons.count()
    expect(nombre).toBeGreaterThan(0)
    for (let i = 0; i < nombre; i++) {
      const boite = await boutons.nth(i).boundingBox()
      expect(boite?.height ?? 44, `bouton trop petit n° ${i}`).toBeGreaterThanOrEqual(43.5)
    }
    await visiteur.close()

    // Clair : le membre connecté a le thème clair, et la même page le suit. Sombre : le visiteur sans compte.
    await passerEnThemeClair(page)
    await page.setViewportSize(TELEPHONE)
    await page.goto(`/p/${jeton}`)
    await capturer(page, "partenaire-page-360-clair.png")

    const sombre = await visiteurSansSession(browser, "198.51.100.12", TELEPHONE)
    const vueSombre = await sombre.newPage()
    await vueSombre.goto(`/p/${jeton}`)
    await capturer(vueSombre, "partenaire-page-360-sombre.png")
    await sombre.close()
  })
})

// 12. Journal : le jeton de test n'apparaît pas dans la sortie [WebServer]. Le spec note les jetons utilisés dans
// .e2e-stockage/jetons-de-test.txt ; la vérification du journal se fait après le run, sur le fichier de sortie.
test("12 · les jetons de test sont notés, pour le contrôle du journal serveur", async ({ page, equipe, browser }) => {
  await avecAutreTeam(async (autre) => {
    const donnees = await preparerPageDePartenaire(equipe, autre)
    await connecterParLien(page, equipe)
    const jeton = await creerLien(page, donnees.partenaireA)
    const visiteur = await visiteurSansSession(browser, "198.51.100.13")
    expect((await visiteur.request.get(`/p/${jeton}`)).status()).toBe(200)
    await visiteur.close()
    const notes = fs.readFileSync(path.join(__dirname, "..", ".e2e-stockage", "jetons-de-test.txt"), "utf8")
    expect(notes).toContain(jeton)
  })
})

// Captures demandées : la page de lien non valide, l'onglet Bilans, la confirmation du message, à 1440 px.
test("captures · lien non valide, onglet Bilans et confirmation du message", async ({ page, equipe, browser }) => {
  await avecAutreTeam(async (autre) => {
    const donnees = await preparerPageDePartenaire(equipe, autre)
    await connecterParLien(page, equipe)
    const jeton = await creerLien(page, donnees.partenaireA)

    const visiteur = await visiteurSansSession(browser, "198.51.100.14", BUREAU)
    const vue = await visiteur.newPage()
    await vue.goto(`/p/${JETON_INVENTE}`)
    await capturer(vue, "partenaire-lien-invalide-1440x900.png")

    // Clair à 1440 px : le membre connecté (thème clair), comme pour les captures de 360 px.
    await passerEnThemeClair(page)
    await page.setViewportSize(BUREAU)
    await page.goto(`/p/${jeton}`)
    await capturer(page, "partenaire-page-1440x900-clair.png")

    await vue.goto(`/p/${jeton}`)
    await vue.getByLabel("Ton nom", { exact: true }).fill("Aurélie")
    await vue.getByLabel("Ton message", { exact: true }).fill("Bonjour, une question sur le bilan.")
    await vue.getByRole("button", { name: "Envoyer le message", exact: true }).click()
    await expect(vue.getByRole("status").filter({ hasText: "Merci, votre message a bien été transmis à la team." })).toBeVisible()
    await capturer(vue, "partenaire-message-confirmation-1440x900.png")
    await visiteur.close()

    await page.goto(`/apps/partenaires/${donnees.partenaireA}?onglet=bilans`)
    await capturer(page, "partenaires-onglet-bilans-1440x900.png")
  })
})
