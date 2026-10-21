import { expect, type Locator, type Page } from "@playwright/test"

// Envoi d'un formulaire (bouton d'un tiroir ou d'un formulaire de page) : le clic, puis la réponse de la server action,
// puis la fermeture du tiroir s'il y en a un. Toute navigation (goto, reload, clic de lien) doit venir après : le
// navigateur annule une requête en vol au premier rechargement, et l'écriture peut alors ne pas avoir lieu.
// Règle dans docs/tests.md (« Après un envoi : attendre la réponse »).
export async function envoyer(page: Page, bouton: Locator): Promise<void> {
  const reponse = page.waitForResponse((r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined)
  await bouton.click()
  await reponse
  // Un tiroir se ferme à la réponse du serveur : on attend qu'il soit parti avant de naviguer.
  await expect(page.getByRole("dialog")).toHaveCount(0)
}
