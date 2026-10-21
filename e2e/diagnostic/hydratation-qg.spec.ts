// Diagnostic de l'hydratation (tâche 4.3c), en développement : React écrit le diff complet (+ client, − serveur)
// dans la console quand une hydratation échoue. Ne lance que le projet diagnostic-dev (playwright.diagnostic.config.ts).
// Deux mesures, un contexte neuf et une team neuve par essai :
// - /qg, trente chargements : le résultat attendu est zéro message ;
// - /controle-hydratation, trois chargements : un désaccord volontaire, qui doit être reçu à chaque fois. Sans ce
//   contrôle, le zéro sur /qg ne prouve rien (la capture pourrait manquer les messages).
// Résultat : test-results/diagnostic-418/*.{json,txt}.
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import { devices, expect, test, type Browser, type Page } from "@playwright/test"

import { connecterParLien, tuilesDuQg } from "../aide/navigation"
import { creerEquipe, supprimerEquipe } from "../aide/session"

const ESSAIS_QG = 30
const ESSAIS_CONTROLE = 3
// Messages d'hydratation de React 19 en développement : « Hydration failed », « didn't match », « Expected server HTML
// to contain », « Text content does not match ». Le filtre est large : un mot oublié donnerait un faux zéro.
const MOTIF = /hydrat|did not match|didn't match|expected server html|text content does not match|minified react error/i

interface Message {
  essai: number
  phase: string
  type: string
  texte: string
}

interface Bilan {
  essais: number
  essaisAvecHydratation: number[]
  essaisEnEchec: number[]
  messages: Message[]
  autres: Message[]
}

// Une connexion par lien, puis le chargement mesuré. Un essai en échec est noté, sans arrêter les autres.
async function mesurer(
  browser: Browser,
  essais: number,
  chemin: string,
  phaseMesuree: string,
  verifier: (page: Page) => Promise<void>,
): Promise<Bilan> {
  const messages: Message[] = []
  // Toutes les erreurs et tous les avertissements de la page, sans filtre : pour relire ce que le filtre écarte.
  const autres: Message[] = []
  const essaisAvecHydratation: number[] = []
  const essaisEnEchec: number[] = []

  for (let essai = 1; essai <= essais; essai++) {
    const equipe = await creerEquipe()
    const contexte = await browser.newContext({ ...devices["Desktop Chrome"], baseURL: "http://localhost:3102", locale: "fr-FR" })
    try {
      const page = await contexte.newPage()
      let phase = "connexion"
      page.on("console", (m) => {
        if (m.type() !== "error" && m.type() !== "warning") return
        autres.push({ essai, phase, type: m.type(), texte: m.text().slice(0, 300) })
        if (MOTIF.test(m.text())) messages.push({ essai, phase, type: m.type(), texte: m.text() })
      })
      page.on("pageerror", (erreur) => {
        autres.push({ essai, phase, type: "pageerror", texte: erreur.message.slice(0, 300) })
        if (MOTIF.test(erreur.message)) messages.push({ essai, phase, type: "pageerror", texte: erreur.message })
      })

      try {
        await connecterParLien(page, equipe)
        phase = phaseMesuree
        await page.goto(chemin)
        await verifier(page)
      } catch (erreur) {
        essaisEnEchec.push(essai)
        messages.push({ essai, phase, type: "echec_essai", texte: String(erreur).slice(0, 2000) })
      }
      if (messages.some((m) => m.essai === essai && m.type !== "echec_essai")) essaisAvecHydratation.push(essai)
    } finally {
      await contexte.close()
      await supprimerEquipe(equipe)
    }
  }
  return { essais, essaisAvecHydratation, essaisEnEchec, messages, autres }
}

async function ecrire(nom: string, bilan: Bilan) {
  const dossier = path.join(process.cwd(), "test-results", "diagnostic-418")
  await mkdir(dossier, { recursive: true })
  await writeFile(path.join(dossier, `${nom}.json`), JSON.stringify(bilan, null, 2))
  const texte = bilan.messages.map((m) => `--- essai ${m.essai} (${m.phase}, ${m.type})\n${m.texte}`).join("\n\n")
  await writeFile(path.join(dossier, `${nom}.txt`), texte || "Aucun message d'hydratation.")
  console.log(
    `DIAG-HYDRATATION ${nom} essais=${bilan.essais} avec_hydratation=${bilan.essaisAvecHydratation.length} ` +
      `essais_avec=[${bilan.essaisAvecHydratation.join(",")}] en_echec=${bilan.essaisEnEchec.length} ` +
      `erreurs_et_avertissements=${bilan.autres.length}`,
  )
  const distincts = Array.from(new Set(bilan.autres.map((m) => `${m.type}: ${m.texte.slice(0, 160)}`)))
  for (const d of distincts.slice(0, 40)) console.log(`DIAG-HYDRATATION ${nom} distinct ${d}`)
  for (const m of bilan.messages.slice(0, 3)) console.log(`DIAG-HYDRATATION ${nom} essai ${m.essai} ${m.phase} ${m.type}: ${m.texte.slice(0, 2000)}`)
}

test("hydratation de /qg en développement : messages React sur 30 chargements", async ({ browser }) => {
  test.setTimeout(3_600_000)
  const bilan = await mesurer(browser, ESSAIS_QG, "/qg", "qg", async (page) => {
    await expect(tuilesDuQg(page)).toHaveCount(11)
  })
  await ecrire("hydratation-qg", bilan)
})

test("contrôle de la capture : un désaccord provoqué est reçu à chaque chargement", async ({ browser }) => {
  test.setTimeout(900_000)
  const bilan = await mesurer(browser, ESSAIS_CONTROLE, "/controle-hydratation", "controle", async (page) => {
    await expect(page.getByText("Élément présent seulement côté client")).toBeVisible()
  })
  await ecrire("controle-hydratation", bilan)
  expect(bilan.essaisAvecHydratation).toHaveLength(ESSAIS_CONTROLE)
})
