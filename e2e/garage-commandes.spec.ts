// Commandes du Garage (tâche 4.3, brief §5) : une commande saisie, expédiée, puis reçue. La réception crée une pièce en
// stock par unité, avec son prix et son fournisseur ; une commande reçue ne se reçoit plus, et le bouton disparaît.
import { TYPES_DEFAUT } from "../src/apps/garage/types-defaut"

import { envoyer } from "./aide/envoi"
import { piecesDeCommandeEnBase, fournisseurDeTest, preparerAtelierSaxo } from "./aide/garage"
import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { ajouterVoitureSaxo } from "./aide/session"

test("commandes : saisie, expédition, réception ; les pièces entrent en stock une seule fois", async ({ page, equipe }) => {
  const vehicleId = await ajouterVoitureSaxo(equipe, "Saxo commandes")
  await preparerAtelierSaxo(equipe, vehicleId)
  const fournisseurId = await fournisseurDeTest(equipe, "Pièces rallye test")
  const nomFreins = TYPES_DEFAUT.find((type) => type.cle === "freins")?.nom ?? "Freins"

  await connecterParLien(page, equipe)
  await page.goto(`/apps/garage/commandes?vehicule=${vehicleId}`)
  await expect(page.getByRole("heading", { name: "Commandes", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Livraisons attendues (0)" })).toBeVisible()

  // Saisie : une ligne de deux plaquettes à 12,50 €.
  await page.getByRole("link", { name: "Nouvelle commande", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Nouvelle commande", exact: true })).toBeVisible()
  await page.locator('select[name="supplierContactId"]').selectOption(fournisseurId)
  await page.locator('input[name="ligne1Designation"]').fill("Plaquettes avant")
  await page.locator('select[name="ligne1ComponentTypeId"]').selectOption({ label: nomFreins })
  await page.locator('input[name="ligne1Quantite"]').fill("2")
  await page.locator('input[name="ligne1Prix"]').fill("12,50")
  await envoyer(page, page.getByRole("button", { name: "Enregistrer la commande", exact: true }))

  await expect(page.getByRole("heading", { name: "Livraisons attendues (1)" })).toBeVisible()
  await expect(page.getByText("2 × Plaquettes avant", { exact: false })).toBeVisible()

  // Expédition : un tiroir de confirmation, puis le statut change.
  await page.getByRole("button", { name: "Marquer expédiée", exact: true }).click()
  await envoyer(page, page.getByRole("dialog").getByRole("button", { name: "Marquer expédiée", exact: true }))
  await expect(page.getByText("Expédiée", { exact: true })).toBeVisible()

  // Réception : deux pièces en stock, avec le prix unitaire et le fournisseur.
  await page.getByRole("button", { name: "Recevoir", exact: true }).click()
  await envoyer(page, page.getByRole("dialog").getByRole("button", { name: "Recevoir la commande", exact: true }))
  await expect(page.getByRole("heading", { name: "Reçues (1)" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Recevoir", exact: true })).toHaveCount(0)

  const pieces = await piecesDeCommandeEnBase(equipe, "Plaquettes avant")
  expect(pieces).toHaveLength(2)
  for (const piece of pieces) {
    expect(piece.statut).toBe("en_stock")
    expect(piece.prix_cents).toBe(1250)
    expect(piece.fournisseur_contact_id).toBe(fournisseurId)
    expect(piece.commande_ligne_id).not.toBeNull()
  }
})
