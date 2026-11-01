// Captures des liaisons de Check-lists (tâche 5.7a) : la fiche d'un point lié à un organe, la boîte d'actions avec la
// proposition d'ordre et le point critique, la ligne Check-lists de Saison, à 1440 et à 360 px, en thème sombre et clair.
// Elles partent dans docs/captures/ (checklist-liaisons-*) ; elles sont téléchargées du run, relues une à une, puis
// commitées à la main.
import path from "node:path"

import type { Page } from "@playwright/test"

import { preparerEngagementChecklist } from "./aide/checklist"
import { capturer, choisirTheme, DOSSIER_CAPTURES } from "./aide/equipe"
import { envoyer } from "./aide/envoi"
import { expect, test } from "./aide/fixtures"
import { preparerAtelierSaxo } from "./aide/garage"
import { connecterParLien } from "./aide/navigation"
import { statutAction } from "./aide/session"

// Hauteur du téléphone : assez haute pour que la boîte et la fiche tiennent sans être coupées par le tiroir.
const BUREAU = { largeur: "1440", width: 1440, height: 900 }
const TELEPHONE = { largeur: "360", width: 360, height: 1000 }

// Réponse d'une server action : à attendre après un envoi qui ne ferme pas de tiroir (cf. envoi.ts).
const REPONSE_ACTION = (r: { request: () => { method: () => string; headers: () => Record<string, string> } }) =>
  r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined

async function ajouterPoint(page: Page, libelle: string, critique: boolean): Promise<void> {
  await page.getByRole("button", { name: "+ Ajouter un point", exact: true }).click()
  const ajout = page.getByRole("dialog")
  await ajout.getByLabel("Libellé du point", { exact: true }).fill(libelle)
  if (critique) await ajout.getByLabel("Point critique", { exact: true }).check()
  await envoyer(page, ajout.getByRole("button", { name: "Ajouter le point", exact: true }))
}

test("captures · liaisons : fiche d'un point lié, boîte d'actions, Saison, 1440 et 360 px, sombre et clair", async ({ page, equipe }) => {
  test.setTimeout(600_000)
  // Échéance proche (décalage J-7 du modèle) : le point critique ajouté se propose dans la boîte.
  const { entryId, eventId, vehicleId } = await preparerEngagementChecklist(equipe, { commenceAujourdhui: true, echeanceRelative: "j_moins_7" })
  const organes = await preparerAtelierSaxo(equipe, vehicleId)
  await connecterParLien(page, equipe)

  // La proposition « Créer les listes » acceptée : les listes de l'engagement existent.
  await page.getByRole("button", { name: /Boîte d'actions/ }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Accepter", exact: true }).click()
  await expect.poll(() => statutAction(equipe, `creer_listes:${entryId}`)).toBe("decidee")

  await page.goto("/apps/checklist")
  await page.getByRole("region", { name: "Par engagement" }).getByRole("link").first().click()
  await expect(page).toHaveURL(/\/apps\/checklist\/liste\/[^?]+$/)
  const listeUrl = page.url()

  // Un point critique (proposé dans la boîte) et un point ajouté à la liste, lié au moteur puis en problème.
  await ajouterPoint(page, "Pression des pneus", true)
  await ajouterPoint(page, "Niveau d'huile moteur", false)
  await page.locator("li").filter({ hasText: "Niveau d'huile moteur" }).getByRole("link", { name: "Détail", exact: true }).click()
  await expect(page).toHaveURL(/\?point=/)
  const ficheUrl = page.url()
  const fiche = page.getByRole("dialog").first()
  await fiche.getByLabel("Objet lié", { exact: true }).selectOption(`organe_garage|${organes.moteur}`)
  const reponseLien = page.waitForResponse(REPONSE_ACTION)
  await fiche.getByRole("button", { name: "Enregistrer le lien", exact: true }).click()
  await reponseLien
  await expect(fiche.getByRole("region", { name: "Lien" })).toContainText("Moteur")
  const reponseProbleme = page.waitForResponse(REPONSE_ACTION)
  await fiche.getByRole("button", { name: "Problème", exact: true }).click()
  await reponseProbleme

  // Chaque écran se rejoint par son URL, en thème et en taille donnés.
  for (const theme of ["sombre", "clair"] as const) {
    await choisirTheme(page, theme)

    for (const taille of [BUREAU, TELEPHONE]) {
      await page.setViewportSize({ width: taille.width, height: taille.height })

      await page.goto(ficheUrl)
      const fichePoint = page.getByRole("dialog").first()
      const sectionLien = fichePoint.getByRole("region", { name: "Lien" })
      await expect(sectionLien).toContainText("Moteur")
      // Le tiroir défile : la section Lien est amenée en vue, puis c'est le tiroir qui est capturé.
      await sectionLien.scrollIntoViewIfNeeded()
      await fichePoint.screenshot({ path: path.join(DOSSIER_CAPTURES, `checklist-liaisons-fiche-${taille.largeur}-${theme}.png`), animations: "disabled" })

      await page.goto(listeUrl)
      await page.getByRole("button", { name: /Boîte d'actions/ }).click()
      await expect(page.getByRole("dialog").getByText("Problème signalé : Moteur", { exact: true })).toBeVisible()
      await capturer(page, `checklist-liaisons-boite-${taille.largeur}-${theme}.png`)
      await page.keyboard.press("Escape")

      await page.goto(`/apps/saison/epreuves/${eventId}?onglet=pret`)
      await expect(page.getByText("À côté, sans effet sur l'indice").first()).toBeVisible()
      await capturer(page, `checklist-liaisons-saison-${taille.largeur}-${theme}.png`)
    }
  }
})
