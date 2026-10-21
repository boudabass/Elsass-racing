import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import type { Page, Response, TestInfo } from "@playwright/test"

// Diagnostic du 418 (tâche 4.3c). N'agit que lorsque le premier chargement de /qg lève une erreur 418 : compare la
// structure (balises, attributs, nombre d'enfants) du HTML reçu du serveur et du DOM final, après la récupération de
// React. Les textes ne sont pas comparés : un 418 « HTML » est un désaccord de structure. Ne modifie ni la requête
// ni la page : le corps est relu sur la réponse déjà reçue par Playwright.
// Résultat : une ligne DIAG418 dans le journal, et diagnostic-418/essai-N.{json,html} (artefact du run).

export async function diagnostiquerRecouvrement(page: Page, reponse: Response | null, testInfo: TestInfo): Promise<void> {
  if (!reponse) return
  const brut = await reponse.text()
  const diffs = await page.evaluate(comparer, brut)
  const rapport = {
    essai: testInfo.repeatEachIndex,
    url: reponse.url(),
    statut: reponse.status(),
    octetsHtml: brut.length,
    premiereDifference: diffs[0] ?? null,
    diffs,
  }
  console.log(`DIAG418 ${JSON.stringify(rapport)}`)

  const dossier = path.join(process.cwd(), "test-results", "diagnostic-418")
  await mkdir(dossier, { recursive: true })
  await writeFile(path.join(dossier, `essai-${testInfo.repeatEachIndex}.json`), JSON.stringify(rapport, null, 2))
  await writeFile(path.join(dossier, `essai-${testInfo.repeatEachIndex}.html`), brut)
}

// Exécuté dans la page : ne doit référencer aucune variable du module (il est sérialisé tel quel).
function comparer(brut: string) {
  const ignores = new Set(["SCRIPT", "NOSCRIPT", "STYLE", "TEMPLATE", "LINK", "META"])
  const serveur = new DOMParser().parseFromString(brut, "text/html")
  const diffs: Array<Record<string, unknown>> = []

  const decrire = (n: Node): string => (n.nodeType === 1 ? (n as Element).tagName.toLowerCase() : n.nodeType === 3 ? "#texte" : `#noeud${n.nodeType}`)

  const enfants = (n: Node): Node[] =>
    Array.from(n.childNodes).filter((c) => {
      if (c.nodeType === 1) return !ignores.has((c as Element).tagName)
      if (c.nodeType === 3) return (c.textContent ?? "").trim() !== ""
      return false
    })

  const visiter = (a: Node | undefined, b: Node | undefined, chemin: string): void => {
    if (diffs.length >= 40) return
    if (!a || !b) {
      diffs.push({ chemin, type: a ? "absent_du_DOM" : "absent_du_HTML", html: a ? decrire(a) : null, dom: b ? decrire(b) : null })
      return
    }
    const dA = decrire(a)
    const dB = decrire(b)
    if (dA !== dB) {
      diffs.push({ chemin, type: "noeud", html: dA, dom: dB })
      return
    }
    if (a.nodeType !== 1) return
    const attrsA = Array.from((a as Element).attributes).map((x) => `${x.name}=${x.value}`).sort()
    const attrsB = Array.from((b as Element).attributes).map((x) => `${x.name}=${x.value}`).sort()
    if (attrsA.join("|") !== attrsB.join("|")) diffs.push({ chemin, type: "attributs", html: attrsA, dom: attrsB })
    const fa = enfants(a)
    const fb = enfants(b)
    if (fa.length !== fb.length) diffs.push({ chemin, type: "nombre_enfants", html: fa.length, dom: fb.length })
    const n = Math.max(fa.length, fb.length)
    for (let i = 0; i < n; i++) visiter(fa[i], fb[i], `${chemin}>${decrire((fa[i] ?? fb[i]) as Node)}[${i}]`)
  }

  visiter(serveur.documentElement, document.documentElement, "html")
  return diffs
}
