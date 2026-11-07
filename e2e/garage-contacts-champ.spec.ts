// Fournisseur créé depuis le champ qui le demande (5.8b) : une team neuve n'a aucun fournisseur en base. Le parcours crée le
// fournisseur d'une nouvelle pièce à 45 € (champ « Nouveau fournisseur » du tiroir Remplacer), puis un second fournisseur
// depuis le champ de la commande, et commande chez lui. Les captures du champ partent dans docs/captures/ (garage-contacts-*),
// relues du run avant d'être commitées.
import { TYPES_DEFAUT } from "../src/apps/garage/types-defaut"

import { capturer, choisirTheme } from "./aide/equipe"
import { envoyer } from "./aide/envoi"
import { contactEnBase, piecesDeCommandeEnBase, preparerAtelierSaxo } from "./aide/garage"
import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { ajouterVoitureSaxo } from "./aide/session"

const BUREAU = { width: 1440, height: 900 }
const TELEPHONE = { width: 360, height: 740 }
const NOM_FREINS = TYPES_DEFAUT.find((type) => type.cle === "freins")?.nom ?? "Freins"

test("responsable · fournisseurs créés depuis le champ : une pièce à 45 €, puis une commande chez un nouveau fournisseur", async ({ page, equipe }) => {
  const vehicleId = await ajouterVoitureSaxo(equipe, "Saxo contacts champ")
  const organes = await preparerAtelierSaxo(equipe, vehicleId)
  await connecterParLien(page, equipe)
  await page.setViewportSize(BUREAU)

  // Remplacer les freins par une pièce à 45 € : le fournisseur n'existe pas, il se crée depuis le champ du tiroir.
  await page.goto(`/apps/garage/organes/${organes.freins}`)
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  await page.getByRole("button", { name: "Remplacer", exact: true }).click()
  const tiroir = page.getByRole("dialog")
  await expect(tiroir).toBeVisible()
  await tiroir.getByLabel("Désignation").fill("Disques avant neufs")
  await tiroir.getByLabel("Prix, en euros (facultatif)").fill("45,00")
  await tiroir.getByRole("button", { name: "Nouveau fournisseur", exact: true }).click()
  await tiroir.getByLabel("Nom du nouveau fournisseur", { exact: true }).fill("Disques Rhin e2e")
  await tiroir.getByLabel("Motif de dépose de la pièce en place").selectOption("usure")
  await tiroir.getByLabel("Ce que devient l'ancienne pièce").selectOption({ label: "En réserve (en stock)" })
  await envoyer(page, tiroir.getByRole("button", { name: "Remplacer la pièce", exact: true }))
  await expect(tiroir).toBeHidden()
  await expect(page.getByText("Disques avant neufs", { exact: true }).first()).toBeVisible()

  // Le fournisseur est un contact de la team, de catégorie fournisseur ; la commande reçue pointe vers lui, au prix.
  expect(await contactEnBase(equipe, "Disques Rhin e2e")).toEqual({ categories: ["fournisseur"] })
  const recues = await piecesDeCommandeEnBase(equipe, "Disques avant neufs")
  expect(recues).toHaveLength(1)
  expect(recues[0]?.prix_cents).toBe(4500)

  // Commande chez un second fournisseur, saisi dans le champ de la commande.
  await page.goto(`/apps/garage/commandes?vehicule=${vehicleId}`)
  await expect(page.getByRole("heading", { name: "Commandes", exact: true })).toBeVisible()
  await page.getByRole("link", { name: "Nouvelle commande", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Nouvelle commande", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Nouveau fournisseur", exact: true }).click()
  await page.getByLabel("Nom du nouveau fournisseur", { exact: true }).fill("Atelier commandes e2e")
  await page.locator('input[name="ligne1Designation"]').fill("Plaquettes avant")
  await page.locator('select[name="ligne1ComponentTypeId"]').selectOption({ label: NOM_FREINS })
  await page.locator('input[name="ligne1Quantite"]').fill("2")
  await page.locator('input[name="ligne1Prix"]').fill("12,50")
  await envoyer(page, page.getByRole("button", { name: "Enregistrer la commande", exact: true }))

  await expect(page.getByRole("heading", { name: "Livraisons attendues (1)" })).toBeVisible()
  await expect(page.getByText("2 × Plaquettes avant", { exact: false })).toBeVisible()
  expect(await contactEnBase(equipe, "Atelier commandes e2e")).toEqual({ categories: ["fournisseur"] })
})

test("captures · champ « Nouveau fournisseur » du tiroir Remplacer et de la commande, 1440 et 360 px, sombre et clair", async ({ page, equipe }) => {
  test.setTimeout(420_000)
  const vehicleId = await ajouterVoitureSaxo(equipe, "Saxo captures contacts")
  const organes = await preparerAtelierSaxo(equipe, vehicleId)
  await connecterParLien(page, equipe)

  for (const theme of ["sombre", "clair"] as const) {
    await choisirTheme(page, theme)
    for (const taille of [BUREAU, TELEPHONE]) {
      const largeur = String(taille.width)
      await page.setViewportSize(taille)

      await page.goto(`/apps/garage/organes/${organes.freins}`)
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
      await page.getByRole("button", { name: "Remplacer", exact: true }).click()
      const tiroir = page.getByRole("dialog")
      await expect(tiroir).toBeVisible()
      await tiroir.getByLabel("Prix, en euros (facultatif)").fill("45,00")
      await tiroir.getByRole("button", { name: "Nouveau fournisseur", exact: true }).click()
      await expect(tiroir.getByLabel("Nom du nouveau fournisseur", { exact: true })).toBeVisible()
      await capturer(page, `garage-contacts-remplacer-${largeur}-${theme}.png`)
      // Le tiroir est modifié (prix saisi) : Escape demande « Abandonner les modifications ? », qu'on confirme.
      await page.keyboard.press("Escape")
      await expect(tiroir.getByText("Abandonner les modifications ?")).toBeVisible()
      await tiroir.getByRole("button", { name: "Abandonner", exact: true }).click()
      await expect(page.getByRole("dialog")).toHaveCount(0)

      await page.goto(`/apps/garage/commandes?vehicule=${vehicleId}`)
      await page.getByRole("link", { name: "Nouvelle commande", exact: true }).click()
      await expect(page.getByRole("heading", { name: "Nouvelle commande", exact: true })).toBeVisible()
      await page.getByRole("button", { name: "Nouveau fournisseur", exact: true }).click()
      await expect(page.getByLabel("Nom du nouveau fournisseur", { exact: true })).toBeVisible()
      await capturer(page, `garage-contacts-commande-${largeur}-${theme}.png`)
    }
  }
})
