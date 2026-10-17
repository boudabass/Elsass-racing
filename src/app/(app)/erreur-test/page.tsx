import { notFound } from "next/navigation"

// Rendue à la requête : avec E2E=1, le throw ne doit pas casser le build.
export const dynamic = "force-dynamic"

// Page de test de l'écran d'erreur. Hors production seulement : en production, elle n'existe pas,
// sauf pour le build des tests de bout en bout (E2E=1, jamais posé sur Coolify).
// (Le brief parle de /__erreur-test ; un dossier qui commence par « _ » est privé dans Next, d'où ce nom.)
export default function PageErreurTest() {
  if (process.env.NODE_ENV === "production" && process.env.E2E !== "1") notFound()
  throw new Error("Erreur de test (page /erreur-test, hors production).")
}
