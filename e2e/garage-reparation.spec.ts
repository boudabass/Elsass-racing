// Réparation (954 v1.3, §2 et §4) : « Réparer » sur la fiche d'un organe crée un ordre à faire dans les travaux ; sa fin
// demande l'état de la pièce après réparation. La fiche garde la trace : « Réparé le …, état saisi : 80 % ». Le parcours
// passe par les boutons et les tiroirs ; seule l'entrée est une URL. Les captures partent dans docs/captures/
// (garage-reparation-*) et sont relues avant d'être commitées.
import path from "node:path"

import type { Page } from "@playwright/test"

import { preparerAtelierSaxo } from "./aide/garage"
import { envoyer } from "./aide/envoi"
import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { ajouterVoitureSaxo } from "./aide/session"

const DOSSIER = path.join(__dirname, "..", "docs", "captures")
const BUREAU = { width: 1440, height: 900 }
const TELEPHONE = { width: 360, height: 740 }

// Capture pleine page : éléments fixes masqués, sauf le tiroir ouvert (même convention que garage.spec.ts).
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

// Aucun défilement horizontal sur la page, à la largeur courante.
async function sansDefilementHorizontal(page: Page): Promise<void> {
  const deborde = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(deborde, "défilement horizontal sur la page").toBe(false)
}

test("responsable · réparer la boîte : l'ordre passe dans les travaux, sa fin saisit l'état, la fiche le garde", async ({ page, equipe }) => {
  test.setTimeout(180_000)
  const vehicleId = await ajouterVoitureSaxo(equipe, "Saxo réparation")
  const organes = await preparerAtelierSaxo(equipe, vehicleId)
  await connecterParLien(page, equipe)
  await page.setViewportSize(BUREAU)

  // Réparer : un ordre de type réparation, à faire, avec son coût facultatif.
  await page.goto(`/apps/garage/organes/${organes.boite}`)
  await expect(page.getByRole("heading", { name: "Boîte de vitesses", level: 1 })).toBeVisible()
  await page.getByRole("button", { name: "Réparer", exact: true }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.getByLabel("Ce qui est réparé").fill("Synchro de 3e remplacé")
  await page.getByLabel("Main-d'œuvre, en euros (facultatif)").fill("120,00")
  await envoyer(page, page.getByRole("button", { name: "Ajouter la réparation", exact: true }))
  await expect(page).toHaveURL(/\/apps\/garage\/travaux/)
  await expect(page.getByRole("link", { name: /Synchro de 3e remplacé/ }).first()).toBeVisible()

  // Fin de l'ordre : le tiroir demande l'état de la pièce après réparation, et refuse de partir sans lui.
  await page.getByRole("link", { name: /Synchro de 3e remplacé/ }).first().click()
  await expect(page).toHaveURL(/\/apps\/garage\/travaux\/[0-9a-f-]+$/)
  await page.getByRole("button", { name: "Terminer l'ordre", exact: true }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await expect(page.getByLabel("État de la pièce après réparation (%)")).toBeVisible()
  await page.getByLabel("État de la pièce après réparation (%)").fill("80")
  await envoyer(page, page.getByRole("dialog").getByRole("button", { name: "Terminer l'ordre", exact: true }))
  // Le texte existe deux fois (contenu et zone Actions) : il suffit qu'il soit visible.
  await expect(page.getByText("Cet ordre est terminé : il ne se modifie plus.").first()).toBeVisible()

  // La fiche de la boîte garde la trace et affiche l'état saisi.
  await page.goto(`/apps/garage/organes/${organes.boite}`)
  await expect(page.getByText(/Réparé le .+, état saisi : 80 %/)).toBeVisible()
  await capturerPage(page, "garage-reparation-organe-1440.png")

  // Téléphone : la fiche tient dans la largeur, sans défilement horizontal.
  await page.setViewportSize(TELEPHONE)
  await page.goto(`/apps/garage/organes/${organes.boite}`)
  await expect(page.getByRole("heading", { name: "Boîte de vitesses", level: 1 })).toBeVisible()
  await sansDefilementHorizontal(page)
  await capturerPage(page, "garage-reparation-organe-360.png")
})
