// Préparer l'atelier (brief 4.1, action explicite) : une voiture créée par la Voiture, sans l'aide Garage, n'a aucun
// organe. L'atelier le dit et propose « Préparer l'atelier » ; après l'action, les sept organes par défaut sont là. Un
// assistant voit le même état, avec le bouton désactivé et sa raison.
import { TYPES_DEFAUT } from "../src/apps/garage/types-defaut"

import { monterPieceSansDuree } from "./aide/garage"
import { envoyer } from "./aide/envoi"
import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { ajouterMembreConnectable, ajouterVoitureSaxo } from "./aide/session"

const TITRE_NON_SUIVIE = "Le Garage ne suit pas encore cette voiture."

test("responsable · une voiture sans organes : l'atelier propose de le préparer, puis montre les sept organes", async ({ page, equipe }) => {
  const vehicleId = await ajouterVoitureSaxo(equipe, "Saxo sans atelier e2e")
  await connecterParLien(page, equipe)
  await page.goto(`/apps/garage?vehicule=${vehicleId}`)

  await expect(page.getByRole("heading", { name: TITRE_NON_SUIVIE })).toBeVisible()
  const bouton = page.getByRole("button", { name: "Préparer l'atelier" })
  await expect(bouton).toBeEnabled()
  await envoyer(page, bouton)

  // Après l'action : plus d'état vide, et chacun des sept organes par défaut est affiché.
  await expect(page.getByRole("heading", { name: TITRE_NON_SUIVIE })).toHaveCount(0)
  for (const type of TYPES_DEFAUT) {
    await expect(page.getByText(type.nom, { exact: true }).filter({ visible: true }).first()).toBeVisible()
  }
  await expect(page.getByText("Aucun organe critique sur cette voiture.")).toHaveCount(0)

  // Un organe critique avec une pièce montée sans durée : la phrase demande la durée, et ne dit pas « rien ne manque ».
  await monterPieceSansDuree(equipe, vehicleId, "embrayage")
  await page.goto(`/apps/garage?vehicule=${vehicleId}`)
  await expect(page.getByText("Renseigne la durée de vie de : Embrayage pour calculer l'indice.", { exact: true })).toBeVisible()
  await expect(page.getByText("Aucun organe critique sur cette voiture.")).toHaveCount(0)
})

test("assistance · une voiture sans organes : le bouton « Préparer l'atelier » est désactivé, avec sa raison", async ({ page, equipe }) => {
  const vehicleId = await ajouterVoitureSaxo(equipe, "Saxo assistance sans atelier e2e")
  const assistance = await ajouterMembreConnectable(equipe, "assistance")
  await page.goto(`/connexion/lien?t=${assistance.secretLien}`)
  await page.waitForURL(/\/qg$/)

  await page.goto(`/apps/garage?vehicule=${vehicleId}`)
  await expect(page.getByRole("heading", { name: TITRE_NON_SUIVIE })).toBeVisible()
  await expect(page.getByRole("button", { name: "Préparer l'atelier" })).toBeDisabled()
  await expect(page.getByText("Seul l'équipage peut préparer l'atelier.", { exact: true })).toBeVisible()
})
