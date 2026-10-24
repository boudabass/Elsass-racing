// Intervention rapide avec pièce, en ligne, sur un organe occupé (954 v1.2 §2 ; reliquat de la 4.3e) : la pièce en place se
// dépose, son motif et sa destination sont demandés comme dans Remplacer, et la pièce posée remplace l'ancienne en base.
// Le parcours part de l'entrée de l'intervention ; la pose se vérifie en base, après la réponse du serveur.
import { personneResponsableDeTest, preparerAtelierSaxo, pieceEnStockDeTest, posesDeLOrganeEnBase } from "./aide/garage"
import { envoyer } from "./aide/envoi"
import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"
import { ajouterVoitureSaxo } from "./aide/session"

const BUREAU = { width: 1440, height: 900 }

test("responsable · intervention rapide avec pièce sur un organe occupé : motif et destination demandés, pose en base", async ({ page, equipe }) => {
  test.setTimeout(180_000)
  // Une intervention se rattache à la fiche personne du compte (core_person.user_id) : sans elle, le serveur la refuse.
  await personneResponsableDeTest(equipe)
  const vehicleId = await ajouterVoitureSaxo(equipe, "Saxo intervention pièce e2e")
  const organes = await preparerAtelierSaxo(equipe, vehicleId)
  // Les freins ont une pièce montée (« Disque et plaquettes ») : l'organe est occupé. La pièce de rechange est en stock.
  await pieceEnStockDeTest(equipe, organes.freins, "Plaquettes de test")
  await connecterParLien(page, equipe)
  await page.setViewportSize(BUREAU)

  await page.goto(`/apps/garage/intervention?vehicule=${vehicleId}`)
  await expect(page.getByRole("heading", { name: "Intervention", exact: true })).toBeVisible()
  await page.locator('select[name="vehicleComponentId"]').selectOption(organes.freins)
  await page.getByLabel("Ce qui a été fait").fill("Plaquettes avant changées")
  await page.getByLabel("Pièce utilisée (facultative)").selectOption({ label: "Plaquettes de test" })

  // Organe occupé : le motif et la destination de l'ancienne pièce sont obligatoires.
  await expect(page.getByLabel("Motif de dépose de la pièce en place")).toBeVisible()
  await page.getByLabel("Motif de dépose de la pièce en place").selectOption({ label: "Usure" })
  await page.getByLabel("Ce que devient l'ancienne pièce").selectOption({ label: "Au rebut (cassée)" })

  await envoyer(page, page.getByRole("button", { name: "Enregistrer l'intervention", exact: true }))
  await expect(page).toHaveURL(/\/apps\/garage\/travaux/)
  await expect(page.getByText("Plaquettes avant changées").first()).toBeVisible()

  // En base : la pièce de rechange est posée, l'ancienne est déposée pour usure.
  await expect
    .poll(() => posesDeLOrganeEnBase(equipe, organes.freins))
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({ designation: "Plaquettes de test", deposee: false }),
        expect.objectContaining({ designation: "Disque et plaquettes", deposee: true, motif_depose: "usure" }),
      ]),
    )
})
