// Diagnostic de l'hydratation de /qg (tâche 4.3c), en développement : React écrit le diff complet (+ client, − serveur)
// dans la console quand une hydratation échoue. Trente chargements, un contexte neuf et une team neuve par essai,
// comme le test hors-ligne.spec.ts:88. Ne lance que le projet diagnostic-dev (playwright.diagnostic.config.ts).
// Résultat : messages complets dans test-results/diagnostic-418/hydratation-dev.{json,txt}.
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import { devices, expect, test } from "@playwright/test"

import { connecterParLien, tuilesDuQg } from "../aide/navigation"
import { creerEquipe, supprimerEquipe } from "../aide/session"

const ESSAIS = 30
const MOTIF = /hydrat|did not match/i

interface Message {
  essai: number
  phase: "connexion" | "qg"
  type: string
  texte: string
}

test("hydratation de /qg en développement : messages React sur 30 chargements", async ({ browser }) => {
  test.setTimeout(3_600_000)
  const messages: Message[] = []
  const essaisAvec: number[] = []

  for (let essai = 1; essai <= ESSAIS; essai++) {
    const equipe = await creerEquipe()
    const contexte = await browser.newContext({ ...devices["Desktop Chrome"], baseURL: "http://localhost:3102", locale: "fr-FR" })
    try {
      const page = await contexte.newPage()
      let phase: Message["phase"] = "connexion"
      page.on("console", (m) => {
        if ((m.type() === "error" || m.type() === "warning") && MOTIF.test(m.text())) {
          messages.push({ essai, phase, type: m.type(), texte: m.text() })
        }
      })
      page.on("pageerror", (erreur) => {
        if (MOTIF.test(erreur.message)) messages.push({ essai, phase, type: "pageerror", texte: erreur.message })
      })

      try {
        await connecterParLien(page, equipe)
        phase = "qg"
        await page.goto("/qg")
        await expect(tuilesDuQg(page)).toHaveCount(11)
      } catch (erreur) {
        // Un essai qui échoue ne doit pas arrêter les autres : son échec est noté avec les messages.
        messages.push({ essai, phase, type: "echec_essai", texte: String(erreur).slice(0, 2000) })
      }
      if (messages.some((m) => m.essai === essai)) essaisAvec.push(essai)
    } finally {
      await contexte.close()
      await supprimerEquipe(equipe)
    }
  }

  const dossier = path.join(process.cwd(), "test-results", "diagnostic-418")
  await mkdir(dossier, { recursive: true })
  const bilan = { essais: ESSAIS, essaisAvecMessage: essaisAvec, messages }
  await writeFile(path.join(dossier, "hydratation-dev.json"), JSON.stringify(bilan, null, 2))
  const texte = messages.map((m) => `--- essai ${m.essai} (${m.phase}, ${m.type})\n${m.texte}`).join("\n\n")
  await writeFile(path.join(dossier, "hydratation-dev.txt"), texte || "Aucun message d'hydratation.")
  console.log(`DIAG-HYDRATATION essais=${ESSAIS} avec_message=${essaisAvec.length} essais=[${essaisAvec.join(",")}]`)
  for (const m of messages.slice(0, 3)) console.log(`DIAG-HYDRATATION essai ${m.essai} ${m.phase} ${m.type}: ${m.texte.slice(0, 2000)}`)
})
