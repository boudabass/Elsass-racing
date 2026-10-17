import { expect, test } from "./aide/fixtures"
import { connecterParLien } from "./aide/navigation"

// Brief 2.10, point 9 : barre haute sur téléphone dans l'état « à jour » et « hors ligne » (icône seule).
test("barre haute téléphone : icône de synchro à jour puis hors ligne ; captures", async ({ page, context, equipe }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await connecterParLien(page, equipe)
  await page.goto("/qg")
  const indicateur = page.getByRole("button", { name: /Synchronisé|En ligne/ }).first()
  await expect(indicateur).toBeVisible()
  await page.screenshot({ path: "docs/captures/barre-haute-synchro-a-jour-360x740.png", clip: { x: 0, y: 0, width: 360, height: 64 } })

  await context.setOffline(true)
  await expect(page.getByRole("button", { name: "Hors ligne" })).toBeVisible()
  await page.screenshot({ path: "docs/captures/barre-haute-synchro-hors-ligne-360x740.png", clip: { x: 0, y: 0, width: 360, height: 64 } })
  await context.setOffline(false)
})
