// Captures des Check-lists hors ligne (tâche 5.6b, brief §5) : la liste hors ligne et le mode terrain hors ligne, à 1440 et
// à 360 px, en thème sombre et en thème clair. Elles partent dans docs/captures/ (checklist-hors-ligne-*) ; elles sont
// téléchargées du run, relues une à une, puis commitées à la main.
// Le mode terrain se regarde hors ligne depuis la page en cache : il est activé en ligne, la page est visitée en ligne (le
// service worker la met en cache), puis le réseau tombe et la page se recharge depuis ce cache. Ce fichier tourne donc sur
// le projet « hors-ligne » (nom en -hors-ligne.spec.ts), seul où le service worker existe.
import type { Page } from "@playwright/test"

import { attendreServiceWorker, attendreTirageLocal, preparerEngagementChecklist } from "./aide/checklist"
import { capturer, choisirTheme } from "./aide/equipe"
import { envoyer } from "./aide/envoi"
import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { statutAction, statutPointChecklistEnBase, type Equipe } from "./aide/session"

const BUREAU = { largeur: "1440", width: 1440, height: 900 }
const TELEPHONE = { largeur: "360", width: 360, height: 740 }
const POINT = "Triangle de présentation"

type Statut = "a_faire" | "fait"

// Un clic sur le point bascule sa coche : hors ligne, la mention « en attente d'envoi » apparaît dans la capture.
async function cocherPoint(page: Page, actuel: Statut): Promise<void> {
  const point = page.locator("li").filter({ hasText: POINT })
  const bouton = point.getByRole("button", { name: actuel === "a_faire" ? "Faire" : "✓ Fait", exact: true })
  await expect(bouton).toBeEnabled({ timeout: 30_000 })
  await bouton.click()
  await expect(point.getByText("en attente d'envoi")).toBeVisible()
}

test("captures · liste et mode terrain hors ligne, 1440 et 360 px, sombre et clair", async ({ page, equipe, context }) => {
  test.setTimeout(600_000)
  const { entryId } = await preparerEngagementChecklist(equipe)
  await connecterParLien(page, equipe)
  await page.getByRole("button", { name: /Boîte d'actions/ }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Accepter", exact: true }).click()
  await expect.poll(() => statutAction(equipe, `creer_listes:${entryId}`)).toBe("decidee")

  await page.goto("/apps/checklist")
  await page.getByRole("region", { name: "Par engagement" }).getByRole("link").first().click()
  await expect(page).toHaveURL(/\/apps\/checklist\/liste\/[^?]+$/)
  const listeUrl = page.url()
  await attendreServiceWorker(page)

  // Statut du point côté base, suivi à chaque coche (il part au retour du réseau).
  let statut: Statut = "a_faire"
  for (const theme of ["sombre", "clair"] as const) {
    await choisirTheme(page, theme)
    for (const taille of [BUREAU, TELEPHONE]) {
      await page.setViewportSize({ width: taille.width, height: taille.height })

      // Liste hors ligne : une coche faite sans réseau, mention « en attente d'envoi » dans la capture.
      await page.goto(listeUrl)
      await attendreTirageLocal(page, 2)
      await context.setOffline(true)
      await expect(page.getByText("Hors ligne : tes coches restent")).toBeVisible()
      await cocherPoint(page, statut)
      statut = statut === "a_faire" ? "fait" : "a_faire"
      await capturer(page, `checklist-hors-ligne-liste-${taille.largeur}-${theme}.png`)

      // Retour du réseau : la coche part. Mode terrain activé en ligne, puis la page est revisitée en ligne : c'est elle
      // que le service worker garde en cache.
      await context.setOffline(false)
      await expect.poll(() => statutPointChecklistEnBase(equipe, POINT), { timeout: 30_000 }).toBe(statut)
      await page.goto(listeUrl)
      await envoyer(page, page.getByRole("main").getByRole("button", { name: "Mode terrain", exact: true }))
      await expect(page.getByRole("main").getByRole("button", { name: "Quitter le mode terrain", exact: true })).toBeVisible()
      await page.goto(listeUrl)
      await attendreTirageLocal(page, 2)

      // Réseau coupé, page rechargée depuis le cache : le layout terrain doit être là (titre en grand, texte du réseau).
      await context.setOffline(true)
      await page.reload()
      await expect(page.getByText("Hors ligne : tes coches restent")).toBeVisible()
      await expect(page.getByRole("main").getByRole("heading", { level: 2 }).first()).toHaveClass(/text-3xl/)
      await expect(page.getByText("Mode terrain actif. Le désactiver demande le réseau.")).toBeVisible()
      await cocherPoint(page, statut)
      statut = statut === "a_faire" ? "fait" : "a_faire"
      await capturer(page, `checklist-hors-ligne-terrain-${taille.largeur}-${theme}.png`)

      // Retour en ligne : la coche part, le mode terrain se désactive pour la taille suivante.
      await context.setOffline(false)
      await expect.poll(() => statutPointChecklistEnBase(equipe, POINT), { timeout: 30_000 }).toBe(statut)
      await page.goto(listeUrl)
      await envoyer(page, page.getByRole("main").getByRole("button", { name: "Quitter le mode terrain", exact: true }))
      await expect(page.getByRole("main").getByRole("button", { name: "Mode terrain", exact: true })).toBeVisible()
    }
  }
})
