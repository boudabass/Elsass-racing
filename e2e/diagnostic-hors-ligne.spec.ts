import type { Browser, BrowserContext, Page } from "@playwright/test"

import { test } from "./aide/fixtures"
import { connecterParLien, tuilesDuQg } from "./aide/navigation"

type EtatSession = Awaited<ReturnType<BrowserContext["storageState"]>>

// Diagnostic du React #418 au premier chargement de /qg (hors-ligne:87 et hors-ligne:119). Ce test ne
// vérifie aucun contenu : il capte, pour chaque chargement dans un contexte neuf (donc sans service
// worker, comme le premier chargement de hors-ligne:119), le HTML serveur et le DOM client, et les
// erreurs de page. Le résultat part dans le journal (ligne « DIAG418 ») pour être lu avec gh.
// Le fichier tourne sur le projet « hors-ligne » (son nom finit par hors-ligne.spec.ts).

const ITERATIONS = 5

function textesDuBody(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, "text/html")
  const textes: string[] = []
  const marche = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  let noeud = marche.nextNode()
  while (noeud) {
    const valeur = noeud.nodeValue?.trim()
    if (valeur) textes.push(valeur)
    noeud = marche.nextNode()
  }
  return textes
}

// Exécutée dans la page (page.evaluate) : DOMParser n'existe pas côté Node.
function attributs(html: string): { html: string; body: string } {
  const doc = new DOMParser().parseFromString(html, "text/html")
  const liste = (el: Element | null) => (el ? Array.from(el.attributes).map((a) => `${a.name}=${a.value}`).join(" ") : "")
  return { html: liste(doc.documentElement), body: liste(doc.body) }
}

async function capter(browser: Browser, etat: EtatSession) {
  const contexte = await browser.newContext({ locale: "fr-FR", baseURL: "http://localhost:3101", storageState: etat })
  const page = await contexte.newPage()
  const erreurs: string[] = []
  page.on("pageerror", (erreur) => erreurs.push(`pageerror: ${erreur.message}`))
  page.on("console", (message) => {
    if (message.type() === "error") erreurs.push(`console: ${message.text()}`)
  })

  const reponse = await page.goto("/qg")
  const serveur = (await reponse?.text()) ?? ""
  // Pas d'assertion : un chargement incomplet doit se voir dans le résultat, pas arrêter la boucle.
  await tuilesDuQg(page).first().waitFor({ timeout: 30_000 }).catch(() => undefined)
  // Laisse l'hydratation et les erreurs éventuelles arriver.
  await page.waitForTimeout(2000)

  const client = await page.evaluate(() => document.documentElement.outerHTML)
  const attributsClient = await page.evaluate(() => ({
    html: Array.from(document.documentElement.attributes).map((a) => `${a.name}=${a.value}`).join(" "),
    body: Array.from(document.body.attributes).map((a) => `${a.name}=${a.value}`).join(" "),
  }))
  const textesServeur = await page.evaluate(textesDuBody, serveur)
  const textesClient = await page.evaluate(textesDuBody, client)
  const attributsServeur = await page.evaluate(attributs, serveur)

  // Premier écart de texte entre le HTML serveur et le DOM client, avec deux mots de contexte.
  let ecart: { index: number; serveur: string; client: string } | null = null
  const longueur = Math.max(textesServeur.length, textesClient.length)
  for (let i = 0; i < longueur; i++) {
    if (textesServeur[i] !== textesClient[i]) {
      ecart = { index: i, serveur: textesServeur[i] ?? "(absent)", client: textesClient[i] ?? "(absent)" }
      break
    }
  }

  await contexte.close()
  return {
    erreurs,
    attributsServeur,
    attributsClient,
    ecartTexte: ecart,
    longueurServeur: serveur.length,
    longueurClient: client.length,
    nombreTextesServeur: textesServeur.length,
    nombreTextesClient: textesClient.length,
  }
}

test("diagnostic 418 : premier chargement de /qg, HTML serveur contre DOM client", async ({ browser, page, equipe, context }) => {
  test.setTimeout(300_000)
  await connecterParLien(page, equipe)
  const etat = await context.storageState()

  for (let i = 1; i <= ITERATIONS; i++) {
    const resultat = await capter(browser, etat)
    console.log(`DIAG418 ${i}/${ITERATIONS} ${JSON.stringify(resultat)}`)
  }
})
