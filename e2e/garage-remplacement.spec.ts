// Remplacer par une nouvelle pièce (954 v1.2, §2). Avec un prix, la pièce passe par une commande reçue tout de suite (une
// pièce en base, au prix et chez le fournisseur). Sans prix, elle entre au stock et se pose. Dans les deux cas, l'ancienne
// pièce part avec son motif et la destination choisie (aucun des deux n'est pré-rempli).
import { envoyer } from "./aide/envoi"
import { expect, test } from "./aide/fixtures"
import { fournisseurDeTest, piecesDeCommandeEnBase, posesDeLOrganeEnBase, preparerAtelierSaxo } from "./aide/garage"
import { connecterParLien } from "./aide/navigation"
import { ajouterVoitureSaxo } from "./aide/session"

const BUREAU = { width: 1440, height: 900 }

test("responsable · nouvelle pièce avec prix : commande reçue, pièce posée, ancienne en réserve", async ({ page, equipe }) => {
  const vehicleId = await ajouterVoitureSaxo(equipe, "Saxo remplacement prix")
  const organes = await preparerAtelierSaxo(equipe, vehicleId)
  const fournisseurId = await fournisseurDeTest(equipe, "Pièces remplacement")
  await connecterParLien(page, equipe)
  await page.setViewportSize(BUREAU)
  await page.goto(`/apps/garage/organes/${organes.freins}`)
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()

  await page.getByRole("button", { name: "Remplacer", exact: true }).click()
  const tiroir = page.getByRole("dialog")
  await expect(tiroir).toBeVisible()
  // Les freins n'ont aucune rechange en stock après la préparation : la voie « nouvelle pièce » s'ouvre seule (pas de choix « Pièce posée »).
  await tiroir.getByLabel("Désignation").fill("Disques avant neufs")
  await tiroir.getByLabel("Marque (facultatif)").fill("Brembo")
  await tiroir.getByLabel("Prix, en euros (facultatif)").fill("45,00")
  // Le prix rend le fournisseur obligatoire : le libellé passe de « Fournisseur (facultatif) » à « Fournisseur ». Le libellé
  // contient aussi les options du select : on le repère par son nom de champ, pas par son texte exact.
  await tiroir.locator('select[name="fournisseurContactId"]').selectOption(fournisseurId)
  await tiroir.getByLabel("Motif de dépose de la pièce en place").selectOption("usure")
  await tiroir.getByLabel("Ce que devient l'ancienne pièce").selectOption({ label: "En réserve (en stock)" })
  await envoyer(page, tiroir.getByRole("button", { name: "Remplacer la pièce", exact: true }))
  await expect(tiroir).toBeHidden()
  await expect(page.getByText("Disques avant neufs", { exact: true }).first()).toBeVisible()

  // La pièce achetée : une commande reçue, une pièce en base, au prix et chez le fournisseur.
  const recues = await piecesDeCommandeEnBase(equipe, "Disques avant neufs")
  expect(recues).toHaveLength(1)
  expect(recues[0]?.prix_cents).toBe(4500)
  expect(recues[0]?.fournisseur_contact_id).toBe(fournisseurId)

  // La nouvelle est montée ; l'ancienne est déposée pour usure, et part en réserve.
  const poses = await posesDeLOrganeEnBase(equipe, organes.freins)
  const deposees = poses.filter((pose) => pose.deposee)
  const montees = poses.filter((pose) => !pose.deposee)
  expect(deposees).toHaveLength(1)
  expect(deposees[0]).toMatchObject({ statut: "en_stock", motif_depose: "usure" })
  expect(montees).toHaveLength(1)
  expect(montees[0]).toMatchObject({ designation: "Disques avant neufs", statut: "montee" })
})

test("responsable · nouvelle pièce sans prix : entrée au stock, posée, ancienne au rebut", async ({ page, equipe }) => {
  const vehicleId = await ajouterVoitureSaxo(equipe, "Saxo remplacement sans prix")
  const organes = await preparerAtelierSaxo(equipe, vehicleId)
  await connecterParLien(page, equipe)
  await page.setViewportSize(BUREAU)
  await page.goto(`/apps/garage/organes/${organes.freins}`)
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()

  await page.getByRole("button", { name: "Remplacer", exact: true }).click()
  const tiroir = page.getByRole("dialog")
  await expect(tiroir).toBeVisible()
  await tiroir.getByLabel("Désignation").fill("Disque arrière de rechange")
  await tiroir.getByLabel("Motif de dépose de la pièce en place").selectOption("casse")
  await tiroir.getByLabel("Ce que devient l'ancienne pièce").selectOption({ label: "Au rebut (cassée)" })
  await envoyer(page, tiroir.getByRole("button", { name: "Remplacer la pièce", exact: true }))
  await expect(tiroir).toBeHidden()
  await expect(page.getByText("Disque arrière de rechange", { exact: true }).first()).toBeVisible()

  // Sans prix : aucune commande, la pièce est entrée au stock puis posée.
  expect(await piecesDeCommandeEnBase(equipe, "Disque arrière de rechange")).toHaveLength(0)
  const poses = await posesDeLOrganeEnBase(equipe, organes.freins)
  const deposees = poses.filter((pose) => pose.deposee)
  expect(deposees).toHaveLength(1)
  expect(deposees[0]).toMatchObject({ statut: "cassee", motif_depose: "casse" })
  expect(poses.filter((pose) => !pose.deposee)[0]).toMatchObject({ designation: "Disque arrière de rechange", statut: "montee" })
})
