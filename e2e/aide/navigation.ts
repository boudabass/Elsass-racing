// Gestes communs aux scénarios : connexion par le lien, et le nombre de tuiles du QG.
import type { Page } from "@playwright/test"

import type { Equipe } from "./session"

export async function connecterParLien(page: Page, equipe: Equipe): Promise<void> {
  await page.goto(`/connexion/lien?t=${equipe.secretLien}`)
  await page.waitForURL(/\/qg$/)
}

// Tuiles du QG : un lien vers /apps/<cle> qui contient un titre (h2). La navigation latérale
// a les mêmes liens sans titre.
export function tuilesDuQg(page: Page) {
  return page.locator('a[href^="/apps/"]').filter({ has: page.locator("h2") })
}
