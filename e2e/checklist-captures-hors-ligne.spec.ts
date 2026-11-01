// Captures des Check-lists hors ligne (tâche 5.6b, brief §5) : la liste et le mode terrain hors ligne, à 1440 et à 360 px,
// en thème sombre et en thème clair. Elles partent dans docs/captures/ (checklist-hors-ligne-*) ; elles sont téléchargées
// du run, relues une à une, puis commitées à la main. Le réseau tombe sur une page déjà chargée et synchronisée : pas
// besoin du service worker, donc ce fichier tourne sur le projet « chromium ».
import { attendreTirageLocal, preparerEngagementChecklist } from "./aide/checklist"
import { capturer, choisirTheme } from "./aide/equipe"
import { envoyer } from "./aide/envoi"
import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { statutAction } from "./aide/session"

const BUREAU = { largeur: "1440", width: 1440, height: 900 }
const TELEPHONE = { largeur: "360", width: 360, height: 740 }

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

  let premiereCoche = true
  for (const theme of ["sombre", "clair"] as const) {
    await choisirTheme(page, theme)
    for (const taille of [BUREAU, TELEPHONE]) {
      await page.setViewportSize({ width: taille.width, height: taille.height })

      // En ligne : la page se recharge, la synchro tire la liste sur l'appareil ; puis le réseau tombe.
      await page.goto(listeUrl)
      await attendreTirageLocal(page, 2)
      await context.setOffline(true)
      await expect(page.getByText("Hors ligne : tes coches restent")).toBeVisible()

      if (premiereCoche) {
        // Une coche faite sans réseau : la mention « en attente d'envoi » figure dans la capture.
        const point = page.locator("li").filter({ hasText: "Triangle de présentation" })
        await point.getByRole("button", { name: "Faire", exact: true }).click()
        await expect(point.getByText("en attente d'envoi")).toBeVisible()
        premiereCoche = false
      }
      await capturer(page, `checklist-hors-ligne-liste-${taille.largeur}-${theme}.png`)

      // Mode terrain : activé en ligne (le réglage est celui de la préférence), puis capturé hors ligne.
      await context.setOffline(false)
      await envoyer(page, page.getByRole("main").getByRole("button", { name: "Mode terrain", exact: true }))
      await expect(page.getByRole("main").getByRole("button", { name: "Quitter le mode terrain", exact: true })).toBeVisible()
      await page.goto(listeUrl)
      await attendreTirageLocal(page, 2)
      await context.setOffline(true)
      await expect(page.getByText("Mode terrain : demande le réseau")).toBeVisible()
      await capturer(page, `checklist-hors-ligne-terrain-${taille.largeur}-${theme}.png`)

      // Retour en ligne : le mode terrain se désactive pour la taille suivante.
      await context.setOffline(false)
      await page.goto(listeUrl)
      await envoyer(page, page.getByRole("main").getByRole("button", { name: "Quitter le mode terrain", exact: true }))
      await expect(page.getByRole("main").getByRole("button", { name: "Mode terrain", exact: true })).toBeVisible()
    }
  }
})
