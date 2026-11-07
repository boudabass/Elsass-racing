// Propositions des écoutes de Check-lists (tâche 5.7b, article 956 §5) par des clics : une pièce en zone rouge propose un
// point « Remplacer la pièce », accepté, il s'ajoute à la liste avec son lien ; une réparation terminée sur l'organe d'un
// point propose de le cocher, accepté, il passe à fait. Rien n'est coché ni ajouté sans l'acceptation.
import type { Page } from "@playwright/test"

import { preparerEngagementChecklist } from "./aide/checklist"
import { envoyer, envoyerSansFermeture } from "./aide/envoi"
import { expect, test } from "./aide/fixtures"
import { preparerAtelierSaxo } from "./aide/garage"
import { connecterParLien } from "./aide/navigation"
import {
  emettreEvenement,
  lienPointChecklistEnBase,
  propositionsDeTitreEnBase,
  statutAction,
  statutActionTitreEnBase,
  statutPointChecklistEnBase,
  type Equipe,
} from "./aide/session"

// Réponse d'une server action : à attendre après un envoi qui ne ferme pas de tiroir (cf. envoi.ts).
const REPONSE_ACTION = (r: { request: () => { method: () => string; headers: () => Record<string, string> } }) =>
  r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined

// Accepte la proposition « Créer les listes » : les listes de l'engagement existent ensuite.
async function accepterListes(page: Page, equipe: Equipe, entryId: string): Promise<void> {
  await page.getByRole("button", { name: /Boîte d'actions/ }).click()
  // Les listes se créent après la décision, dans la même requête : on attend la réponse avant de naviguer (envoi.ts).
  await envoyerSansFermeture(page, page.getByRole("dialog").getByRole("button", { name: "Accepter", exact: true }))
  await expect.poll(() => statutAction(equipe, `creer_listes:${entryId}`)).toBe("decidee")
}

async function ouvrirPremiereListe(page: Page): Promise<void> {
  await page.goto("/apps/checklist")
  await page.getByRole("region", { name: "Par engagement" }).getByRole("link").first().click()
  await expect(page).toHaveURL(/\/apps\/checklist\/liste\/[^?]+$/)
}

// Accepte la proposition de la boîte qui porte ce titre. Les autres actions de la boîte ne sont pas touchées.
async function accepterProposition(page: Page, equipe: Equipe, titre: string): Promise<void> {
  await page.goto("/apps/checklist")
  await page.getByRole("button", { name: /Boîte d'actions/ }).click()
  const boite = page.getByRole("dialog")
  const ligne = boite.locator("li").filter({ hasText: titre })
  await expect(ligne.getByText(titre, { exact: true })).toBeVisible()
  await envoyerSansFermeture(page, ligne.getByRole("button", { name: "Accepter", exact: true }))
  await expect.poll(() => statutActionTitreEnBase(equipe, "proposition:", titre)).toBe("decidee")
  await page.keyboard.press("Escape")
  await expect(boite).toHaveCount(0)
}

// Roulage par le menu « + » du Garage, comme un membre le fait (la boîte passe en zone rouge).
async function rouler(page: Page, kilometres: string): Promise<void> {
  await page.goto("/qg")
  await page.locator('a[href="/apps/garage"]').filter({ has: page.locator("h2") }).click()
  await expect(page.getByRole("heading", { name: "Atelier", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Ajouter", exact: true }).click()
  await page.getByRole("menuitem", { name: "Roulage", exact: true }).click()
  await page.getByLabel("Kilomètres roulés").fill(kilometres)
  await page.getByRole("button", { name: "Enregistrer le roulage", exact: true }).click()
  await expect(page).toHaveURL(/\/apps\/garage\?vehicule=/)
}

test("Pièce en zone rouge : le point « Remplacer la pièce » est proposé, accepté, puis lié à l'organe dans la liste", async ({ page, equipe }) => {
  test.setTimeout(420_000)
  const { entryId, vehicleId } = await preparerEngagementChecklist(equipe)
  const organes = await preparerAtelierSaxo(equipe, vehicleId)
  await connecterParLien(page, equipe)
  await accepterListes(page, equipe, entryId)

  // 16 000 km sur la boîte : elle passe en zone rouge, le socle reçoit garage.piece_zone_rouge.
  await rouler(page, "16000")

  // La proposition est dans la boîte de Check-lists, et rien n'est ajouté avant l'acceptation.
  const titre = "Remplacer la pièce : Boîte de vitesses"
  await page.goto("/apps/checklist")
  await page.getByRole("button", { name: /Boîte d'actions/ }).click()
  await expect(page.getByRole("dialog").getByText(titre, { exact: true })).toBeVisible()
  expect(await lienPointChecklistEnBase(equipe, titre), "point ajouté avant acceptation").toBeNull()
  await page.keyboard.press("Escape")

  await accepterProposition(page, equipe, titre)
  await expect.poll(() => lienPointChecklistEnBase(equipe, titre)).toEqual({ lienType: "organe_garage", lienId: organes.boite })

  // Dans la liste, le point est là, critique, avec son objet lié.
  await ouvrirPremiereListe(page)
  await expect(page.locator("li").filter({ hasText: titre }).first()).toBeVisible()
})

test("Proposition ignorée : elle sort de la boîte et ne revient pas quand le même événement est réémis", async ({ page, equipe }) => {
  test.setTimeout(420_000)
  const { entryId, vehicleId } = await preparerEngagementChecklist(equipe)
  const organes = await preparerAtelierSaxo(equipe, vehicleId)
  await connecterParLien(page, equipe)
  await accepterListes(page, equipe, entryId)

  // 16 000 km : la proposition « Remplacer la pièce : Boîte de vitesses » apparaît dans la boîte, en attente.
  await rouler(page, "16000")
  const titre = "Remplacer la pièce : Boîte de vitesses"
  await page.goto("/apps/checklist")
  await page.getByRole("button", { name: /Boîte d'actions/ }).click()
  const boite = page.getByRole("dialog")
  const ligne = boite.locator("li").filter({ hasText: titre })
  await expect(ligne.getByText(titre, { exact: true })).toBeVisible()

  // Ignorée dans la boîte : la proposition passe à « ignorée », son action est décidée, et rien n'est ajouté à la liste.
  await envoyerSansFermeture(page, ligne.getByRole("button", { name: "Ignorer", exact: true }))
  await expect.poll(() => statutActionTitreEnBase(equipe, "proposition:", titre)).toBe("decidee")
  await expect.poll(async () => (await propositionsDeTitreEnBase(equipe, titre)).map((p) => p.statut)).toEqual(["ignoree"])
  expect(await lienPointChecklistEnBase(equipe, titre), "point ajouté après ignorance").toBeNull()
  await page.keyboard.press("Escape")
  await expect(boite).toHaveCount(0)

  // Le même événement est réémis (même pièce, même véhicule) : l'écoute voit la proposition ignorée et ne crée ni
  // proposition ni action. L'émission traite l'événement avant de rendre la main : pas d'attente à prévoir.
  emettreEvenement(equipe, "garage.piece_zone_rouge", { vehicleComponentId: organes.boite, vehicleId })
  const apres = await propositionsDeTitreEnBase(equipe, titre)
  expect(apres, "une seule proposition, toujours ignorée").toEqual([{ type: "ajouter_point", statut: "ignoree", actions: 1 }])

  // Et rien ne revient à l'écran après un rechargement de la boîte.
  await page.goto("/apps/checklist")
  await page.getByRole("button", { name: /Boîte d'actions/ }).click()
  await expect(page.getByRole("dialog").getByText(titre, { exact: true })).toHaveCount(0)
  expect(await lienPointChecklistEnBase(equipe, titre), "point ajouté après réémission").toBeNull()
})

test("Réparation terminée sur l'organe d'un point : le point est proposé à cocher, accepté, il passe à fait", async ({ page, equipe }) => {
  test.setTimeout(420_000)
  const { entryId, vehicleId } = await preparerEngagementChecklist(equipe)
  const organes = await preparerAtelierSaxo(equipe, vehicleId)
  await connecterParLien(page, equipe)
  await accepterListes(page, equipe, entryId)
  await ouvrirPremiereListe(page)

  // Un point à faire, lié au moteur dans sa fiche.
  await page.getByRole("button", { name: "+ Ajouter un point", exact: true }).click()
  const ajout = page.getByRole("dialog")
  await ajout.getByLabel("Libellé du point", { exact: true }).fill("Niveau d'huile moteur")
  await envoyer(page, ajout.getByRole("button", { name: "Ajouter le point", exact: true }))
  await page.locator("li").filter({ hasText: "Niveau d'huile moteur" }).getByRole("link", { name: "Détail", exact: true }).click()
  const fiche = page.getByRole("dialog").first()
  await fiche.getByLabel("Objet lié", { exact: true }).selectOption(`organe_garage|${organes.moteur}`)
  const reponseLien = page.waitForResponse(REPONSE_ACTION)
  await fiche.getByRole("button", { name: "Enregistrer le lien", exact: true }).click()
  await reponseLien
  await expect.poll(() => lienPointChecklistEnBase(equipe, "Niveau d'huile moteur")).toEqual({ lienType: "organe_garage", lienId: organes.moteur })

  // Une réparation sur le moteur, puis son ordre terminé : Garage le signale, et rien ne se coche sans acceptation.
  await page.goto(`/apps/garage/organes/${organes.moteur}`)
  await page.getByRole("button", { name: "Réparer", exact: true }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.getByLabel("Ce qui est réparé").fill("Huile moteur refaite")
  await envoyer(page, page.getByRole("button", { name: "Ajouter la réparation", exact: true }))
  await expect(page).toHaveURL(/\/apps\/garage\/travaux/)
  await page.getByRole("link", { name: /Huile moteur refaite/ }).first().click()
  await expect(page).toHaveURL(/\/apps\/garage\/travaux\/[0-9a-f-]+$/)
  await page.getByRole("button", { name: "Terminer l'ordre", exact: true }).click()
  await page.getByLabel("État de la pièce après réparation (%)").fill("80")
  await envoyer(page, page.getByRole("dialog").getByRole("button", { name: "Terminer l'ordre", exact: true }))
  await expect(page.getByText("Cet ordre est terminé : il ne se modifie plus.")).toBeVisible()
  await expect.poll(() => statutPointChecklistEnBase(equipe, "Niveau d'huile moteur")).toBe("a_faire")

  // La proposition de cocher est dans la boîte ; l'acceptation coche le point.
  await accepterProposition(page, equipe, "Cocher : Niveau d'huile moteur")
  await expect.poll(() => statutPointChecklistEnBase(equipe, "Niveau d'huile moteur")).toBe("fait")
})
